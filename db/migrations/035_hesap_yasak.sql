-- ============================================================================
-- 035_hesap_yasak.sql — Hesap (uygulama geneli) yasağı
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021 + 033'ten SONRA (Supabase SQL Editor).
--
-- Mic yasağından farkı: mic yasaklı kullanıcı odaya girip dinleyebilir; HESAP
-- yasaklı kullanıcı uygulamayı HİÇ kullanamaz — açılışta tam ekran engelle
-- karşılaşır ve oturumu kapatılır. Yalnızca developer/super_admin.
--   • hesap_yasaklari: kişi başına tek aktif kayıt; bitis NULL = kalıcı.
--   • hesap_yasak_ver(hedef, sebep, dakika) / hesap_yasak_kaldir(hedef).
--   • benim_hesap_yasagim(): aktif yasağı (sebep, bitis) döndürür — açılışta
--     istemci bunu okur; doluysa engel gösterip çıkış yapar.
-- benim_kullanici_id() 003, ben_platform_yoneticisi() 021, _yonetici_log 033.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hesap_yasaklari (
    kullanici_id  BIGINT      PRIMARY KEY REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    sebep         TEXT,
    yasaklayan_id BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    bitis         TIMESTAMPTZ, -- NULL = kalıcı
    olusturma     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hesap_yasaklari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hesap_yasaklari FROM anon, authenticated;
GRANT SELECT ON public.hesap_yasaklari TO authenticated;

-- Kişi kendi yasağını görür (engel ekranı için); yönetici hepsini görür.
DROP POLICY IF EXISTS hesap_yasak_select ON public.hesap_yasaklari;
CREATE POLICY hesap_yasak_select ON public.hesap_yasaklari
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

-- ---- RPC: hesap yasağı ver --------------------------------------------------
CREATE OR REPLACE FUNCTION public.hesap_yasak_ver(p_hedef BIGINT, p_sebep TEXT DEFAULT NULL, p_dakika INT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bitis TIMESTAMPTZ; v_hedef TEXT;
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
END; $$;
REVOKE ALL ON FUNCTION public.hesap_yasak_ver(BIGINT, TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.hesap_yasak_ver(BIGINT, TEXT, INT) TO authenticated;

-- ---- RPC: hesap yasağı kaldır -----------------------------------------------
CREATE OR REPLACE FUNCTION public.hesap_yasak_kaldir(p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yasak kaldırma için yönetici olmalısın.';
    END IF;
    DELETE FROM public.hesap_yasaklari WHERE kullanici_id = p_hedef;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'hesap_yasak_kaldir', NULL);
END; $$;
REVOKE ALL ON FUNCTION public.hesap_yasak_kaldir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.hesap_yasak_kaldir(BIGINT) TO authenticated;

-- ---- RPC: kendi aktif hesap yasağım (bitmişse yok sayılır) ------------------
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
