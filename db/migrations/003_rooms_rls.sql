-- ============================================================================
-- 003_rooms_rls.sql — odalar: RLS policy + kolon yetkileri (Faz 2)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001 ve 002'den SONRA (Supabase SQL Editor).
--
-- Ne yapar:
--   • auth.uid() → kullanicilar.id eşlemesi için yardımcı fonksiyon
--   • odalar tablosunda client'a yalnızca güvenli kolonları açar (sifre_hash gizli)
--   • Okuma: herkese açık & silinmemiş odalar + kendi odaların
--   • Yazma: yalnızca kendi adına oda oluştur/güncelle
-- ============================================================================

-- auth.uid() → kullanicilar.id (BIGINT). SECURITY DEFINER: RLS'i bypass eder.
CREATE OR REPLACE FUNCTION public.benim_kullanici_id()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT id FROM public.kullanicilar WHERE auth_uid = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.benim_kullanici_id() TO authenticated;

-- Kolon yetkileri: sifre_hash / silen_id vb. ASLA client'a açılmaz.
REVOKE ALL ON public.odalar FROM anon, authenticated;

GRANT SELECT (
    id, public_id, ad, aciklama, kategori, kapak_url, herkese_acik,
    olusturan_id, oda_seviyesi_id, toplam_deneyim, koltuk_sayisi,
    temel_kapasite, aktif_katilimci_sayisi, olusturulma_tarihi
) ON public.odalar TO authenticated;

GRANT INSERT (
    public_id, ad, aciklama, kategori, kapak_url, herkese_acik,
    olusturan_id, koltuk_sayisi
) ON public.odalar TO authenticated;

GRANT UPDATE (
    ad, aciklama, kategori, kapak_url, herkese_acik
) ON public.odalar TO authenticated;

-- BIGSERIAL default'u (nextval) için sıra kullanım yetkisi.
GRANT USAGE, SELECT ON SEQUENCE odalar_id_seq TO authenticated;

-- ---- Policy'ler (RLS 001'de zaten açıldı) ----------------------------------
DROP POLICY IF EXISTS odalar_select ON public.odalar;
CREATE POLICY odalar_select ON public.odalar
    FOR SELECT TO authenticated
    USING (
        silinmis = FALSE
        AND (herkese_acik = TRUE OR olusturan_id = public.benim_kullanici_id())
    );

DROP POLICY IF EXISTS odalar_insert ON public.odalar;
CREATE POLICY odalar_insert ON public.odalar
    FOR INSERT TO authenticated
    WITH CHECK (olusturan_id = public.benim_kullanici_id());

DROP POLICY IF EXISTS odalar_update ON public.odalar;
CREATE POLICY odalar_update ON public.odalar
    FOR UPDATE TO authenticated
    USING (olusturan_id = public.benim_kullanici_id())
    WITH CHECK (olusturan_id = public.benim_kullanici_id());
