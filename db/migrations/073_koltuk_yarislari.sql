-- ============================================================================
-- 073_koltuk_yarislari.sql — Eşzamanlı oturma/onay aynı koltuğu ezebiliyordu
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 072'den SONRA. İdempotent (CREATE OR REPLACE, imzalar aynı).
--
-- NEDEN (yarış koşulları):
--   • `koltuga_otur`: ön kontrol (SELECT "dolu mu?") ile yazma (INSERT ... ON
--     CONFLICT DO UPDATE) arasında pencere vardı. İki kişi aynı boş koltuğa
--     aynı anda basarsa ikisi de kontrolü geçiyor, SON YAZAN kazanıyor ve
--     ilk oturan SESSİZCE düşüyordu.
--   • `mic_sirasi_onayla`: koltuk verilen dalda UPDATE koşulsuzdu → onay,
--     araya oturan birini ezebiliyordu. Koltuk verilmeyen dalda iki eşzamanlı
--     onay aynı MIN(koltuk_no)'yu seçebiliyordu.
--
-- ÇÖZÜM: yazma anında koşul + ROW_COUNT kontrolü. Başarı yolu DEĞİŞMİYOR;
-- yalnız yarış anında sessiz kayıp yerine görünür 'Koltuk dolu.' hatası
-- üretiliyor (istemci bu mesajı zaten işliyor). Hata fonksiyonun tamamını
-- geri aldığı için eski koltuktan kalkma da iptal olur — kullanıcı yerinde
-- kalır, hiçbir şey kaybetmez.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) koltuga_otur — yazma koşullu, kaybeden 'Koltuk dolu.' görür
--    (069'daki sürümün üstüne; tek değişen blok en sondaki INSERT.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.koltuga_otur(p_oda BIGINT, p_koltuk SMALLINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben     BIGINT := public.benim_kullanici_id();
    v_sahip   BIGINT;
    v_kilitli BOOLEAN;
    v_dolu    BIGINT;
    v_yazildi INT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_koltuk < 1 OR p_koltuk > 20 THEN RAISE EXCEPTION 'Geçersiz koltuk.'; END IF;

    SELECT o.olusturan_id INTO v_sahip
      FROM public.odalar o WHERE o.id = p_oda AND NOT o.silinmis;
    IF v_sahip IS NULL THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

    IF p_koltuk = 20 AND v_sahip <> v_ben THEN
        RAISE EXCEPTION 'Bu koltuk oda sahibine ait.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.oda_yasaklari y
                WHERE y.oda_id = p_oda AND y.kullanici_id = v_ben) THEN
        RAISE EXCEPTION 'Bu odada yasaklısın.';
    END IF;

    -- 069: platform mikrofon yasağı (028). Eskiden yalnız istemci bakıyordu.
    IF EXISTS (SELECT 1 FROM public.mic_yasaklari m
                WHERE m.kullanici_id = v_ben
                  AND (m.bitis IS NULL OR m.bitis > now())) THEN
        RAISE EXCEPTION 'Mikrofon yasağın var.';
    END IF;

    SELECT k.kilitli, k.kullanici_id INTO v_kilitli, v_dolu
      FROM public.oda_koltuklari k
     WHERE k.oda_id = p_oda AND k.koltuk_no = p_koltuk;

    IF COALESCE(v_kilitli, FALSE) AND v_sahip <> v_ben
       AND NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bu koltuk kilitli.';
    END IF;

    IF v_dolu IS NOT NULL AND v_dolu <> v_ben THEN
        RAISE EXCEPTION 'Koltuk dolu.';
    END IF;

    UPDATE public.oda_koltuklari
       SET kullanici_id = NULL, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND kullanici_id = v_ben AND koltuk_no <> p_koltuk;

    -- 073: yazma KOŞULLU. Yukarıdaki "dolu mu?" kontrolüyle bu yazma arasında
    -- başka biri oturmuş olabilir; DO UPDATE'in WHERE'i o durumda 0 satır
    -- günceller ve kaybeden görünür bir hata alır (sessiz ezme yok).
    INSERT INTO public.oda_koltuklari (oda_id, koltuk_no, kullanici_id, susturulmus, guncellenme_tarihi)
    VALUES (p_oda, p_koltuk, v_ben, FALSE, now())
    ON CONFLICT (oda_id, koltuk_no) DO UPDATE
        SET kullanici_id       = EXCLUDED.kullanici_id,
            susturulmus        = FALSE,
            guncellenme_tarihi = now()
      WHERE oda_koltuklari.kullanici_id IS NULL
         OR oda_koltuklari.kullanici_id = EXCLUDED.kullanici_id;
    GET DIAGNOSTICS v_yazildi = ROW_COUNT;
    IF v_yazildi = 0 THEN RAISE EXCEPTION 'Koltuk dolu.'; END IF;

    -- Koltuğa oturan sırada bekliyorsa sıradan düşer. (Tablo bu fonksiyondan
    -- önce kuruluyor — EXCEPTION yakalayıcı koyma; PL/pgSQL'de yakalanan hata
    -- bloğun tamamını geri alır, oturma da iptal olurdu.)
    DELETE FROM public.oda_mic_sirasi
     WHERE oda_id = p_oda AND kullanici_id = v_ben;
