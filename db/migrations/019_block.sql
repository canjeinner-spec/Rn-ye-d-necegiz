-- ============================================================================
-- 019_block.sql — Kullanıcı engelleme (block)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003 ve 017'den SONRA (Supabase SQL Editor).
--
--   • kullanici_engelleri: yönlü engel grafiği (engelleyen → engellenen)
--   • Görünürlük: hem engelleyen hem engellenen kendi ilişkisini görebilir
--     (engellenen "sizi engelledi" durumunu gösterebilsin diye).
--   • Engellenince iki yöndeki takip de kopar (trigger).
--   • Engellenen kişi, engelleyeni takip edemez (takip_insert WITH CHECK guard).
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kullanici_engelleri (
    engelleyen_id     BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    engellenen_id     BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    engellenme_tarihi TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (engelleyen_id, engellenen_id),
    CONSTRAINT engel_kendine_olmaz CHECK (engelleyen_id <> engellenen_id)
);
CREATE INDEX IF NOT EXISTS idx_engel_engellenen ON public.kullanici_engelleri (engellenen_id);

ALTER TABLE public.kullanici_engelleri ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kullanici_engelleri FROM anon, authenticated;
GRANT SELECT (engelleyen_id, engellenen_id, engellenme_tarihi) ON public.kullanici_engelleri TO authenticated;
GRANT INSERT (engelleyen_id, engellenen_id) ON public.kullanici_engelleri TO authenticated;
GRANT DELETE ON public.kullanici_engelleri TO authenticated;

-- Görünürlük: kendi taraflı olduğun satırlar (her iki yön)
DROP POLICY IF EXISTS engel_select ON public.kullanici_engelleri;
CREATE POLICY engel_select ON public.kullanici_engelleri
    FOR SELECT TO authenticated
    USING (engelleyen_id = public.benim_kullanici_id()
        OR engellenen_id = public.benim_kullanici_id());

-- Yalnızca kendi adıma engelle
DROP POLICY IF EXISTS engel_insert ON public.kullanici_engelleri;
CREATE POLICY engel_insert ON public.kullanici_engelleri
    FOR INSERT TO authenticated
    WITH CHECK (engelleyen_id = public.benim_kullanici_id());

-- Yalnızca kendi koyduğum engeli kaldır
DROP POLICY IF EXISTS engel_delete ON public.kullanici_engelleri;
CREATE POLICY engel_delete ON public.kullanici_engelleri
    FOR DELETE TO authenticated
    USING (engelleyen_id = public.benim_kullanici_id());

-- ---- Engellenince iki yöndeki takip de kopsun -------------------------------
CREATE OR REPLACE FUNCTION public.engel_sonrasi_takip_kopar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    DELETE FROM public.kullanicilar_takip
     WHERE (takip_eden_id = NEW.engelleyen_id AND takip_edilen_id = NEW.engellenen_id)
        OR (takip_eden_id = NEW.engellenen_id AND takip_edilen_id = NEW.engelleyen_id);
    RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_engel_takip_kopar ON public.kullanici_engelleri;
CREATE TRIGGER trg_engel_takip_kopar AFTER INSERT ON public.kullanici_engelleri
    FOR EACH ROW EXECUTE FUNCTION public.engel_sonrasi_takip_kopar();

-- ---- Engellenen kişi, engelleyeni takip edemesin (server-side guard) --------
-- 017'deki takip_insert policy'sini blok kontrolüyle güncelle.
DROP POLICY IF EXISTS takip_insert ON public.kullanicilar_takip;
CREATE POLICY takip_insert ON public.kullanicilar_takip
    FOR INSERT TO authenticated
    WITH CHECK (
        takip_eden_id = public.benim_kullanici_id()
        AND NOT EXISTS (
            SELECT 1 FROM public.kullanici_engelleri e
             WHERE e.engelleyen_id = takip_edilen_id
               AND e.engellenen_id = public.benim_kullanici_id()
        )
    );
