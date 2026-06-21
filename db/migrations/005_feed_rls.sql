-- ============================================================================
-- 005_feed_rls.sql — gonderiler (akış): RLS policy + kolon yetkileri (Faz 2)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003'ten SONRA (Supabase SQL Editor).
--
-- Kapsam: yalnızca METİN gönderileri (paylaş + oku). Beğeni/yorum sonraki dilim.
--   • Okuma: herkese açık (kapsam='herkes') & silinmemiş + kendi gönderilerin
--   • Yazma: yalnızca kendi adına gönderi
-- benim_kullanici_id() 003'te tanımlandı.
-- ============================================================================

REVOKE ALL ON public.gonderiler FROM anon, authenticated;

GRANT SELECT (
    id, public_id, kullanici_id, icerik, kapsam,
    begeni_sayisi, yorum_sayisi, paylasim_sayisi, olusturulma_tarihi
) ON public.gonderiler TO authenticated;

GRANT INSERT (
    public_id, kullanici_id, icerik, kapsam
) ON public.gonderiler TO authenticated;

GRANT UPDATE (icerik) ON public.gonderiler TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE gonderiler_id_seq TO authenticated;

-- ---- Policy'ler (RLS 001'de açıldı) ----------------------------------------
DROP POLICY IF EXISTS gonderiler_select ON public.gonderiler;
CREATE POLICY gonderiler_select ON public.gonderiler
    FOR SELECT TO authenticated
    USING (
        silinmis = FALSE
        AND (kapsam = 'herkes' OR kullanici_id = public.benim_kullanici_id())
    );

DROP POLICY IF EXISTS gonderiler_insert ON public.gonderiler;
CREATE POLICY gonderiler_insert ON public.gonderiler
    FOR INSERT TO authenticated
    WITH CHECK (kullanici_id = public.benim_kullanici_id());

DROP POLICY IF EXISTS gonderiler_update ON public.gonderiler;
CREATE POLICY gonderiler_update ON public.gonderiler
    FOR UPDATE TO authenticated
    USING (kullanici_id = public.benim_kullanici_id())
    WITH CHECK (kullanici_id = public.benim_kullanici_id());
