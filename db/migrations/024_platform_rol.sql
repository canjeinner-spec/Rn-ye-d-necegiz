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
    -- ekonomi_rolu bir ENUM: değeri katalogdan doğrula (025 ile eklenmiş olmalı)
    IF p_rol NOT IN ('user', 'developer', 'super_admin')
       OR NOT EXISTS (
           SELECT 1 FROM pg_enum e
             JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'ekonomi_rolu' AND e.enumlabel = p_rol
       ) THEN
        RAISE EXCEPTION 'Geçersiz rol: % (025_rol_enum_degerleri.sql çalıştırıldı mı?)', p_rol;
    END IF;
    SELECT ekonomi_rolu::text INTO v_benim FROM public.kullanicilar
     WHERE id = public.benim_kullanici_id();
    IF v_benim IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Rol atamak için süper yönetici olmalısın.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendi rolünü değiştiremezsin.';
    END IF;
    UPDATE public.kullanicilar SET ekonomi_rolu = p_rol::public.ekonomi_rolu WHERE id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.platform_rol_ata(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.platform_rol_ata(BIGINT, TEXT) TO authenticated;
