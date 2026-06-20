-- ============================================================================
-- 001_auth_bridge.sql  —  Faz 0/1: Supabase Auth ↔ v7 şeması köprüsü + RLS
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA SIRASI (Supabase SQL Editor):
--   1) schema_v7.sql            (ana şema)
--   2) schema_v7_eklentileri.sql (feed/etkinlik/görev/kupon/özel-id/arkadaşlık)
--   3) BU DOSYA
--
-- Ne yapar:
--   • kullanicilar.auth_uid → Supabase auth.users köprüsü
--   • Yeni auth kullanıcısı kayıt olunca otomatik kullanicilar satırı (stub)
--   • GÜVENLİ VARSAYILAN: public şemasındaki TÜM tablolarda RLS açılır
--     (policy olmayan tablo = client'a tamamen kapalı; ekonomi dormant kalır)
--   • Profil için policy + hassas kolonları gizleyen "profiller" view'ı
-- ============================================================================

-- ---- A) Kimlik köprüsü -------------------------------------------------------
ALTER TABLE kullanicilar
    ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_kullanicilar_auth_uid ON kullanicilar (auth_uid);

-- public_id / benzersiz placeholder kullanıcı adı için sıra
CREATE SEQUENCE IF NOT EXISTS kullanici_public_seq START 100000;

-- ---- B) Signup trigger: auth.users INSERT → kullanicilar -------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_seq BIGINT := nextval('public.kullanici_public_seq');
BEGIN
    -- Zaten köprülüyse (idempotent) dokunma
    IF EXISTS (SELECT 1 FROM public.kullanicilar WHERE auth_uid = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- kullanici_adi BENZERSİZ olmalı (uq_kullanicilar_ad). Stub atanır;
    -- gerçek görünen ad, uygulamanın profil adımında (uygunluk kontrolüyle) güncellenir.
    INSERT INTO public.kullanicilar (public_id, kullanici_adi, email, auth_uid)
    VALUES (
        'u' || lpad(v_seq::text, 8, '0'),
        'user_' || v_seq,
        NEW.email,
        NEW.id
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---- C) GÜVENLİ VARSAYILAN: tüm public tablolarında RLS aç -----------------
-- (Supabase, authenticated/anon rollerine public şemada geniş yetki verir;
--  RLS olmayan tablo herkese açıktır. Bu yüzden HEPSİNDE RLS açıyoruz.
--  Policy eklenmemiş tablo → client'a tamamen kapalı. service_role RLS'i bypass eder.)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- ---- D) Profil erişimi (Faz 1) ---------------------------------------------
-- Hassas kolonları (bakiye, kyc, risk, sifre_hash...) ASLA client'a açma.
-- Doğrudan kullanicilar erişimini güvenli kolonlarla sınırla:
REVOKE ALL ON public.kullanicilar FROM anon, authenticated;

GRANT SELECT (
    id, public_id, kullanici_adi, email, profil_resmi, biyografi,
    dogum_tarihi, cinsiyet, ulke, sehir, seviye_id, deneyim_puani,
    durum, ekonomi_rolu, auth_uid, olusturulma_tarihi
) ON public.kullanicilar TO authenticated;

GRANT UPDATE (
    kullanici_adi, profil_resmi, biyografi, dogum_tarihi, cinsiyet,
    ulke, sehir, durum
) ON public.kullanicilar TO authenticated;

-- Kendi satırını oku
DROP POLICY IF EXISTS kullanicilar_self_select ON kullanicilar;
CREATE POLICY kullanicilar_self_select ON kullanicilar
    FOR SELECT TO authenticated
    USING (auth_uid = (SELECT auth.uid()));

-- Kendi satırını güncelle (kolon yetkisi yukarıda kısıtlı)
DROP POLICY IF EXISTS kullanicilar_self_update ON kullanicilar;
CREATE POLICY kullanicilar_self_update ON kullanicilar
    FOR UPDATE TO authenticated
    USING (auth_uid = (SELECT auth.uid()))
    WITH CHECK (auth_uid = (SELECT auth.uid()));

-- Başkalarının herkese açık profili: yalnızca güvenli kolonlar (RLS'i bypass eden view)
CREATE OR REPLACE VIEW public.profiller WITH (security_invoker = off) AS
SELECT
    id, public_id, kullanici_adi, profil_resmi, biyografi,
    cinsiyet, ulke, sehir, seviye_id, deneyim_puani, durum,
    ekonomi_rolu, olusturulma_tarihi
FROM public.kullanicilar
WHERE silinmis = FALSE;

GRANT SELECT ON public.profiller TO authenticated, anon;

-- kullanici_adi uygunluk kontrolü için (case-insensitive) yardımcı RPC
CREATE OR REPLACE FUNCTION public.kullanici_adi_musait(p_ad TEXT)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp STABLE
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.kullanicilar
        WHERE LOWER(kullanici_adi) = LOWER(trim(p_ad)) AND silinmis = FALSE
    );
$$;
GRANT EXECUTE ON FUNCTION public.kullanici_adi_musait(TEXT) TO authenticated;