END; $fn$;
REVOKE ALL ON FUNCTION public.koltuga_otur(BIGINT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuga_otur(BIGINT, SMALLINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) mic_sirasi_onayla — onay oturanı ezemez; iki onay aynı koltuğu seçemez
--    (071'deki sürümün üstüne; değişen yerler işaretli.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_sirasi_onayla(
    p_oda    BIGINT,
    p_hedef  BIGINT,
    p_koltuk SMALLINT DEFAULT NULL)
RETURNS SMALLINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_koltuk  SMALLINT;
    v_kilitli BOOLEAN;
    v_dolu    BIGINT;
    v_yazildi INT;
BEGIN
    IF public.benim_kullanici_id() IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF NOT public._oda_moderatoru(p_oda) THEN
        RAISE EXCEPTION 'Bu işlem için oda yetkilisi olmalısın.';
    END IF;

    -- Hedef zaten koltuktaysa yalnız sıradan düşür.
    IF EXISTS (SELECT 1 FROM public.oda_koltuklari k
                WHERE k.oda_id = p_oda AND k.kullanici_id = p_hedef) THEN
        DELETE FROM public.oda_mic_sirasi WHERE oda_id = p_oda AND kullanici_id = p_hedef;
        RETURN NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM public.mic_yasaklari m
                WHERE m.kullanici_id = p_hedef
                  AND (m.bitis IS NULL OR m.bitis > now())) THEN
        RAISE EXCEPTION 'Bu kullanıcının mikrofon yasağı var.';
    END IF;

    IF p_koltuk IS NULL THEN
        -- 073: MIN yerine kilitli satır atlayan seçim — iki eşzamanlı onay
        -- aynı koltuğu SEÇEMEZ (kaybeden bir sonraki boş koltuğu alır).
        SELECT k.koltuk_no INTO v_koltuk
          FROM public.oda_koltuklari k
         WHERE k.oda_id = p_oda
           AND k.kullanici_id IS NULL
           AND NOT k.kilitli
           AND k.koltuk_no BETWEEN 1 AND 19
         ORDER BY k.koltuk_no
           FOR UPDATE SKIP LOCKED
         LIMIT 1;
        IF v_koltuk IS NULL THEN RAISE EXCEPTION 'Boş koltuk yok.'; END IF;
    ELSE
        IF p_koltuk < 1 OR p_koltuk > 19 THEN RAISE EXCEPTION 'Geçersiz koltuk.'; END IF;
        SELECT k.kilitli, k.kullanici_id INTO v_kilitli, v_dolu
          FROM public.oda_koltuklari k
         WHERE k.oda_id = p_oda AND k.koltuk_no = p_koltuk;
        IF NOT FOUND THEN RAISE EXCEPTION 'Koltuk bulunamadı.'; END IF;
        IF COALESCE(v_kilitli, FALSE) THEN RAISE EXCEPTION 'Bu koltuk kilitli.'; END IF;
        IF v_dolu IS NOT NULL THEN RAISE EXCEPTION 'Koltuk dolu.'; END IF;
        v_koltuk := p_koltuk;
    END IF;

    -- 073: yazma KOŞULLU — ön kontrolle bu satır arasında koltuğa biri
    -- oturduysa/kilitlendiyse 0 satır güncellenir, onay ezmek yerine
    -- görünür hata verir.
    UPDATE public.oda_koltuklari
       SET kullanici_id = p_hedef, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND koltuk_no = v_koltuk
       AND kullanici_id IS NULL AND NOT kilitli;
    GET DIAGNOSTICS v_yazildi = ROW_COUNT;
    IF v_yazildi = 0 THEN RAISE EXCEPTION 'Koltuk dolu.'; END IF;

    DELETE FROM public.oda_mic_sirasi WHERE oda_id = p_oda AND kullanici_id = p_hedef;
    RETURN v_koltuk;
END; $fn$;
REVOKE ALL ON FUNCTION public.mic_sirasi_onayla(BIGINT, BIGINT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mic_sirasi_onayla(BIGINT, BIGINT, SMALLINT) TO authenticated;
