-- ============================================================================
-- 076_search_path_pg_temp.sql — Tek eksik pg_temp tamamlanıyor
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 075'ten SONRA. İdempotent (CREATE OR REPLACE, imza aynı).
--
-- NEDEN: projedeki bütün SECURITY DEFINER fonksiyonlar
-- `SET search_path = public, pg_temp` kullanıyor; 055'teki
-- `oda_ziyaret_kaydet` TEK istisnaydı (`public` yalnız). pg_temp sona
-- eklenmezse çağıranın geçici şeması araya girip aynı adlı nesneyle
-- fonksiyonu gölgeleyebilir. Gövde birebir aynı; değişen yalnız SET satırı.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.oda_ziyaret_kaydet(p_oda_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ben BIGINT;
BEGIN
    v_ben := public.benim_kullanici_id();
    IF v_ben IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.oda_ziyaretleri (kullanici_id, oda_id)
    VALUES (v_ben, p_oda_id)
    ON CONFLICT (kullanici_id, oda_id) DO UPDATE
        SET son_giris    = now(),
            giris_sayisi = public.oda_ziyaretleri.giris_sayisi + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.oda_ziyaret_kaydet(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_ziyaret_kaydet(BIGINT) TO authenticated;
