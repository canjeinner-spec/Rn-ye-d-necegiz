-- ============================================================================
-- 055_oda_takip_ziyaret.sql — "Odam" ekranındaki üç sekmenin gerçek kaynağı
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 003 (benim_kullanici_id) ve 021 (oda_uyeleri)'den SONRA.
--
-- Odam ekranında "Son günlerde / Katıl / Takip et" sekmelerinin ÜÇÜ DE aynı
-- sahte listeyi (data/seed.ts) gösteriyordu; yalnızca dilimleri farklıydı.
-- Gerçeğe bağlamak için iki şey eksikti:
--
--   • Takip: hiç tablo yoktu. RoomPanel'deki "Takip Et" düğmesi sadece yerel
--     state'i çeviriyordu — ekran kapanınca unutuluyordu.
--   • Ziyaret: oda_hareket_log (032) var ama SELECT'i YALNIZCA platform
--     yöneticisine açık (gizlilik kararı) ve her oturumda iki satır yazıyor.
--     "Son ziyaret ettiğim odalar" için oda başına TEK satır gerekiyor.
--
-- "Katıl" sekmesi yeni tablo istemiyor: oda_uyeleri (021) zaten gerçek ve
-- RoomPanel'deki Katıl/Ayrıl düğmesi oraya yazıyor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Oda takibi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oda_takip (
    kullanici_id BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    oda_id       BIGINT      NOT NULL REFERENCES public.odalar(id)       ON DELETE CASCADE,
    tarih        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (kullanici_id, oda_id)
);
CREATE INDEX IF NOT EXISTS idx_oda_takip_kullanici ON public.oda_takip (kullanici_id, tarih DESC);
CREATE INDEX IF NOT EXISTS idx_oda_takip_oda       ON public.oda_takip (oda_id);

ALTER TABLE public.oda_takip ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oda_takip FROM anon, authenticated;
GRANT SELECT (kullanici_id, oda_id, tarih) ON public.oda_takip TO authenticated;
GRANT INSERT (kullanici_id, oda_id)        ON public.oda_takip TO authenticated;
GRANT DELETE                                ON public.oda_takip TO authenticated;

-- Kimin neyi takip ettiği kişiseldir: herkes yalnızca KENDİ satırlarını görür.
DROP POLICY IF EXISTS oda_takip_select ON public.oda_takip;
CREATE POLICY oda_takip_select ON public.oda_takip
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id());

DROP POLICY IF EXISTS oda_takip_insert ON public.oda_takip;
CREATE POLICY oda_takip_insert ON public.oda_takip
    FOR INSERT TO authenticated
    WITH CHECK (kullanici_id = public.benim_kullanici_id());

DROP POLICY IF EXISTS oda_takip_delete ON public.oda_takip;
CREATE POLICY oda_takip_delete ON public.oda_takip
    FOR DELETE TO authenticated
    USING (kullanici_id = public.benim_kullanici_id());

-- ---------------------------------------------------------------------------
-- 2) Oda ziyaretleri (oda başına tek satır, son giriş + sayaç)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oda_ziyaretleri (
    kullanici_id BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    oda_id       BIGINT      NOT NULL REFERENCES public.odalar(id)       ON DELETE CASCADE,
    son_giris    TIMESTAMPTZ NOT NULL DEFAULT now(),
    giris_sayisi INTEGER     NOT NULL DEFAULT 1,
    PRIMARY KEY (kullanici_id, oda_id)
);
CREATE INDEX IF NOT EXISTS idx_oda_ziyaret_kullanici
    ON public.oda_ziyaretleri (kullanici_id, son_giris DESC);

ALTER TABLE public.oda_ziyaretleri ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oda_ziyaretleri FROM anon, authenticated;
GRANT SELECT (kullanici_id, oda_id, son_giris, giris_sayisi) ON public.oda_ziyaretleri TO authenticated;
GRANT DELETE ON public.oda_ziyaretleri TO authenticated;

-- Ziyaret geçmişi de kişisel: yalnızca kendi satırların.
DROP POLICY IF EXISTS oda_ziyaret_select ON public.oda_ziyaretleri;
CREATE POLICY oda_ziyaret_select ON public.oda_ziyaretleri
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id());

-- Kullanıcı geçmişini silebilsin ("Son günlerde" listesini temizleme).
DROP POLICY IF EXISTS oda_ziyaret_delete ON public.oda_ziyaretleri;
CREATE POLICY oda_ziyaret_delete ON public.oda_ziyaretleri
    FOR DELETE TO authenticated
    USING (kullanici_id = public.benim_kullanici_id());

-- Yazma yalnızca bu fonksiyonla: upsert + sayaç artırma tek işlemde olmalı.
-- (Client'a INSERT/UPDATE verilseydi sayaç istemciden şişirilebilirdi.)
CREATE OR REPLACE FUNCTION public.oda_ziyaret_kaydet(p_oda_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ben BIGINT;
BEGIN
    v_ben := public.benim_kullanici_id();
    IF v_ben IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.oda_ziyaretleri (kullanici_id, oda_id)
    VALUES (v_ben, p_oda_id)
    ON CONFLICT (kullanici_id, oda_id) DO UPDATE
        SET son_giris    = now(),
            giris_sayisi = public.oda_ziyaretleri.giris_sayisi + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.oda_ziyaret_kaydet(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oda_ziyaret_kaydet(BIGINT) TO authenticated;
