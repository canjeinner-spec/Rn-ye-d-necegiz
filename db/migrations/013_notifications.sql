-- ============================================================================
-- 013_notifications.sql — Bildirimler: RLS + trigger'lar + Realtime (Faz 3)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-006 ve 010'dan SONRA (Supabase SQL Editor).
--
--   • bildirim_tipi enum'una 'begeni' + 'yorum' eklenir
--   • bildirimler: kullanıcı yalnızca KENDİ bildirimlerini okur/okundu işaretler
--   • Trigger'lar (SECURITY DEFINER): beğeni / yorum / DM → ilgili kullanıcıya
--     otomatik bildirim (client yazmaz)
--   • bildirimler Realtime publication'a eklenir (canlı bildirim)
-- ============================================================================

ALTER TYPE bildirim_tipi ADD VALUE IF NOT EXISTS 'begeni';
ALTER TYPE bildirim_tipi ADD VALUE IF NOT EXISTS 'yorum';

-- ---- RLS: kendi bildirimlerin --------------------------------------------
REVOKE ALL ON public.bildirimler FROM anon, authenticated;
GRANT SELECT (id, kullanici_id, tip, baslik, icerik, veri, okundu, olusturulma_tarihi) ON public.bildirimler TO authenticated;
GRANT UPDATE (okundu) ON public.bildirimler TO authenticated;

DROP POLICY IF EXISTS bildirim_select ON public.bildirimler;
CREATE POLICY bildirim_select ON public.bildirimler
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id());

DROP POLICY IF EXISTS bildirim_update ON public.bildirimler;
CREATE POLICY bildirim_update ON public.bildirimler
    FOR UPDATE TO authenticated
    USING (kullanici_id = public.benim_kullanici_id())
    WITH CHECK (kullanici_id = public.benim_kullanici_id());

-- ---- Trigger: beğeni → gönderi sahibine bildirim --------------------------
CREATE OR REPLACE FUNCTION public.bildirim_begeni()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_owner BIGINT; v_pub TEXT; v_actor TEXT;
BEGIN
    SELECT kullanici_id, public_id INTO v_owner, v_pub FROM public.gonderiler WHERE id = NEW.gonderi_id;
    IF v_owner IS NULL OR v_owner = NEW.kullanici_id THEN RETURN NULL; END IF; -- kendi gönderin → bildirim yok
    SELECT kullanici_adi INTO v_actor FROM public.kullanicilar WHERE id = NEW.kullanici_id;
    INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
    VALUES (v_owner, 'begeni', 'Yeni beğeni', COALESCE(v_actor, 'Biri') || ' gönderini beğendi.',
            jsonb_build_object('gonderi', v_pub, 'actor', NEW.kullanici_id));
    RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_bildirim_begeni ON public.gonderi_begeniler;
CREATE TRIGGER trg_bildirim_begeni AFTER INSERT ON public.gonderi_begeniler
    FOR EACH ROW EXECUTE FUNCTION public.bildirim_begeni();

-- ---- Trigger: yorum → gönderi sahibine bildirim ---------------------------
CREATE OR REPLACE FUNCTION public.bildirim_yorum()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_owner BIGINT; v_pub TEXT; v_actor TEXT;
BEGIN
    SELECT kullanici_id, public_id INTO v_owner, v_pub FROM public.gonderiler WHERE id = NEW.gonderi_id;
    IF v_owner IS NULL OR v_owner = NEW.kullanici_id THEN RETURN NULL; END IF;
    SELECT kullanici_adi INTO v_actor FROM public.kullanicilar WHERE id = NEW.kullanici_id;
    INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
    VALUES (v_owner, 'yorum', 'Yeni yorum', COALESCE(v_actor, 'Biri') || ' gönderine yorum yaptı.',
            jsonb_build_object('gonderi', v_pub, 'actor', NEW.kullanici_id));
    RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_bildirim_yorum ON public.gonderi_yorumlari;
CREATE TRIGGER trg_bildirim_yorum AFTER INSERT ON public.gonderi_yorumlari
    FOR EACH ROW EXECUTE FUNCTION public.bildirim_yorum();

-- ---- Trigger: DM → alıcıya bildirim ---------------------------------------
CREATE OR REPLACE FUNCTION public.bildirim_dm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_k1 BIGINT; v_k2 BIGINT; v_recipient BIGINT; v_actor TEXT;
BEGIN
    SELECT kullanici1_id, kullanici2_id INTO v_k1, v_k2 FROM public.dm_konusmalari WHERE id = NEW.konusma_id;
    v_recipient := CASE WHEN NEW.gonderen_id = v_k1 THEN v_k2 ELSE v_k1 END;
    IF v_recipient IS NULL THEN RETURN NULL; END IF;
    SELECT kullanici_adi INTO v_actor FROM public.kullanicilar WHERE id = NEW.gonderen_id;
    INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
    VALUES (v_recipient, 'dm', 'Yeni mesaj', COALESCE(v_actor, 'Biri') || ': ' || left(NEW.icerik, 60),
            jsonb_build_object('konusma', NEW.konusma_id, 'actor', NEW.gonderen_id));
    RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_bildirim_dm ON public.dm_mesajlari;
CREATE TRIGGER trg_bildirim_dm AFTER INSERT ON public.dm_mesajlari
    FOR EACH ROW EXECUTE FUNCTION public.bildirim_dm();

-- ---- Realtime (idempotent) ------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bildirimler'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bildirimler;
    END IF;
END $$;
