-- ============================================================================
-- 028_mic_yasak.sql — Platform geneli mikrofon yasağı (yönetici cezası)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
-- Oda içi sustur/at (host/yardımcı) ayrı ve o odayla sınırlı (021/022).
-- BU yasak platform genelidir: yasaklı kullanıcı HER odaya girip dinler ama
-- HİÇBİR odada yazamaz / mikrofona çıkamaz. Yalnızca developer/super_admin.
--   • mic_yasaklari: kişi başına tek aktif kayıt; bitis NULL = kalıcı.
--   • mic_yasak_ver(hedef, sebep, dakika): dakika NULL → kalıcı.
--   • mic_yasak_kaldir(hedef).
--   • benim_mic_yasagim(): aktif yasağı (sebep, bitis) döndürür.
-- benim_kullanici_id() 003, ben_platform_yoneticisi() 021.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mic_yasaklari (
    kullanici_id  BIGINT      PRIMARY KEY REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    sebep         TEXT,
    yasaklayan_id BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    bitis         TIMESTAMPTZ, -- NULL = kalıcı
    olusturma     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mic_yasaklari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mic_yasaklari FROM anon, authenticated;
GRANT SELECT ON public.mic_yasaklari TO authenticated;

-- Herkes okuyabilir (kişi kendi yasağını görebilsin; yönetim listeleyebilsin)
DROP POLICY IF EXISTS mic_yasak_select ON public.mic_yasaklari;
CREATE POLICY mic_yasak_select ON public.mic_yasaklari
    FOR SELECT TO authenticated USING (TRUE);

-- ---- RPC: yasak ver ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_yasak_ver(p_hedef BIGINT, p_sebep TEXT DEFAULT NULL, p_dakika INT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bitis TIMESTAMPTZ;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Mic yasağı için yönetici olmalısın.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendine mic yasağı veremezsin.';
    END IF;
    IF p_dakika IS NOT NULL THEN
        IF p_dakika <= 0 THEN RAISE EXCEPTION 'Süre pozitif olmalı (ya da kalıcı için boş bırak).'; END IF;
        v_bitis := now() + make_interval(mins => p_dakika);
    END IF;
    INSERT INTO public.mic_yasaklari (kullanici_id, sebep, yasaklayan_id, bitis)
    VALUES (p_hedef, p_sebep, public.benim_kullanici_id(), v_bitis)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET sebep = EXCLUDED.sebep, yasaklayan_id = EXCLUDED.yasaklayan_id,
            bitis = EXCLUDED.bitis, olusturma = now();
END; $$;
REVOKE ALL ON FUNCTION public.mic_yasak_ver(BIGINT, TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.mic_yasak_ver(BIGINT, TEXT, INT) TO authenticated;

-- ---- RPC: yasak kaldır ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_yasak_kaldir(p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yasak kaldırma için yönetici olmalısın.';
    END IF;
    DELETE FROM public.mic_yasaklari WHERE kullanici_id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.mic_yasak_kaldir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.mic_yasak_kaldir(BIGINT) TO authenticated;

-- ---- RPC: kendi aktif yasağım (bitmişse yok sayılır) ------------------------
CREATE OR REPLACE FUNCTION public.benim_mic_yasagim()
RETURNS TABLE (sebep TEXT, bitis TIMESTAMPTZ, kalici BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT m.sebep, m.bitis, (m.bitis IS NULL)
      FROM public.mic_yasaklari m
     WHERE m.kullanici_id = public.benim_kullanici_id()
       AND (m.bitis IS NULL OR m.bitis > now());
$$;
REVOKE ALL ON FUNCTION public.benim_mic_yasagim() FROM public;
GRANT EXECUTE ON FUNCTION public.benim_mic_yasagim() TO authenticated;
