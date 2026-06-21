-- ============================================================================
-- 017_follow.sql — Takip sistemi: RLS + takip bildirimi (Faz 3 sosyal)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003 ve 013'ten SONRA (Supabase SQL Editor).
--
--   • kullanicilar_takip: takip grafiği herkese açık okunur (sayaç + "takip
--     ediyor muyum"); yalnızca kendi adına takip et / bırak
--   • Takip edilince ilgili kişiye 'takip' bildirimi (SECURITY DEFINER trigger)
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

REVOKE ALL ON public.kullanicilar_takip FROM anon, authenticated;
GRANT SELECT (takip_eden_id, takip_edilen_id, takip_tarihi) ON public.kullanicilar_takip TO authenticated;
GRANT INSERT (takip_eden_id, takip_edilen_id) ON public.kullanicilar_takip TO authenticated;
GRANT DELETE ON public.kullanicilar_takip TO authenticated;

-- Takip grafiği herkese açık (sayaçlar + takip durumu için)
DROP POLICY IF EXISTS takip_select ON public.kullanicilar_takip;
CREATE POLICY takip_select ON public.kullanicilar_takip
    FOR SELECT TO authenticated
    USING (TRUE);

-- Yalnızca kendi adıma takip et
DROP POLICY IF EXISTS takip_insert ON public.kullanicilar_takip;
CREATE POLICY takip_insert ON public.kullanicilar_takip
    FOR INSERT TO authenticated
    WITH CHECK (takip_eden_id = public.benim_kullanici_id());

-- Yalnızca kendi takibimi bırak
DROP POLICY IF EXISTS takip_delete ON public.kullanicilar_takip;
CREATE POLICY takip_delete ON public.kullanicilar_takip
    FOR DELETE TO authenticated
    USING (takip_eden_id = public.benim_kullanici_id());

-- ---- Takip bildirimi --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bildirim_takip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor TEXT;
BEGIN
    IF NEW.takip_eden_id = NEW.takip_edilen_id THEN RETURN NULL; END IF;
    SELECT kullanici_adi INTO v_actor FROM public.kullanicilar WHERE id = NEW.takip_eden_id;
    INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
    VALUES (NEW.takip_edilen_id, 'takip', 'Yeni takipçi',
            COALESCE(v_actor, 'Biri') || ' seni takip etmeye başladı.',
            jsonb_build_object('actor', NEW.takip_eden_id));
    RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_bildirim_takip ON public.kullanicilar_takip;
CREATE TRIGGER trg_bildirim_takip AFTER INSERT ON public.kullanicilar_takip
    FOR EACH ROW EXECUTE FUNCTION public.bildirim_takip();
