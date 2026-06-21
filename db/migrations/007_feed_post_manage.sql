-- ============================================================================
-- 007_feed_post_manage.sql — Akış: sabitleme + düzenleme + silme (Faz 2)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 005-006'dan SONRA (Supabase SQL Editor).
--
--   • gonderiler.sabitlenmis kolonu (şemada yoktu) eklenir
--   • Kullanıcı kendi gönderisini: içerik düzenler, sabitler, siler (soft-delete)
--   • Yetkiler kendi satırına RLS update policy'siyle (006/003) zaten sınırlı
-- ============================================================================

ALTER TABLE public.gonderiler
    ADD COLUMN IF NOT EXISTS sabitlenmis BOOLEAN NOT NULL DEFAULT FALSE;

-- Düzenleme: icerik; Sabitleme: sabitlenmis; Silme (soft): silinmis
GRANT UPDATE (icerik, sabitlenmis, silinmis) ON public.gonderiler TO authenticated;

-- Okumada sabitlenmis kolonunu da görebilelim (sıralama/rozet için)
GRANT SELECT (sabitlenmis) ON public.gonderiler TO authenticated;
