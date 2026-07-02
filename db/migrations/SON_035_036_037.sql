-- SON_035_036_037.sql — 034'e kadar çalıştırıldıysa yalnızca bunu çalıştır.
-- (Tam HEPSI'yi tekrar çalıştırma: 029'un eski imzası 036'nın yeni imzasıyla
--  çakışıp 42P13 verir. 036 burada DROP FUNCTION ile bunu çözer.)

-- ===== 035_hesap_yasak =====
CREATE TABLE IF NOT EXISTS public.hesap_yasaklari (
    kullanici_id  BIGINT      PRIMARY KEY REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    sebep         TEXT,
    yasaklayan_id BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    bitis         TIMESTAMPTZ,
    olusturma     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hesap_yasaklari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hesap_yasaklari FROM anon, authenticated;
GRANT SELECT ON public.hesap_yasaklari TO authenticated;

DROP POLICY IF EXISTS hesap_yasak_select ON public.hesap_yasaklari;
CREATE POLICY hesap_yasak_select ON public.hesap_yasaklari
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

CREATE OR REPLACE FUNCTION public.hesap_yasak_ver(p_hedef BIGINT, p_sebep TEXT DEFAULT NULL, p_dakika INT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bitis TIMESTAMPTZ; v_hedef TEXT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Hesap yasağı için yönetici olmalısın.'; END IF;
    IF p_hedef = public.benim_kullanici_id() THEN RAISE EXCEPTION 'Kendini yasaklayamazsın.'; END IF;
    SELECT ekonomi_rolu::text INTO v_hedef FROM public.kullanicilar WHERE id = p_hedef;
    IF v_hedef IN ('developer', 'super_admin') AND NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Yöneticiyi yalnızca developer yasaklayabilir.'; END IF;
    IF p_dakika IS NOT NULL THEN
        IF p_dakika <= 0 THEN RAISE EXCEPTION 'Süre pozitif olmalı.'; END IF;
        v_bitis := now() + make_interval(mins => p_dakika);
    END IF;
    INSERT INTO public.hesap_yasaklari (kullanici_id, sebep, yasaklayan_id, bitis)
    VALUES (p_hedef, p_sebep, public.benim_kullanici_id(), v_bitis)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET sebep = EXCLUDED.sebep, yasaklayan_id = EXCLUDED.yasaklayan_id, bitis = EXCLUDED.bitis, olusturma = now();
    PERFORM public._yonetici_log('kullanici', p_hedef, 'hesap_yasak_ver',
        (CASE WHEN v_bitis IS NULL THEN 'Kalıcı' ELSE to_char(v_bitis, 'YYYY-MM-DD HH24:MI') END) || COALESCE(' · ' || p_sebep, ''));
END; $$;
REVOKE ALL ON FUNCTION public.hesap_yasak_ver(BIGINT, TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.hesap_yasak_ver(BIGINT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.hesap_yasak_kaldir(p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yasak kaldırma için yönetici olmalısın.'; END IF;
    DELETE FROM public.hesap_yasaklari WHERE kullanici_id = p_hedef;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'hesap_yasak_kaldir', NULL);
END; $$;
REVOKE ALL ON FUNCTION public.hesap_yasak_kaldir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.hesap_yasak_kaldir(BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.benim_hesap_yasagim()
RETURNS TABLE (sebep TEXT, bitis TIMESTAMPTZ, kalici BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT h.sebep, h.bitis, (h.bitis IS NULL)
      FROM public.hesap_yasaklari h
     WHERE h.kullanici_id = public.benim_kullanici_id()
       AND (h.bitis IS NULL OR h.bitis > now());
$$;
REVOKE ALL ON FUNCTION public.benim_hesap_yasagim() FROM public;
GRANT EXECUTE ON FUNCTION public.benim_hesap_yasagim() TO authenticated;

-- ===== 036_oda_yonet =====
CREATE OR REPLACE FUNCTION public.admin_oda_getir(p_oda BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, ad TEXT, aciklama TEXT, kategori TEXT, kapak_url TEXT,
    herkese_acik BOOLEAN, olusturan_id BIGINT, sahip_ad TEXT, sahip_public_id TEXT,
    uye_sayisi BIGINT, aktif_katilimci INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    RETURN QUERY
    SELECT o.id::bigint, o.public_id::text, o.ad::text, o.aciklama::text, o.kategori::text, o.kapak_url::text,
           o.herkese_acik::boolean, o.olusturan_id::bigint, k.kullanici_adi::text, k.public_id::text,
           (SELECT count(*) FROM public.oda_uyeleri u WHERE u.oda_id = o.id)::bigint,
           o.aktif_katilimci_sayisi::int
      FROM public.odalar o
      LEFT JOIN public.kullanicilar k ON k.id = o.olusturan_id
     WHERE o.id = p_oda;
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_getir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_oda_getir(BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_oda_guncelle(p_oda BIGINT, p_ad TEXT, p_aciklama TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    IF p_ad IS NULL OR length(trim(p_ad)) = 0 THEN RAISE EXCEPTION 'Oda adı boş olamaz.'; END IF;
    UPDATE public.odalar SET ad = trim(p_ad), aciklama = NULLIF(trim(COALESCE(p_aciklama, '')), '') WHERE id = p_oda;
    PERFORM public._yonetici_log('oda', p_oda, 'oda_guncelle', 'Ad: ' || trim(p_ad));
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_guncelle(BIGINT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_oda_guncelle(BIGINT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_oda_public_id_degistir(p_oda BIGINT, p_yeni TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_eski TEXT;
BEGIN
    IF NOT public.ben_developer() THEN RAISE EXCEPTION 'Oda ID değişimi yalnızca developer yetkisiyle yapılır.'; END IF;
    IF p_yeni IS NULL OR length(trim(p_yeni)) = 0 THEN RAISE EXCEPTION 'Geçersiz ID.'; END IF;
    IF EXISTS (SELECT 1 FROM public.odalar WHERE public_id = trim(p_yeni) AND id <> p_oda) THEN
        RAISE EXCEPTION 'Bu oda ID zaten kullanımda.'; END IF;
    SELECT public_id INTO v_eski FROM public.odalar WHERE id = p_oda;
    UPDATE public.odalar SET public_id = trim(p_yeni) WHERE id = p_oda;
    PERFORM public._yonetici_log('oda', p_oda, 'oda_id_degistir', COALESCE(v_eski, '?') || ' → ' || trim(p_yeni));
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_public_id_degistir(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_oda_public_id_degistir(BIGINT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_kullanici_getir(BIGINT);
CREATE FUNCTION public.admin_kullanici_getir(p_hedef BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, kullanici_adi TEXT, profil_resmi TEXT,
    email TEXT, rol TEXT, seviye_id INT, deneyim_puani BIGINT,
    elmas BIGINT, altin BIGINT, elmas_dondu BOOLEAN, altin_dondu BOOLEAN,
    mic_yasakli BOOLEAN, mic_sebep TEXT, mic_bitis TIMESTAMPTZ,
    hesap_yasakli BOOLEAN, hesap_sebep TEXT, hesap_bitis TIMESTAMPTZ,
    rapor_sayisi BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    RETURN QUERY
    SELECT
        k.id::bigint, k.public_id::text, k.kullanici_adi::text, k.profil_resmi::text,
        (CASE WHEN public.ben_developer() THEN k.email ELSE NULL END)::text,
        k.ekonomi_rolu::text, k.seviye_id::int, COALESCE(k.deneyim_puani, 0)::bigint,
        COALESCE(c.elmas, 0)::bigint, COALESCE(c.altin, 0)::bigint,
        COALESCE(c.elmas_dondu, FALSE)::boolean, COALESCE(c.altin_dondu, FALSE)::boolean,
        (m.kullanici_id IS NOT NULL AND (m.bitis IS NULL OR m.bitis > now()))::boolean,
        m.sebep::text, m.bitis::timestamptz,
        (h.kullanici_id IS NOT NULL AND (h.bitis IS NULL OR h.bitis > now()))::boolean,
        h.sebep::text, h.bitis::timestamptz,
        (SELECT count(*) FROM public.sikayetler s WHERE s.hedef_kullanici_id = k.id)::bigint
    FROM public.kullanicilar k
    LEFT JOIN public.cuzdan c ON c.kullanici_id = k.id
    LEFT JOIN public.mic_yasaklari m ON m.kullanici_id = k.id
    LEFT JOIN public.hesap_yasaklari h ON h.kullanici_id = k.id
    WHERE k.id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.admin_kullanici_getir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_getir(BIGINT) TO authenticated;

-- ===== 037_realtime_yasak =====
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN RETURN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='hesap_yasaklari') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hesap_yasaklari; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mic_yasaklari') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.mic_yasaklari; END IF;
END $$;
ALTER TABLE public.hesap_yasaklari REPLICA IDENTITY FULL;
ALTER TABLE public.mic_yasaklari REPLICA IDENTITY FULL;
