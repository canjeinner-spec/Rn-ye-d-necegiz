-- ============================================================================
-- 036_oda_yonet.sql — Yönetici oda düzenleme + genişletilmiş kullanıcı detayı
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 029 + 033 + 034 + 035'ten SONRA (Supabase SQL Editor).
--
--   • admin_oda_getir(oda): yönetici; oda bilgisi (özel oda dahil).
--   • admin_oda_guncelle(oda, ad, aciklama): yönetici düzenler + log.
--   • admin_oda_public_id_degistir(oda, yeni): DEVELOPER + log.
--   • admin_kullanici_getir: 029'daki sürümü DROP edip dondurma bayrakları +
--     hesap yasağı kolonlarıyla YENİDEN tanımlar (dönüş imzası değişti).
-- benim_kullanici_id() 003, ben_platform_yoneticisi() 021, ben_developer() 029,
-- _yonetici_log 033.
-- ============================================================================

-- ---- Oda getir (yönetici — özel oda dahil) ---------------------------------
CREATE OR REPLACE FUNCTION public.admin_oda_getir(p_oda BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, ad TEXT, aciklama TEXT, kategori TEXT, kapak_url TEXT,
    herkese_acik BOOLEAN, olusturan_id BIGINT, sahip_ad TEXT, sahip_public_id TEXT,
    uye_sayisi BIGINT, aktif_katilimci INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT o.id::bigint, o.public_id::text, o.ad::text, o.aciklama::text, o.kategori::text, o.kapak_url::text,
           o.herkese_acik::boolean, o.olusturan_id::bigint, k.kullanici_adi::text, k.public_id::text,
           (SELECT count(*) FROM public.oda_uyeleri u WHERE u.oda_id = o.id)::bigint,
           o.aktif_katilimci_sayisi::int
      FROM public.odalar o
      LEFT JOIN public.kullanicilar k ON k.id = o.olusturan_id
     WHERE o.id = p_oda;
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_getir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_oda_getir(BIGINT) TO authenticated;

-- ---- Oda güncelle (ad + açıklama) — yönetici -------------------------------
CREATE OR REPLACE FUNCTION public.admin_oda_guncelle(p_oda BIGINT, p_ad TEXT, p_aciklama TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    IF p_ad IS NULL OR length(trim(p_ad)) = 0 THEN
        RAISE EXCEPTION 'Oda adı boş olamaz.';
    END IF;
    UPDATE public.odalar
       SET ad = trim(p_ad), aciklama = NULLIF(trim(COALESCE(p_aciklama, '')), '')
     WHERE id = p_oda;
    PERFORM public._yonetici_log('oda', p_oda, 'oda_guncelle', 'Ad: ' || trim(p_ad));
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_guncelle(BIGINT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_oda_guncelle(BIGINT, TEXT, TEXT) TO authenticated;

-- ---- Oda ID (public_id) düzenle — DEVELOPER --------------------------------
CREATE OR REPLACE FUNCTION public.admin_oda_public_id_degistir(p_oda BIGINT, p_yeni TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_eski TEXT;
BEGIN
    IF NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Oda ID değişimi yalnızca developer yetkisiyle yapılır.';
    END IF;
    IF p_yeni IS NULL OR length(trim(p_yeni)) = 0 THEN
        RAISE EXCEPTION 'Geçersiz ID.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.odalar WHERE public_id = trim(p_yeni) AND id <> p_oda) THEN
        RAISE EXCEPTION 'Bu oda ID zaten kullanımda.';
    END IF;
    SELECT public_id INTO v_eski FROM public.odalar WHERE id = p_oda;
    UPDATE public.odalar SET public_id = trim(p_yeni) WHERE id = p_oda;
    PERFORM public._yonetici_log('oda', p_oda, 'oda_id_degistir', COALESCE(v_eski, '?') || ' → ' || trim(p_yeni));
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_public_id_degistir(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_oda_public_id_degistir(BIGINT, TEXT) TO authenticated;

-- ============================================================================
-- admin_kullanici_getir — dondurma + hesap yasağı kolonlarıyla (imza değişti)
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_kullanici_getir(BIGINT);
CREATE FUNCTION public.admin_kullanici_getir(p_hedef BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, kullanici_adi TEXT, profil_resmi TEXT,
    email TEXT, rol TEXT, seviye_id INT, deneyim_puani BIGINT,
    elmas BIGINT, altin BIGINT, elmas_dondu BOOLEAN, altin_dondu BOOLEAN,
    mic_yasakli BOOLEAN, mic_sebep TEXT, mic_bitis TIMESTAMPTZ,
    hesap_yasakli BOOLEAN, hesap_sebep TEXT, hesap_bitis TIMESTAMPTZ,
    rapor_sayisi BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT
        k.id::bigint, k.public_id::text, k.kullanici_adi::text, k.profil_resmi::text,
        (CASE WHEN public.ben_developer() THEN k.email ELSE NULL END)::text,
        k.ekonomi_rolu::text, k.seviye_id::int, COALESCE(k.deneyim_puani, 0)::bigint,
        COALESCE(c.elmas, 0)::bigint, COALESCE(c.altin, 0)::bigint,
        COALESCE(c.elmas_dondu, FALSE)::boolean, COALESCE(c.altin_dondu, FALSE)::boolean,
        (m.kullanici_id IS NOT NULL AND (m.bitis IS NULL OR m.bitis > now()))::boolean,
        m.sebep::text, m.bitis::timestamptz,
        (h.kullanici_id IS NOT NULL AND (h.bitis IS NULL OR h.bitis > now()))::boolean,
        h.sebep::text, h.bitis::timestamptz,
        (SELECT count(*) FROM public.sikayetler s WHERE s.hedef_kullanici_id = k.id)::bigint
    FROM public.kullanicilar k
    LEFT JOIN public.cuzdan c ON c.kullanici_id = k.id
    LEFT JOIN public.mic_yasaklari m ON m.kullanici_id = k.id
    LEFT JOIN public.hesap_yasaklari h ON h.kullanici_id = k.id
    WHERE k.id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.admin_kullanici_getir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_getir(BIGINT) TO authenticated;
