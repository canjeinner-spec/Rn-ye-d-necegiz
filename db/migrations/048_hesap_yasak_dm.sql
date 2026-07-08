-- ============================================================================
-- 048_hesap_yasak_dm.sql — Hesap yasağı verilince/kalkınca hedefli Sistem DM'i
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 035 (hesap_yasak) + 041 (sistem_duyurulari) + 043 (hedefli
-- mesaj kolonları: hedef_kullanici_id + tur) 'ten SONRA.
--
-- Amaç: Bir hesap yasaklandığında, o kişiye DM'deki "Sistem" kanalında
-- kalıcı bir kayıt (sebep + süre + detay) bırakılsın. Yasaklıyken uygulamayı
-- hiç açamadığı için bu mesajı ANCAK yasağı kalkınca görür — istenen davranış.
-- Yasak kalkınca da bir "yasağın kaldırıldı" mesajı bırakılır.
--
-- Sadece 035'teki hesap_yasak_ver / hesap_yasak_kaldir gövdeleri, DM ekleyecek
-- şekilde OR REPLACE edilir (imza aynı — mevcut çağrılar bozulmaz).
-- ============================================================================

-- ---- RPC: hesap yasağı ver (+ hedefli Sistem DM) ---------------------------
CREATE OR REPLACE FUNCTION public.hesap_yasak_ver(p_hedef BIGINT, p_sebep TEXT DEFAULT NULL, p_dakika INT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_bitis TIMESTAMPTZ;
    v_hedef TEXT;
    v_sure  TEXT;
    v_icerik TEXT;
    v_duyuru BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Hesap yasağı için yönetici olmalısın.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendini yasaklayamazsın.';
    END IF;
    -- Yöneticiyi yalnızca developer yasaklayabilir (super_admin süper_admin/dev yasaklayamaz)
    SELECT ekonomi_rolu::text INTO v_hedef FROM public.kullanicilar WHERE id = p_hedef;
    IF v_hedef IN ('developer', 'super_admin') AND NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Yöneticiyi yalnızca developer yasaklayabilir.';
    END IF;
    IF p_dakika IS NOT NULL THEN
        IF p_dakika <= 0 THEN RAISE EXCEPTION 'Süre pozitif olmalı (ya da kalıcı için boş bırak).'; END IF;
        v_bitis := now() + make_interval(mins => p_dakika);
    END IF;
    INSERT INTO public.hesap_yasaklari (kullanici_id, sebep, yasaklayan_id, bitis)
    VALUES (p_hedef, p_sebep, public.benim_kullanici_id(), v_bitis)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET sebep = EXCLUDED.sebep, yasaklayan_id = EXCLUDED.yasaklayan_id,
            bitis = EXCLUDED.bitis, olusturma = now();
    PERFORM public._yonetici_log('kullanici', p_hedef, 'hesap_yasak_ver',
        (CASE WHEN v_bitis IS NULL THEN 'Kalıcı' ELSE to_char(v_bitis, 'YYYY-MM-DD HH24:MI') END)
        || COALESCE(' · ' || p_sebep, ''));

    -- Hedefe kalıcı Sistem DM'i (yasağı kalkınca görür). tur='uyari'.
    v_sure := CASE WHEN v_bitis IS NULL THEN 'süresiz (kalıcı) olarak'
                   ELSE to_char(v_bitis, 'DD.MM.YYYY HH24:MI') || ' tarihine kadar' END;
    v_icerik := 'Hesabın ' || v_sure || ' askıya alındı.'
                || COALESCE(E'\n\nSebep: ' || NULLIF(trim(COALESCE(p_sebep, '')), ''), '')
                || E'\n\nYasak süresince uygulamayı kullanamazsın. Bir hata olduğunu düşünüyorsan destek ekibiyle iletişime geçebilirsin.';
    INSERT INTO public.sistem_duyurulari (kanal, baslik, icerik, gonderen_id, hedef_kullanici_id, tur)
    VALUES ('sistem', 'Hesabın askıya alındı', v_icerik, public.benim_kullanici_id(), p_hedef, 'uyari')
    RETURNING id INTO v_duyuru;
    INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
    VALUES (p_hedef, 'sistem', 'Hesabın askıya alındı', v_icerik,
            jsonb_build_object('duyuru', v_duyuru, 'kanal', 'sistem', 'tur', 'uyari'));
END; $$;
REVOKE ALL ON FUNCTION public.hesap_yasak_ver(BIGINT, TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.hesap_yasak_ver(BIGINT, TEXT, INT) TO authenticated;

-- ---- RPC: hesap yasağı kaldır (+ "yasağın kaldırıldı" Sistem DM'i) ----------
CREATE OR REPLACE FUNCTION public.hesap_yasak_kaldir(p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_duyuru BIGINT; v_vardi BOOLEAN;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yasak kaldırma için yönetici olmalısın.';
    END IF;
    DELETE FROM public.hesap_yasaklari WHERE kullanici_id = p_hedef;
    GET DIAGNOSTICS v_vardi = ROW_COUNT;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'hesap_yasak_kaldir', NULL);

    -- Yalnızca gerçekten bir yasak kaldırıldıysa bilgilendirme DM'i bırak.
    IF v_vardi THEN
        INSERT INTO public.sistem_duyurulari (kanal, baslik, icerik, gonderen_id, hedef_kullanici_id, tur)
        VALUES ('sistem', 'Yasağın kaldırıldı',
                'Hesap yasağın yönetim tarafından kaldırıldı. Tekrar hoş geldin — lütfen platform kurallarına uymaya özen göster.',
                public.benim_kullanici_id(), p_hedef, 'mesaj')
        RETURNING id INTO v_duyuru;
        INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
        VALUES (p_hedef, 'sistem', 'Yasağın kaldırıldı',
                'Hesap yasağın kaldırıldı, tekrar giriş yapabilirsin.',
                jsonb_build_object('duyuru', v_duyuru, 'kanal', 'sistem', 'tur', 'mesaj'));
    END IF;
END; $$;
REVOKE ALL ON FUNCTION public.hesap_yasak_kaldir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.hesap_yasak_kaldir(BIGINT) TO authenticated;
