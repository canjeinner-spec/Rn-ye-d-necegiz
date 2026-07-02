-- ============================================================================
-- 032_oda_hareket.sql — Oda giriş/çıkış kaydı (moderasyon için oturum geçmişi)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 003 (benim_kullanici_id) + 021 (ben_platform_yoneticisi)'den SONRA.
--
-- Presence (Realtime) ephemeral'dir — kim ne zaman girdi/çıktı geçmişi tutmaz.
-- Bir oda raporlandığında yönetici "rapor anında kim vardı" (snapshot,
-- sikayetler.oda_katilimcilar) DIŞINDA oturum boyu KİMLER GİRDİ-ÇIKTI görmek
-- ister. Bu tablo her giriş/çıkışı kaydeder.
--
--   • INSERT: yalnızca kendi adına, tip ∈ (giris|cikis). Client odaya girince
--     'giris', çıkınca 'cikis' yazar (best-effort: uygulama zorla kapanırsa
--     çıkış düşmeyebilir — "giren" kesin, "çıkan" yaklaşıktır).
--   • SELECT: YALNIZCA platform yöneticisi (gizlilik — sıradan kullanıcı
--     kimin nerede olduğunu göremez).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.oda_hareket_log (
    id           BIGSERIAL   PRIMARY KEY,
    oda_id       BIGINT      NOT NULL REFERENCES public.odalar(id) ON DELETE CASCADE,
    kullanici_id BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    tip          TEXT        NOT NULL CHECK (tip IN ('giris', 'cikis')),
    tarih        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oda_hareket_oda ON public.oda_hareket_log (oda_id, id DESC);

ALTER TABLE public.oda_hareket_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oda_hareket_log FROM anon, authenticated;
GRANT INSERT (oda_id, kullanici_id, tip) ON public.oda_hareket_log TO authenticated;
GRANT SELECT (id, oda_id, kullanici_id, tip, tarih) ON public.oda_hareket_log TO authenticated;
GRANT USAGE ON SEQUENCE public.oda_hareket_log_id_seq TO authenticated;

-- INSERT: yalnızca kendi adına (tip CHECK zaten tabloda)
DROP POLICY IF EXISTS oda_hareket_insert ON public.oda_hareket_log;
CREATE POLICY oda_hareket_insert ON public.oda_hareket_log
    FOR INSERT TO authenticated
    WITH CHECK (kullanici_id = public.benim_kullanici_id());

-- SELECT: yalnızca platform yöneticisi (developer / super_admin)
DROP POLICY IF EXISTS oda_hareket_select ON public.oda_hareket_log;
CREATE POLICY oda_hareket_select ON public.oda_hareket_log
    FOR SELECT TO authenticated
    USING (public.ben_platform_yoneticisi());
