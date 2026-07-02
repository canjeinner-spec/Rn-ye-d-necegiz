-- 038_admin_kimlik.sql — Rol atama developer-only; ad/avatar düzenleme (tüm
-- yöneticiler); e-posta tüm yöneticilere görünür (düzenleme developer); kayıt tarihi.

-- Rol atama: yalnızca developer
CREATE OR REPLACE FUNCTION public.platform_rol_ata(p_hedef BIGINT, p_rol TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF p_rol NOT IN ('user', 'developer', 'super_admin')
       OR NOT EXISTS (
           SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'ekonomi_rolu' AND e.enumlabel = p_rol
       ) THEN
        RAISE EXCEPTION 'Geçersiz rol: %', p_rol;
    END IF;
    IF NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Rol atamak yalnızca developer yetkisindedir.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendi rolünü değiştiremezsin.';
    END IF;
    UPDATE public.kullanicilar SET ekonomi_rolu = p_rol::public.ekonomi_rolu WHERE id = p_hedef;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'rol_ata', 'Yeni rol: ' || p_rol);
END; $$;

-- Ad + avatar düzenle (developer & super_admin). NULL = dokunma, '' avatar = kaldır.
CREATE OR REPLACE FUNCTION public.admin_kullanici_guncelle(p_hedef BIGINT, p_ad TEXT DEFAULT NULL, p_avatar TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    IF p_ad IS NOT NULL THEN
        IF length(trim(p_ad)) < 2 THEN RAISE EXCEPTION 'Ad en az 2 karakter olmalı.'; END IF;
        IF EXISTS (SELECT 1 FROM public.kullanicilar WHERE lower(kullanici_adi) = lower(trim(p_ad)) AND id <> p_hedef) THEN
            RAISE EXCEPTION 'Bu kullanıcı adı alınmış.';
        END IF;
        UPDATE public.kullanicilar SET kullanici_adi = trim(p_ad) WHERE id = p_hedef;
        PERFORM public._yonetici_log('kullanici', p_hedef, 'ad_degistir', trim(p_ad));
    END IF;
    IF p_avatar IS NOT NULL THEN
        UPDATE public.kullanicilar SET profil_resmi = NULLIF(trim(p_avatar), '') WHERE id = p_hedef;
        PERFORM public._yonetici_log('kullanici', p_hedef, 'avatar_degistir',
            CASE WHEN length(trim(p_avatar)) = 0 THEN 'Kaldırıldı' ELSE 'Güncellendi' END);
    END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_kullanici_guncelle(BIGINT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_guncelle(BIGINT, TEXT, TEXT) TO authenticated;

-- Detay: e-posta tüm yöneticilere, + kayıt tarihi (imza değişti → DROP)
DROP FUNCTION IF EXISTS public.admin_kullanici_getir(BIGINT);
CREATE FUNCTION public.admin_kullanici_getir(p_hedef BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, kullanici_adi TEXT, profil_resmi TEXT,
    email TEXT, rol TEXT, seviye_id INT, deneyim_puani BIGINT,
    elmas BIGINT, altin BIGINT, elmas_dondu BOOLEAN, altin_dondu BOOLEAN,
    mic_yasakli BOOLEAN, mic_sebep TEXT, mic_bitis TIMESTAMPTZ,
    hesap_yasakli BOOLEAN, hesap_sebep TEXT, hesap_bitis TIMESTAMPTZ,
    rapor_sayisi BIGINT, kayit_tarihi TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    RETURN QUERY
    SELECT
        k.id::bigint, k.public_id::text, k.kullanici_adi::text, k.profil_resmi::text,
        k.email::text,
        k.ekonomi_rolu::text, k.seviye_id::int, COALESCE(k.deneyim_puani, 0)::bigint,
        COALESCE(c.elmas, 0)::bigint, COALESCE(c.altin, 0)::bigint,
        COALESCE(c.elmas_dondu, FALSE)::boolean, COALESCE(c.altin_dondu, FALSE)::boolean,
        (m.kullanici_id IS NOT NULL AND (m.bitis IS NULL OR m.bitis > now()))::boolean,
        m.sebep::text, m.bitis::timestamptz,
        (h.kullanici_id IS NOT NULL AND (h.bitis IS NULL OR h.bitis > now()))::boolean,
        h.sebep::text, h.bitis::timestamptz,
        (SELECT count(*) FROM public.sikayetler s WHERE s.hedef_kullanici_id = k.id)::bigint,
        au.created_at::timestamptz
    FROM public.kullanicilar k
    LEFT JOIN public.cuzdan c ON c.kullanici_id = k.id
    LEFT JOIN public.mic_yasaklari m ON m.kullanici_id = k.id
    LEFT JOIN public.hesap_yasaklari h ON h.kullanici_id = k.id
    LEFT JOIN auth.users au ON au.id = k.auth_uid
    WHERE k.id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.admin_kullanici_getir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_getir(BIGINT) TO authenticated;
