-- ============================================================================
-- 021_oda_uyeleri.sql — Oda üyeliği + oda içi roller (sahip / yardimci / uye)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003'ten SONRA (Supabase SQL Editor).
--
--   • oda_uyeleri: kalıcı üyelik grafiği. Oda kurulunca kuran otomatik
--     'sahip' olur (trigger); mevcut odalar backfill edilir.
--   • Herkes üye listesini okuyabilir; kendi adına yalnızca 'uye' olarak
--     katılabilir; sahip odadan ayrılamaz (odayı silmek ayrı iş).
--   • Rol atama ve üye çıkarma SECURITY DEFINER RPC'lerle: yetki kontrolü
--     fonksiyon içinde — client'a service_role asla gerekmez.
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.oda_uyeleri (
    oda_id          BIGINT      NOT NULL REFERENCES public.odalar(id) ON DELETE CASCADE,
    kullanici_id    BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    rol             TEXT        NOT NULL DEFAULT 'uye' CHECK (rol IN ('sahip', 'yardimci', 'uye')),
    katilma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (oda_id, kullanici_id)
);
CREATE INDEX IF NOT EXISTS idx_oda_uye_kullanici ON public.oda_uyeleri (kullanici_id);

ALTER TABLE public.oda_uyeleri ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oda_uyeleri FROM anon, authenticated;
GRANT SELECT (oda_id, kullanici_id, rol, katilma_tarihi) ON public.oda_uyeleri TO authenticated;
GRANT INSERT (oda_id, kullanici_id, rol) ON public.oda_uyeleri TO authenticated;
GRANT DELETE ON public.oda_uyeleri TO authenticated;

-- Üye listeleri herkese açık (sayaç + rol rozetleri için)
DROP POLICY IF EXISTS oda_uye_select ON public.oda_uyeleri;
CREATE POLICY oda_uye_select ON public.oda_uyeleri
    FOR SELECT TO authenticated USING (TRUE);

-- Kendi adına, yalnızca 'uye' olarak katıl
DROP POLICY IF EXISTS oda_uye_insert ON public.oda_uyeleri;
CREATE POLICY oda_uye_insert ON public.oda_uyeleri
    FOR INSERT TO authenticated
    WITH CHECK (kullanici_id = public.benim_kullanici_id() AND rol = 'uye');

-- Kendi üyeliğinden ayrıl (sahip ayrılamaz)
DROP POLICY IF EXISTS oda_uye_delete ON public.oda_uyeleri;
CREATE POLICY oda_uye_delete ON public.oda_uyeleri
    FOR DELETE TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() AND rol <> 'sahip');

-- ---- Oda kurulunca kuran 'sahip' olur -----------------------------------
CREATE OR REPLACE FUNCTION public.oda_sahibi_ekle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NEW.olusturan_id IS NOT NULL THEN
        INSERT INTO public.oda_uyeleri (oda_id, kullanici_id, rol)
        VALUES (NEW.id, NEW.olusturan_id, 'sahip')
        ON CONFLICT (oda_id, kullanici_id) DO UPDATE SET rol = 'sahip';
    END IF;
    RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_oda_sahibi ON public.odalar;
CREATE TRIGGER trg_oda_sahibi AFTER INSERT ON public.odalar
    FOR EACH ROW EXECUTE FUNCTION public.oda_sahibi_ekle();

-- Mevcut odaların sahiplerini backfill et
INSERT INTO public.oda_uyeleri (oda_id, kullanici_id, rol)
SELECT o.id, o.olusturan_id, 'sahip'
  FROM public.odalar o
 WHERE o.olusturan_id IS NOT NULL
ON CONFLICT (oda_id, kullanici_id) DO UPDATE SET rol = 'sahip';

-- ---- Yardımcı: platform yöneticisi mi? -----------------------------------
-- Not: ekonomi_rolu bir ENUM — ::text ile karşılaştırıyoruz ki enum'da
-- olmayan bir değer literal olarak parse hatası vermesin (22P02).
CREATE OR REPLACE FUNCTION public.ben_platform_yoneticisi()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.kullanicilar
         WHERE id = public.benim_kullanici_id()
           AND ekonomi_rolu::text IN ('developer', 'super_admin')
    );
$$;

-- ---- RPC: rol ata (yalnızca sahip veya platform yöneticisi) ---------------
CREATE OR REPLACE FUNCTION public.oda_rol_ata(p_oda_id BIGINT, p_hedef BIGINT, p_rol TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT;
BEGIN
    IF p_rol NOT IN ('yardimci', 'uye') THEN
        RAISE EXCEPTION 'Geçersiz rol.';
    END IF;
    SELECT rol INTO v_benim FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = public.benim_kullanici_id();
    IF v_benim IS DISTINCT FROM 'sahip' AND NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Rol atamak için oda sahibi olmalısın.';
    END IF;
    UPDATE public.oda_uyeleri SET rol = p_rol
     WHERE oda_id = p_oda_id AND kullanici_id = p_hedef AND rol <> 'sahip';
END; $$;
REVOKE ALL ON FUNCTION public.oda_rol_ata(BIGINT, BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_rol_ata(BIGINT, BIGINT, TEXT) TO authenticated;

-- ---- RPC: üye çıkar (sahip herkesi; yardımcı yalnızca 'uye'yi) -------------
CREATE OR REPLACE FUNCTION public.oda_uye_cikar(p_oda_id BIGINT, p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT; v_hedef TEXT;
BEGIN
    SELECT rol INTO v_benim FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = public.benim_kullanici_id();
    SELECT rol INTO v_hedef FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
    IF v_hedef IS NULL THEN RETURN; END IF;
    IF v_hedef = 'sahip' THEN
        RAISE EXCEPTION 'Oda sahibi çıkarılamaz.';
    END IF;
    IF public.ben_platform_yoneticisi()
       OR v_benim = 'sahip'
       OR (v_benim = 'yardimci' AND v_hedef = 'uye') THEN
        DELETE FROM public.oda_uyeleri WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
    ELSE
        RAISE EXCEPTION 'Bu üyeyi çıkarma yetkin yok.';
    END IF;
END; $$;
REVOKE ALL ON FUNCTION public.oda_uye_cikar(BIGINT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_uye_cikar(BIGINT, BIGINT) TO authenticated;
