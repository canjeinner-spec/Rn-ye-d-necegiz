-- ============================================================================
-- 031_admin_icerik.sql — Yönetici içerik kontrolü (akışta gönderi silme)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 008 (gonderi_sil) + 021'den SONRA (Supabase SQL Editor).
--
-- Mevcut gonderi_sil (008) sahiplik kontrollüdür (kendi gönderini silersin).
-- Bu RPC yöneticiye (developer/super_admin) BAŞKASININ gönderisini de
-- silme yetkisi verir (soft-delete). benim_kullanici_id() 003,
-- ben_platform_yoneticisi() 021.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_gonderi_sil(p_gonderi_id BIGINT)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count INTEGER;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    UPDATE public.gonderiler
       SET silinmis = TRUE, silinme_tarihi = now()
     WHERE id = p_gonderi_id AND silinmis = FALSE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
END; $$;
REVOKE ALL ON FUNCTION public.admin_gonderi_sil(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_gonderi_sil(BIGINT) TO authenticated;
