-- ============================================================================
-- 074_odul_ve_satinalma_yarislari.sql — Çift dokunuş çift ücret/ödül verebiliyordu
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 073'ten SONRA. İdempotent (CREATE OR REPLACE, imzalar aynı).
--
-- NEDEN:
--   • `esya_satin_al` (062): "zaten sende mi?" kontrolü kilitsizdi. Aynı
--     kullanıcının iki eşzamanlı çağrısı (çift dokunuş) ikisi de kontrolü
--     geçip İKİ KEZ ücret düşebiliyordu.
--   • `gunluk_giris_al` (061): satır varken FOR UPDATE zaten kilitliyor;
--     açık kalan yarış İLK GÜN — satır yokken iki eşzamanlı çağrıda kaybeden
--     INSERT, ON CONFLICT'in KOŞULSUZ DO UPDATE'ine düşüp yine de _odul_ver
--     çağırıyordu → çift ödül.
--
-- TERCİH NOTU: şemada `idempotency_keys` + `idem_kaydet()` hazır ama o yol
-- istemcinin her çağrıya anahtar üretmesini gerektirir (imza değişirdi).
-- Kullanıcı satırı kilidi imzaya dokunmadan aynı sonucu veriyor: aynı
-- kullanıcının eşzamanlı istekleri serileşir, ikincisi ilkinin sonucunu
-- görür. Süreli eşyada bilinçli aralıklı iki satın alma yine mümkündür
-- (bu bir özellik: süre üste eklenir); çift DOKUNUŞUN kendisi istemcide
-- ayrıca in-flight kilidiyle engelleniyor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) esya_satin_al — kullanıcı satırı kilidi (062'deki sürümün üstüne;
--    eklenen tek şey PERFORM ... FOR UPDATE satırı)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esya_satin_al(p_esya_id TEXT)
RETURNS TABLE (elmas BIGINT, altin BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben        BIGINT := public.benim_kullanici_id();
    v_esya       public.esyalar%ROWTYPE;
    v_mevcut     public.kullanici_esyalari%ROWTYPE;
    v_yeni_bitis TIMESTAMPTZ;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    -- 074: aynı kullanıcının eşzamanlı satın almaları SERİLEŞSİN. İkinci
    -- çağrı ilki commit'leninceye kadar burada bekler ve aşağıdaki "zaten
    -- sende mi?" kontrolünü ilkinin SONUCUNA bakarak yapar.
    PERFORM 1 FROM public.kullanicilar WHERE id = v_ben FOR UPDATE;

    SELECT * INTO v_esya FROM public.esyalar WHERE id = p_esya_id AND aktif;
    IF NOT FOUND THEN RAISE EXCEPTION 'Eşya bulunamadı.'; END IF;

    SELECT * INTO v_mevcut
      FROM public.kullanici_esyalari
     WHERE kullanici_id = v_ben AND esya_id = p_esya_id;

    -- Süresiz eşyayı ikinci kez satmayalım.
    IF FOUND AND v_mevcut.bitis IS NULL THEN
        RAISE EXCEPTION 'Bu eşya zaten sende.';
    END IF;

    PERFORM public._altin_harca(v_ben, v_esya.fiyat_altin, 'esya:' || v_esya.id);

    -- Süreli eşyada: kalan süre varsa üstüne eklenir, yoksa bugünden başlar.
    IF v_esya.sure_gun IS NULL THEN
        v_yeni_bitis := NULL;
    ELSE
        v_yeni_bitis := GREATEST(now(), COALESCE(v_mevcut.bitis, now()))
                        + (v_esya.sure_gun || ' days')::INTERVAL;
    END IF;

    INSERT INTO public.kullanici_esyalari (kullanici_id, esya_id, bitis)
    VALUES (v_ben, p_esya_id, v_yeni_bitis)
    ON CONFLICT (kullanici_id, esya_id) DO UPDATE
        SET bitis = EXCLUDED.bitis;

    RETURN QUERY
        SELECT COALESCE(k.cached_total_balance, 0), COALESCE(k.cached_altin_balance, 0)
          FROM public.kullanicilar k WHERE k.id = v_ben;
END; $$;
REVOKE ALL ON FUNCTION public.esya_satin_al(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.esya_satin_al(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) gunluk_giris_al — ilk gün yarışında çift ödül kapanıyor (061'deki
--    sürümün üstüne; değişen tek şey ON CONFLICT'in koşullanması)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gunluk_giris_al()
RETURNS TABLE (gun_no SMALLINT, odul BIGINT, altin BIGINT, seri INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben     BIGINT := public.benim_kullanici_id();
    v_kayit   public.kullanici_gunluk_giris%ROWTYPE;
    v_bugun   DATE := public._bugun_tr();
    v_gun     SMALLINT;
    v_seri    INTEGER;
    v_odul    BIGINT;
    v_bakiye  BIGINT;
    v_yazildi INT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    SELECT * INTO v_kayit FROM public.kullanici_gunluk_giris
     WHERE kullanici_id = v_ben FOR UPDATE;

    IF FOUND AND v_kayit.son_giris_tarihi = v_bugun THEN
        RAISE EXCEPTION 'Bugünün ödülü zaten alındı.';
    END IF;

    IF FOUND AND v_kayit.son_giris_tarihi = v_bugun - 1 THEN
        v_gun  := (v_kayit.son_alinan_gun % 7) + 1;
        v_seri := v_kayit.mevcut_seri + 1;
    ELSE
        v_gun  := 1;
        v_seri := 1;
    END IF;

    SELECT o.miktar INTO v_odul FROM public.gunluk_giris_odulleri o WHERE o.gun_no = v_gun;
    IF v_odul IS NULL THEN RAISE EXCEPTION 'Gün ödülü tanımlı değil.'; END IF;

    -- 074: satır YOKKEN iki eşzamanlı çağrıda FOR UPDATE hiçbir şey
    -- kilitlemiyor; kaybedenin INSERT'i buradaki DO UPDATE'e düşer. Koşul
    -- sayesinde bugünü zaten yazmış satırı GÜNCELLEMEZ (0 satır) ve çift
    -- _odul_ver imkânsızlaşır. (gorev_odul_al'daki kanıtlanmış desen.)
    INSERT INTO public.kullanici_gunluk_giris
        (kullanici_id, mevcut_seri, son_alinan_gun, son_giris_tarihi)
    VALUES (v_ben, v_seri, v_gun, v_bugun)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET mevcut_seri = EXCLUDED.mevcut_seri,
            son_alinan_gun = EXCLUDED.son_alinan_gun,
            son_giris_tarihi = EXCLUDED.son_giris_tarihi
      WHERE kullanici_gunluk_giris.son_giris_tarihi IS DISTINCT FROM EXCLUDED.son_giris_tarihi;
    GET DIAGNOSTICS v_yazildi = ROW_COUNT;
    IF v_yazildi = 0 THEN RAISE EXCEPTION 'Bugünün ödülü zaten alındı.'; END IF;

    v_bakiye := public._odul_ver(v_ben, v_odul, 'gunluk_giris');
    RETURN QUERY SELECT v_gun, v_odul, COALESCE(v_bakiye, 0), v_seri;
END; $$;
REVOKE ALL ON FUNCTION public.gunluk_giris_al() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gunluk_giris_al() TO authenticated;
