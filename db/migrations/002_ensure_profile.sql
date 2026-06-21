-- ============================================================================
-- 002_ensure_profile.sql — Profil satırı kendi kendini onarma (self-heal)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001_auth_bridge.sql'den SONRA (Supabase SQL Editor).
--
-- Neden: kullanicilar satırı normalde auth.users INSERT trigger'ıyla oluşur.
-- Ancak satır elle silinirse (auth.users dururken), giriş yapan kullanıcı
-- profilsiz kalır. Bu RPC, auth.uid() için satır yoksa stub satırı yeniden
-- oluşturur. SECURITY DEFINER → client'a INSERT yetkisi/policy gerekmez.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.profilimi_garantile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_email TEXT;
    v_seq   BIGINT;
BEGIN
    IF v_uid IS NULL THEN
        RETURN; -- oturum yok
    END IF;

    IF EXISTS (SELECT 1 FROM public.kullanicilar WHERE auth_uid = v_uid) THEN
        RETURN; -- zaten var
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    v_seq := nextval('public.kullanici_public_seq');

    INSERT INTO public.kullanicilar (public_id, kullanici_adi, email, auth_uid)
    VALUES (
        'u' || lpad(v_seq::text, 8, '0'),
        'user_' || v_seq,
        v_email,
        v_uid
    )
    ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.profilimi_garantile() TO authenticated;
