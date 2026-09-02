-- ============================================================================
-- 075_admin_eposta_kisiti.sql — E-posta yine yalnız developer'a görünsün
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 074'ten SONRA. İdempotent (CREATE OR REPLACE, imza aynı).
--
-- NEDEN (regresyon): 029'da e-posta yalnız `ben_developer()` iken dolu
-- dönüyordu. 038 fonksiyonu yeniden yazarken bu kısıtı DÜŞÜRDÜ, 067 de
-- düşmüş halini taşıdı — her super_admin e-posta görüyordu. Bu dosya 029'un
-- asıl davranışını geri getiriyor; değişen tek satır e-posta CASE'i.
--
-- İSTEMCİ DEĞİŞİKLİĞİ SIFIR: adminRepo `email: r.email ?? null` ve
-- admin-user-edit `d.email || "—"` null'u zaten işliyor (tip yorumu da
-- "yalnızca developer'a dolu gelir" diyor — kod artık yoruma uyuyor).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_kullanici_getir(p_hedef BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, kullanici_adi TEXT, profil_resmi TEXT,
    email TEXT, rol TEXT, seviye_id INT, deneyim_puani BIGINT,
    elmas BIGINT, altin BIGINT, elmas_dondu BOOLEAN, altin_dondu BOOLEAN,
    mic_yasakli BOOLEAN, mic_sebep TEXT, mic_bitis TIMESTAMPTZ,
    hesap_yasakli BOOLEAN, hesap_sebep TEXT, hesap_bitis TIMESTAMPTZ,
    rapor_sayisi BIGINT, kayit_tarihi TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    RETURN QUERY
    SELECT
        k.id::bigint, k.public_id::text, k.kullanici_adi::text, k.profil_resmi::text,
        -- 075: e-posta yalnız developer'a (029'un asıl davranışı; 038'de düşmüştü)
        CASE WHEN public.ben_developer() THEN k.email::text ELSE NULL END,
        k.ekonomi_rolu::text, k.seviye_id::int, COALESCE(k.deneyim_puani, 0)::bigint,
        -- 067: ölü `cuzdan` yerine temel defterin cache'i (062 ile aynı kaynak)
        COALESCE(k.cached_total_balance, 0)::bigint,
        COALESCE(k.cached_altin_balance, 0)::bigint,
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
END; $fn$;
REVOKE ALL ON FUNCTION public.admin_kullanici_getir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_getir(BIGINT) TO authenticated;
