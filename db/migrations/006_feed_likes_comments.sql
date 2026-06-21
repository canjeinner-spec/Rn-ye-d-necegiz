-- ============================================================================
-- 006_feed_likes_comments.sql — Akış: beğeni + yorum (DB) (Faz 2)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 005'ten SONRA (Supabase SQL Editor).
--
-- Kapsam: gönderi BEĞENİ + üst-seviye YORUM. Yanıtlar (reply) sonraki dilim.
--   • Sayaçlar (begeni_sayisi / yorum_sayisi) DB trigger'larıyla tutulur
--     (client sayaç kolonlarına yazamaz — güvenli & yarış-koşulsuz)
--   • Beğeni: yalnızca kendi adına ekle/sil, yalnızca kendi beğenini gör
--   • Yorum: herkes okur (silinmemiş), yalnızca kendi adına yazar
-- ============================================================================

-- ---- A) gonderi_begeniler ---------------------------------------------------
REVOKE ALL ON public.gonderi_begeniler FROM anon, authenticated;
GRANT SELECT (gonderi_id, kullanici_id) ON public.gonderi_begeniler TO authenticated;
GRANT INSERT (gonderi_id, kullanici_id) ON public.gonderi_begeniler TO authenticated;
GRANT DELETE ON public.gonderi_begeniler TO authenticated;

DROP POLICY IF EXISTS begeni_select ON public.gonderi_begeniler;
CREATE POLICY begeni_select ON public.gonderi_begeniler
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id());

DROP POLICY IF EXISTS begeni_insert ON public.gonderi_begeniler;
CREATE POLICY begeni_insert ON public.gonderi_begeniler
    FOR INSERT TO authenticated
    WITH CHECK (kullanici_id = public.benim_kullanici_id());

DROP POLICY IF EXISTS begeni_delete ON public.gonderi_begeniler;
CREATE POLICY begeni_delete ON public.gonderi_begeniler
    FOR DELETE TO authenticated
    USING (kullanici_id = public.benim_kullanici_id());

-- Sayaç trigger'ı (SECURITY DEFINER → gonderiler RLS/kolon yetkisini bypass eder)
CREATE OR REPLACE FUNCTION public.gonderi_begeni_say()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.gonderiler SET begeni_sayisi = begeni_sayisi + 1 WHERE id = NEW.gonderi_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.gonderiler SET begeni_sayisi = GREATEST(begeni_sayisi - 1, 0) WHERE id = OLD.gonderi_id;
    END IF;
    RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_gonderi_begeni ON public.gonderi_begeniler;
CREATE TRIGGER trg_gonderi_begeni
    AFTER INSERT OR DELETE ON public.gonderi_begeniler
    FOR EACH ROW EXECUTE FUNCTION public.gonderi_begeni_say();

-- ---- B) gonderi_yorumlari ---------------------------------------------------
REVOKE ALL ON public.gonderi_yorumlari FROM anon, authenticated;
GRANT SELECT (
    id, gonderi_id, kullanici_id, ust_yorum_id, icerik, begeni_sayisi, olusturulma_tarihi
) ON public.gonderi_yorumlari TO authenticated;
GRANT INSERT (gonderi_id, kullanici_id, ust_yorum_id, icerik) ON public.gonderi_yorumlari TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE gonderi_yorumlari_id_seq TO authenticated;

DROP POLICY IF EXISTS yorum_select ON public.gonderi_yorumlari;
CREATE POLICY yorum_select ON public.gonderi_yorumlari
    FOR SELECT TO authenticated
    USING (silinmis = FALSE);

DROP POLICY IF EXISTS yorum_insert ON public.gonderi_yorumlari;
CREATE POLICY yorum_insert ON public.gonderi_yorumlari
    FOR INSERT TO authenticated
    WITH CHECK (kullanici_id = public.benim_kullanici_id());

-- Sayaç trigger'ı (yanıtlar dahil her yorum yorum_sayisi'nı artırır)
CREATE OR REPLACE FUNCTION public.gonderi_yorum_say()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.gonderiler SET yorum_sayisi = yorum_sayisi + 1 WHERE id = NEW.gonderi_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.gonderiler SET yorum_sayisi = GREATEST(yorum_sayisi - 1, 0) WHERE id = OLD.gonderi_id;
    END IF;
    RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_gonderi_yorum ON public.gonderi_yorumlari;
CREATE TRIGGER trg_gonderi_yorum
    AFTER INSERT OR DELETE ON public.gonderi_yorumlari
    FOR EACH ROW EXECUTE FUNCTION public.gonderi_yorum_say();
