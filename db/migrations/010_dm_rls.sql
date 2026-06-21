-- ============================================================================
-- 010_dm_rls.sql — DM (mesajlaşma): RLS + Realtime + yardımcı RPC'ler (Faz 3)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003'ten SONRA (Supabase SQL Editor).
--
--   • dm_konusmalari / dm_mesajlari: yalnızca katılımcıları erişir
--   • Konuşma oluşturma + okundu işaretleme SECURITY DEFINER RPC ile
--   • son_mesaj_tarihi trigger ile güncellenir
--   • dm_mesajlari Realtime publication'a eklenir (canlı mesaj)
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

-- ---- A) dm_konusmalari -------------------------------------------------------
REVOKE ALL ON public.dm_konusmalari FROM anon, authenticated;
GRANT SELECT (id, kullanici1_id, kullanici2_id, son_mesaj_tarihi, olusturulma_tarihi)
    ON public.dm_konusmalari TO authenticated;

DROP POLICY IF EXISTS dm_konusma_select ON public.dm_konusmalari;
CREATE POLICY dm_konusma_select ON public.dm_konusmalari
    FOR SELECT TO authenticated
    USING (public.benim_kullanici_id() IN (kullanici1_id, kullanici2_id));

-- ---- B) dm_mesajlari ---------------------------------------------------------
REVOKE ALL ON public.dm_mesajlari FROM anon, authenticated;
GRANT SELECT (id, konusma_id, gonderen_id, icerik, okunma_tarihi, gonderilme_tarihi)
    ON public.dm_mesajlari TO authenticated;
GRANT INSERT (konusma_id, gonderen_id, icerik) ON public.dm_mesajlari TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE dm_mesajlari_id_seq TO authenticated;

-- Konuşmanın katılımcısıysam mesajları görürüm
DROP POLICY IF EXISTS dm_mesaj_select ON public.dm_mesajlari;
CREATE POLICY dm_mesaj_select ON public.dm_mesajlari
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.dm_konusmalari k
        WHERE k.id = konusma_id AND public.benim_kullanici_id() IN (k.kullanici1_id, k.kullanici2_id)
    ));

-- Yalnızca kendi adıma ve kendi konuşmama mesaj atarım
DROP POLICY IF EXISTS dm_mesaj_insert ON public.dm_mesajlari;
CREATE POLICY dm_mesaj_insert ON public.dm_mesajlari
    FOR INSERT TO authenticated
    WITH CHECK (
        gonderen_id = public.benim_kullanici_id()
        AND EXISTS (
            SELECT 1 FROM public.dm_konusmalari k
            WHERE k.id = konusma_id AND public.benim_kullanici_id() IN (k.kullanici1_id, k.kullanici2_id)
        )
    );

-- ---- C) son_mesaj_tarihi trigger --------------------------------------------
CREATE OR REPLACE FUNCTION public.dm_son_mesaj_guncelle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    UPDATE public.dm_konusmalari SET son_mesaj_tarihi = NEW.gonderilme_tarihi WHERE id = NEW.konusma_id;
    RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_dm_son_mesaj ON public.dm_mesajlari;
CREATE TRIGGER trg_dm_son_mesaj
    AFTER INSERT ON public.dm_mesajlari
    FOR EACH ROW EXECUTE FUNCTION public.dm_son_mesaj_guncelle();

-- ---- D) Konuşma bul/oluştur (normalize: kullanici1_id < kullanici2_id) -------
CREATE OR REPLACE FUNCTION public.dm_konusma_bul_olustur(p_diger_id BIGINT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_me BIGINT := public.benim_kullanici_id();
    v_a BIGINT; v_b BIGINT; v_id BIGINT;
BEGIN
    IF v_me IS NULL OR p_diger_id IS NULL OR v_me = p_diger_id THEN
        RAISE EXCEPTION 'gecersiz konusma';
    END IF;
    v_a := LEAST(v_me, p_diger_id);
    v_b := GREATEST(v_me, p_diger_id);
    SELECT id INTO v_id FROM public.dm_konusmalari WHERE kullanici1_id = v_a AND kullanici2_id = v_b;
    IF v_id IS NULL THEN
        INSERT INTO public.dm_konusmalari (kullanici1_id, kullanici2_id)
        VALUES (v_a, v_b)
        ON CONFLICT (kullanici1_id, kullanici2_id) DO UPDATE SET kullanici1_id = EXCLUDED.kullanici1_id
        RETURNING id INTO v_id;
    END IF;
    RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_konusma_bul_olustur(BIGINT) TO authenticated;

-- ---- E) Okundu işaretle -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.dm_okundu(p_konusma_id BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me BIGINT := public.benim_kullanici_id();
BEGIN
    UPDATE public.dm_mesajlari
       SET okunma_tarihi = now()
     WHERE konusma_id = p_konusma_id
       AND gonderen_id <> v_me
       AND okunma_tarihi IS NULL
       AND EXISTS (SELECT 1 FROM public.dm_konusmalari k WHERE k.id = p_konusma_id AND v_me IN (k.kullanici1_id, k.kullanici2_id));
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_okundu(BIGINT) TO authenticated;

-- ---- F) Realtime: dm_mesajlari değişimlerini yayınla (idempotent) -----------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dm_mesajlari'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_mesajlari;
    END IF;
END $$;
