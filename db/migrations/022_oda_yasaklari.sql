-- ============================================================================
-- 022_oda_yasaklari.sql — Kalıcı oda yasaklama (odadan atılanlar)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • oda_yasaklari: kim, hangi odadan, kim tarafından, ne zaman yasaklandı.
--   • Okuma herkese açık (kendi yasağını görüp giriş engeli uygulanabilsin,
--     oda yönetimi listeyi gösterebilsin diye).
--   • Yazma YALNIZCA RPC ile: oda_yasakla / oda_yasak_kaldir — yetki kontrolü
--     fonksiyon içinde (sahip herkesi, yardımcı yalnızca üyeyi yasaklar).
--     Yasaklanınca üyelik de düşer.
-- benim_kullanici_id() 003'te, ben_platform_yoneticisi() 021'de tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.oda_yasaklari (
    oda_id            BIGINT      NOT NULL REFERENCES public.odalar(id) ON DELETE CASCADE,
    kullanici_id      BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    yasaklayan_id     BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    yasaklanma_tarihi TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (oda_id, kullanici_id)
);
CREATE INDEX IF NOT EXISTS idx_oda_yasak_kullanici ON public.oda_yasaklari (kullanici_id);

ALTER TABLE public.oda_yasaklari ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oda_yasaklari FROM anon, authenticated;
GRANT SELECT (oda_id, kullanici_id, yasaklayan_id, yasaklanma_tarihi) ON public.oda_yasaklari TO authenticated;

DROP POLICY IF EXISTS oda_yasak_select ON public.oda_yasaklari;
CREATE POLICY oda_yasak_select ON public.oda_yasaklari
    FOR SELECT TO authenticated USING (TRUE);

-- ---- RPC: yasakla (üyeliği de düşürür) ------------------------------------
CREATE OR REPLACE FUNCTION public.oda_yasakla(p_oda_id BIGINT, p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT; v_hedef TEXT;
BEGIN
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendini yasaklayamazsın.';
    END IF;
    SELECT rol INTO v_benim FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = public.benim_kullanici_id();
    SELECT rol INTO v_hedef FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
    IF v_hedef = 'sahip' THEN
        RAISE EXCEPTION 'Oda sahibi yasaklanamaz.';
    END IF;
    IF NOT (public.ben_platform_yoneticisi()
            OR v_benim = 'sahip'
            OR (v_benim = 'yardimci' AND COALESCE(v_hedef, 'uye') = 'uye')) THEN
        RAISE EXCEPTION 'Bu kullanıcıyı yasaklama yetkin yok.';
    END IF;
    INSERT INTO public.oda_yasaklari (oda_id, kullanici_id, yasaklayan_id)
    VALUES (p_oda_id, p_hedef, public.benim_kullanici_id())
    ON CONFLICT (oda_id, kullanici_id) DO NOTHING;
    DELETE FROM public.oda_uyeleri WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.oda_yasakla(BIGINT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_yasakla(BIGINT, BIGINT) TO authenticated;

-- ---- RPC: yasağı kaldır -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.oda_yasak_kaldir(p_oda_id BIGINT, p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT;
BEGIN
    SELECT rol INTO v_benim FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = public.benim_kullanici_id();
    IF NOT (public.ben_platform_yoneticisi() OR v_benim IN ('sahip', 'yardimci')) THEN
        RAISE EXCEPTION 'Yasak kaldırma yetkin yok.';
    END IF;
    DELETE FROM public.oda_yasaklari WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.oda_yasak_kaldir(BIGINT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_yasak_kaldir(BIGINT, BIGINT) TO authenticated;

-- ---- Yasaklı kullanıcı tekrar üye olamasın (insert policy güncelle) --------
DROP POLICY IF EXISTS oda_uye_insert ON public.oda_uyeleri;
CREATE POLICY oda_uye_insert ON public.oda_uyeleri
    FOR INSERT TO authenticated
    WITH CHECK (
        kullanici_id = public.benim_kullanici_id()
        AND rol = 'uye'
        AND NOT EXISTS (
            SELECT 1 FROM public.oda_yasaklari y
             WHERE y.oda_id = oda_uyeleri.oda_id
               AND y.kullanici_id = public.benim_kullanici_id()
        )
    );
