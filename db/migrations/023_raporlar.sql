-- ============================================================================
-- 023_raporlar.sql — Kullanıcı / oda raporları (şikayet kaydı)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • raporlar: kim, neyi (kullanıcı|oda), neden, opsiyonel detayla raporladı.
--   • Herkes kendi adına rapor açar; kendi raporlarını görür.
--   • Platform yöneticileri (developer/super_admin) tüm raporları görür ve
--     durumunu günceller (bekliyor → incelendi) — in-app yönetim ekranı için.
-- benim_kullanici_id() 003'te, ben_platform_yoneticisi() 021'de tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.raporlar (
    id                  BIGSERIAL   PRIMARY KEY,
    tip                 TEXT        NOT NULL CHECK (tip IN ('kullanici', 'oda')),
    raporlayan_id       BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    hedef_kullanici_id  BIGINT      REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    hedef_oda_id        BIGINT      REFERENCES public.odalar(id) ON DELETE CASCADE,
    neden               TEXT        NOT NULL,
    detay               TEXT,
    durum               TEXT        NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor', 'incelendi')),
    olusturulma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rapor_hedef_tutarli CHECK (
        (tip = 'kullanici' AND hedef_kullanici_id IS NOT NULL) OR
        (tip = 'oda'       AND hedef_oda_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_rapor_durum ON public.raporlar (durum, id DESC);

ALTER TABLE public.raporlar ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.raporlar FROM anon, authenticated;
GRANT SELECT ON public.raporlar TO authenticated;
GRANT INSERT (tip, raporlayan_id, hedef_kullanici_id, hedef_oda_id, neden, detay) ON public.raporlar TO authenticated;
GRANT UPDATE (durum) ON public.raporlar TO authenticated;

-- Kendi raporların + yöneticiler hepsini görür
DROP POLICY IF EXISTS rapor_select ON public.raporlar;
CREATE POLICY rapor_select ON public.raporlar
    FOR SELECT TO authenticated
    USING (raporlayan_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

-- Yalnızca kendi adına rapor aç
DROP POLICY IF EXISTS rapor_insert ON public.raporlar;
CREATE POLICY rapor_insert ON public.raporlar
    FOR INSERT TO authenticated
    WITH CHECK (raporlayan_id = public.benim_kullanici_id());

-- Durumu yalnızca yönetici günceller
DROP POLICY IF EXISTS rapor_update ON public.raporlar;
CREATE POLICY rapor_update ON public.raporlar
    FOR UPDATE TO authenticated
    USING (public.ben_platform_yoneticisi())
    WITH CHECK (public.ben_platform_yoneticisi());
