-- ============================================================================
-- 018_visitors.sql — Ziyaretçiler: RLS + kayıt RPC + sayaç (profil_ziyaretleri)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003'ten SONRA (Supabase SQL Editor).
--
--   • Ziyaretçi listesi GİZLİ: yalnızca ziyaret EDİLEN kişi görür
--   • Kayıt RPC: her ziyaretçiden TEK satır tutulur (önce sil, sonra ekle) →
--     geçmiş bloat'ı olmaz, "en son ziyaret" zamanı korunur
--   • ziyaret_sayisi(): herkese açık sayaç (profil istatistiği)
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

REVOKE ALL ON public.profil_ziyaretleri FROM anon, authenticated;
GRANT SELECT (id, ziyaret_eden_id, ziyaret_edilen_id, ziyaret_tarihi) ON public.profil_ziyaretleri TO authenticated;

-- Sadece kendi ziyaretçilerini gör
DROP POLICY IF EXISTS ziyaret_select ON public.profil_ziyaretleri;
CREATE POLICY ziyaret_select ON public.profil_ziyaretleri
    FOR SELECT TO authenticated
    USING (ziyaret_edilen_id = public.benim_kullanici_id());

-- ---- Ziyaret kaydet (ziyaretçi başına tek satır) ---------------------------
CREATE OR REPLACE FUNCTION public.ziyaret_kaydet(p_edilen BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_me IS NULL OR p_edilen IS NULL OR v_me = p_edilen THEN RETURN; END IF;
    DELETE FROM public.profil_ziyaretleri WHERE ziyaret_eden_id = v_me AND ziyaret_edilen_id = p_edilen;
    INSERT INTO public.profil_ziyaretleri (ziyaret_eden_id, ziyaret_edilen_id) VALUES (v_me, p_edilen);
END; $$;
GRANT EXECUTE ON FUNCTION public.ziyaret_kaydet(BIGINT) TO authenticated;

-- ---- Ziyaretçi sayısı (herkese açık — profil istatistiği) -------------------
CREATE OR REPLACE FUNCTION public.ziyaret_sayisi(p_kullanici BIGINT)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT count(*)::int FROM public.profil_ziyaretleri WHERE ziyaret_edilen_id = p_kullanici;
$$;
GRANT EXECUTE ON FUNCTION public.ziyaret_sayisi(BIGINT) TO authenticated;
