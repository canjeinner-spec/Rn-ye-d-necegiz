-- ============================================================================
-- 030_sikayet_katilimci.sql — Oda raporuna "o an odadaki katılımcılar" snapshot'ı
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 023'ten SONRA (Supabase SQL Editor).
--
-- Bir oda raporlandığında, raporlayan client o anki presence listesini
-- ([{uid,name,publicId}]) bu kolona yazar. Yönetici rapor detayında kimin
-- o an odada olduğunu (avatar+ID) görüp işlem yapabilir.
-- INSERT grant'ine yeni kolon eklenir.
-- ============================================================================

ALTER TABLE public.sikayetler ADD COLUMN IF NOT EXISTS oda_katilimcilar JSONB;

GRANT INSERT (tip, raporlayan_id, hedef_kullanici_id, hedef_oda_id, neden, detay, oda_katilimcilar)
    ON public.sikayetler TO authenticated;
