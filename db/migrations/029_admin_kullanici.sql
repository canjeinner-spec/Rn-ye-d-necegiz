-- ============================================================================
-- 029_admin_kullanici.sql — Admin kullanıcı detayı + developer-özel işlemler
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021 + 027 + 028'den SONRA (Supabase SQL Editor).
--
--   • ben_developer(): yalnızca 'developer' rolü.
--   • admin_kullanici_getir(hedef): yönetici; profil + bakiye + rol + seviye/xp
--     + aktif mic-yasağı + rapor sayısı. E-POSTA YALNIZCA developer'a döner
--     (super_admin'e NULL).
--   • admin_public_id_degistir(hedef, yeni): DEVELOPER (benzersizlik kontrolü).
--   • admin_sifre_sifirla(hedef, yeni): DEVELOPER; auth.users şifresini
--     pgcrypto ile yeniden yazar (düz metin kimseye gösterilmez).
-- benim_kullanici_id() 003, ben_platform_yoneticisi() 021.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---- developer-özel yetki kontrolü -----------------------------------------
CREATE OR REPLACE FUNCTION public.ben_developer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.kullanicilar
         WHERE id = public.benim_kullanici_id()
           AND ekonomi_rolu::text = 'developer'
    );
$$;

-- ---- Admin kullanıcı detayı -------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_kullanici_getir(p_hedef BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, kullanici_adi TEXT, profil_resmi TEXT,
    email TEXT, rol TEXT, seviye_id INT, deneyim_puani BIGINT,
    elmas BIGINT, altin BIGINT,
    mic_yasakli BOOLEAN, mic_sebep TEXT, mic_bitis TIMESTAMPTZ,
    rapor_sayisi BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT
        k.id, k.public_id, k.kullanici_adi, k.profil_resmi,
        CASE WHEN public.ben_developer() THEN k.email ELSE NULL END,   -- e-posta yalnızca developer
        k.ekonomi_rolu::text, k.seviye_id, COALESCE(k.deneyim_puani, 0),
        COALESCE(c.elmas, 0), COALESCE(c.altin, 0),
        (m.kullanici_id IS NOT NULL AND (m.bitis IS NULL OR m.bitis > now())),
        m.sebep, m.bitis,
        (SELECT count(*) FROM public.sikayetler s WHERE s.hedef_kullanici_id = k.id)
    FROM public.kullanicilar k
    LEFT JOIN public.cuzdan c ON c.kullanici_id = k.id
    LEFT JOIN public.mic_yasaklari m ON m.kullanici_id = k.id
    WHERE k.id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.admin_kullanici_getir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_getir(BIGINT) TO authenticated;

-- ---- ID (public_id) düzenle — DEVELOPER ------------------------------------
CREATE OR REPLACE FUNCTION public.admin_public_id_degistir(p_hedef BIGINT, p_yeni TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Bu işlem yalnızca developer yetkisiyle yapılır.';
    END IF;
    IF p_yeni IS NULL OR length(trim(p_yeni)) = 0 THEN
        RAISE EXCEPTION 'Geçersiz ID.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.kullanicilar WHERE public_id = p_yeni AND id <> p_hedef) THEN
        RAISE EXCEPTION 'Bu ID zaten kullanımda.';
    END IF;
    UPDATE public.kullanicilar SET public_id = p_yeni WHERE id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.admin_public_id_degistir(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_public_id_degistir(BIGINT, TEXT) TO authenticated;

-- ---- Şifre sıfırla — DEVELOPER ---------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_sifre_sifirla(p_hedef BIGINT, p_yeni TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp, auth AS $$
DECLARE v_uid uuid;
BEGIN
    IF NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Bu işlem yalnızca developer yetkisiyle yapılır.';
    END IF;
    IF p_yeni IS NULL OR length(p_yeni) < 6 THEN
        RAISE EXCEPTION 'Şifre en az 6 karakter olmalı.';
    END IF;
    SELECT auth_uid INTO v_uid FROM public.kullanicilar WHERE id = p_hedef;
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Kullanıcının auth kaydı yok.'; END IF;
    UPDATE auth.users
       SET encrypted_password = extensions.crypt(p_yeni, extensions.gen_salt('bf'))
     WHERE id = v_uid;
END; $$;
REVOKE ALL ON FUNCTION public.admin_sifre_sifirla(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_sifre_sifirla(BIGINT, TEXT) TO authenticated;
