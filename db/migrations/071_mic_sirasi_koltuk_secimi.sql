-- ============================================================================
-- 071_mic_sirasi_koltuk_secimi.sql — Sırayı onaylayan koltuğu da seçsin
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 069'dan SONRA. İdempotent.
--
-- NEDEN: 069'daki `mic_sirasi_onayla` koltuğu sunucuda kendi seçiyordu (ilk boş
-- ve kilitsiz). "Al" tek dokunuşta bitsin diyeydi, ama sahnenin düzenini
-- yönetici kuruyor: kimin nerede oturacağına o karar vermeli. Mikrofona davet
-- akışında koltuğu zaten davet eden seçiyor; sıra onayı da aynı olsun.
--
-- Koltuk seçimi ONAYLAYANIN (host/yardımcı) elinde; sıraya giren kişiye
-- sorulmuyor — istek atan yalnızca "beni al" diyor.
--
-- NOT: 069'daki iki argümanlı sürüm DROP ediliyor. Varsayılan değerli üçüncü
-- argüman eklemek, iki argümanlı çağrıyı BELİRSİZ hale getirirdi (PostgreSQL
-- "function is not unique" hatası verir).
-- ============================================================================

DROP FUNCTION IF EXISTS public.mic_sirasi_onayla(BIGINT, BIGINT);

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
        -- Eski davranış: ilk boş ve kilitsiz koltuk.
        SELECT MIN(k.koltuk_no) INTO v_koltuk
          FROM public.oda_koltuklari k
         WHERE k.oda_id = p_oda
           AND k.kullanici_id IS NULL
           AND NOT k.kilitli
           AND k.koltuk_no BETWEEN 1 AND 19;
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

    UPDATE public.oda_koltuklari
       SET kullanici_id = p_hedef, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND koltuk_no = v_koltuk;

    DELETE FROM public.oda_mic_sirasi WHERE oda_id = p_oda AND kullanici_id = p_hedef;
    RETURN v_koltuk;
END; $fn$;
REVOKE ALL ON FUNCTION public.mic_sirasi_onayla(BIGINT, BIGINT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mic_sirasi_onayla(BIGINT, BIGINT, SMALLINT) TO authenticated;
