-- ============================================================================
-- 024_platform_rol.sql — Platform rolü atama (yalnızca super_admin)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • platform_rol_ata: super_admin başka bir kullanıcıya 'user' |
--     'developer' | 'super_admin' rolü verir. Kendi rolünü değiştiremez
--     (yanlışlıkla kendini kilitlemesin). service_role client'a gerekmez.
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.platform_rol_ata(p_hedef BIGINT, p_rol TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT;
BEGIN
    IF p_rol NOT IN ('user', 'developer', 'super_admin') THEN
        RAISE EXCEPTION 'Geçersiz rol.';
    END IF;
    SELECT ekonomi_rolu INTO v_benim FROM public.kullanicilar
     WHERE id = public.benim_kullanici_id();
    IF v_benim IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Rol atamak için süper yönetici olmalısın.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendi rolünü değiştiremezsin.';
    END IF;
    UPDATE public.kullanicilar SET ekonomi_rolu = p_rol WHERE id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.platform_rol_ata(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.platform_rol_ata(BIGINT, TEXT) TO authenticated;
