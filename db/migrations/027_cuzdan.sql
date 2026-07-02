-- ============================================================================
-- 027_cuzdan.sql — Cüzdan (elmas + altın) gerçek bakiye + işlem defteri
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
-- Kendi temiz cüzdanımız (schema_v7'nin cuzdanlar/wallet_ledger tabloları
-- repo'da tanımsız → dokunmuyoruz, dormant kalır). Bundan sonra bakiye
-- kaynağı BURASI.
--   • cuzdan: kullanıcı başına elmas + altın bakiyesi (herkes kendi okur).
--   • cuzdan_hareketleri: işlem defteri (kendi geçmişini okur).
--   • bakiye_ekle: YÖNETİCİ (developer/super_admin) ver/al.
--   • bakiye_transfer: KULLANICI → kullanıcı gönderim (tam ekonomi).
--   • benim_bakiyem: kendi bakiyeni döndürür.
-- Gerçek parayla elmas SATIN ALMA (IAP) bu dosyada YOK — mağaza gerektirir.
-- benim_kullanici_id() 003'te, ben_platform_yoneticisi() 021'de tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cuzdan (
    kullanici_id BIGINT      PRIMARY KEY REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    elmas        BIGINT      NOT NULL DEFAULT 0 CHECK (elmas >= 0),
    altin        BIGINT      NOT NULL DEFAULT 0 CHECK (altin >= 0),
    guncelleme   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cuzdan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cuzdan FROM anon, authenticated;
GRANT SELECT (kullanici_id, elmas, altin, guncelleme) ON public.cuzdan TO authenticated;

DROP POLICY IF EXISTS cuzdan_select ON public.cuzdan;
CREATE POLICY cuzdan_select ON public.cuzdan
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

CREATE TABLE IF NOT EXISTS public.cuzdan_hareketleri (
    id           BIGSERIAL   PRIMARY KEY,
    kullanici_id BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    varlik       TEXT        NOT NULL CHECK (varlik IN ('elmas', 'altin')),
    miktar       BIGINT      NOT NULL, -- +/-
    sebep        TEXT,
    yapan_id     BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    tarih        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cuzdan_hareket_kul ON public.cuzdan_hareketleri (kullanici_id, id DESC);
ALTER TABLE public.cuzdan_hareketleri ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cuzdan_hareketleri FROM anon, authenticated;
GRANT SELECT ON public.cuzdan_hareketleri TO authenticated;

DROP POLICY IF EXISTS cuzdan_hareket_select ON public.cuzdan_hareketleri;
CREATE POLICY cuzdan_hareket_select ON public.cuzdan_hareketleri
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

-- ---- Dahili: bakiye uygula (varlık kolonu dinamik, negatife düşmez) --------
CREATE OR REPLACE FUNCTION public._bakiye_uygula(p_kul BIGINT, p_varlik TEXT, p_delta BIGINT, p_sebep TEXT, p_yapan BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    INSERT INTO public.cuzdan (kullanici_id) VALUES (p_kul)
    ON CONFLICT (kullanici_id) DO NOTHING;

    IF p_varlik = 'elmas' THEN
        UPDATE public.cuzdan SET elmas = elmas + p_delta, guncelleme = now() WHERE kullanici_id = p_kul;
    ELSE
        UPDATE public.cuzdan SET altin = altin + p_delta, guncelleme = now() WHERE kullanici_id = p_kul;
    END IF;

    INSERT INTO public.cuzdan_hareketleri (kullanici_id, varlik, miktar, sebep, yapan_id)
    VALUES (p_kul, p_varlik, p_delta, p_sebep, p_yapan);
END; $$;

-- ---- RPC: yönetici ver/al ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.bakiye_ekle(p_hedef BIGINT, p_varlik TEXT, p_miktar BIGINT, p_sebep TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bakiye işlemi için yönetici olmalısın.';
    END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN
        RAISE EXCEPTION 'Geçersiz varlık.';
    END IF;
    IF p_miktar = 0 THEN RETURN; END IF;
    PERFORM public._bakiye_uygula(
        p_hedef, p_varlik, p_miktar,
        COALESCE(p_sebep, CASE WHEN p_miktar > 0 THEN 'Yönetici yükledi' ELSE 'Yönetici düştü' END),
        public.benim_kullanici_id());
EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Bakiye negatife düşemez.';
END; $$;
REVOKE ALL ON FUNCTION public.bakiye_ekle(BIGINT, TEXT, BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.bakiye_ekle(BIGINT, TEXT, BIGINT, TEXT) TO authenticated;

-- ---- RPC: kullanıcı → kullanıcı transfer ------------------------------------
CREATE OR REPLACE FUNCTION public.bakiye_transfer(p_hedef BIGINT, p_varlik TEXT, p_miktar BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_hedef = v_ben THEN RAISE EXCEPTION 'Kendine transfer yapamazsın.'; END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN RAISE EXCEPTION 'Geçersiz varlık.'; END IF;
    IF p_miktar <= 0 THEN RAISE EXCEPTION 'Miktar pozitif olmalı.'; END IF;

    -- Önce kendinden düş (negatife düşerse check_violation → yetersiz bakiye)
    BEGIN
        PERFORM public._bakiye_uygula(v_ben, p_varlik, -p_miktar, 'Transfer (gönderildi)', v_ben);
    EXCEPTION WHEN check_violation THEN
        RAISE EXCEPTION 'Yetersiz bakiye.';
    END;
    PERFORM public._bakiye_uygula(p_hedef, p_varlik, p_miktar, 'Transfer (alındı)', v_ben);
END; $$;
REVOKE ALL ON FUNCTION public.bakiye_transfer(BIGINT, TEXT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.bakiye_transfer(BIGINT, TEXT, BIGINT) TO authenticated;

-- ---- RPC: kendi bakiyem -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.benim_bakiyem()
RETURNS TABLE (elmas BIGINT, altin BIGINT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE(c.elmas, 0), COALESCE(c.altin, 0)
      FROM (SELECT public.benim_kullanici_id() AS id) me
      LEFT JOIN public.cuzdan c ON c.kullanici_id = me.id;
$$;
REVOKE ALL ON FUNCTION public.benim_bakiyem() FROM public;
GRANT EXECUTE ON FUNCTION public.benim_bakiyem() TO authenticated;
