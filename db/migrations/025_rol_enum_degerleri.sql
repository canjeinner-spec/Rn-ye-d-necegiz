-- ============================================================================
-- 025_rol_enum_degerleri.sql — ekonomi_rolu enum'una eksik değerleri ekle
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den ÖNCE, TEK BAŞINA çalıştır (Supabase SQL Editor).
--
-- v7 şemasında ekonomi_rolu bir ENUM ve 'developer' değeri yok (22P02
-- hatasının nedeni). Uygulama 'user' | 'developer' | 'super_admin'
-- bekliyor — eksik olanları güvenli (additive) şekilde ekliyoruz.
-- Not: ALTER TYPE ... ADD VALUE, yeni değerin AYNI script içinde
-- kullanılmamasını ister; bu yüzden bu dosya tek başına çalıştırılmalı.
-- ============================================================================

ALTER TYPE public.ekonomi_rolu ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE public.ekonomi_rolu ADD VALUE IF NOT EXISTS 'developer';
ALTER TYPE public.ekonomi_rolu ADD VALUE IF NOT EXISTS 'super_admin';
