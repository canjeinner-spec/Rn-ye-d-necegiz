-- ============================================================================
-- 047_ozel_id_admin.sql — Admin: kullanıcının beta/premium/özel-id durumunu OKU
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 044'ten SONRA. admin_hak_ata (yazma) zaten 044'te. Bu dosya büyük
-- admin_kullanici_getir'e dokunmadan yalnız hak alanlarını okur (yönetici).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_kullanici_haklar(p_hedef BIGINT)
RETURNS TABLE (beta_tester BOOLEAN, premium_hak BOOLEAN, ozel_id TEXT, ozel_id_tip TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT k.beta_tester, k.premium_hak, k.ozel_id::text, k.ozel_id_tip::text
      FROM public.kullanicilar k WHERE k.id = p_hedef;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_kullanici_haklar(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_haklar(BIGINT) TO authenticated;
