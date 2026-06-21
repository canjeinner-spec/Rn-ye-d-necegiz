-- ============================================================================
-- 011_room_chat.sql — Oda sohbeti: RLS + Realtime (Faz 4)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003'ten SONRA (Supabase SQL Editor).
--
--   • oda_mesajlari: herkese açık odaların mesajları okunur; yalnızca kendi
--     adına ve var olan (silinmemiş) odaya mesaj yazılır
--   • Realtime publication'a eklenir (canlı oda sohbeti)
--   • "Kimler odada" → Supabase Realtime Presence (DB'ye yazmaz; client'ta)
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

REVOKE ALL ON public.oda_mesajlari FROM anon, authenticated;
GRANT SELECT (id, oda_id, kullanici_id, icerik, gonderilme_tarihi) ON public.oda_mesajlari TO authenticated;
GRANT INSERT (oda_id, kullanici_id, icerik) ON public.oda_mesajlari TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE oda_mesajlari_id_seq TO authenticated;

-- Herkese açık & silinmemiş odanın mesajları okunur (ya da kendi odan)
DROP POLICY IF EXISTS oda_mesaj_select ON public.oda_mesajlari;
CREATE POLICY oda_mesaj_select ON public.oda_mesajlari
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.odalar o
        WHERE o.id = oda_id AND o.silinmis = FALSE
          AND (o.herkese_acik = TRUE OR o.olusturan_id = public.benim_kullanici_id())
    ));

-- Yalnızca kendi adına ve var olan odaya mesaj
DROP POLICY IF EXISTS oda_mesaj_insert ON public.oda_mesajlari;
CREATE POLICY oda_mesaj_insert ON public.oda_mesajlari
    FOR INSERT TO authenticated
    WITH CHECK (
        kullanici_id = public.benim_kullanici_id()
        AND EXISTS (SELECT 1 FROM public.odalar o WHERE o.id = oda_id AND o.silinmis = FALSE)
    );

-- Realtime: oda_mesajlari (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'oda_mesajlari'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.oda_mesajlari;
    END IF;
END $$;
