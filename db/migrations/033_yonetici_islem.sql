-- ============================================================================
-- 033_yonetici_islem.sql — Yönetici işlem günlüğü (denetim izi) + e-posta düzenleme
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 024 + 027 + 028 + 029'dan SONRA (Supabase SQL Editor).
--
-- Her yönetici işlemini (bakiye, mic yasağı, rol, ID, şifre, e-posta, oda…)
-- kim yaptı / kime / ne zaman kaydeder. Kullanıcı detayında "kaç kez işlem
-- yapıldı, kimler yaptı, ID kaç kez değişti" bundan türetilir.
--   • yonetici_islem_log: SELECT yalnızca platform yöneticisi; yazma yalnızca
--     SECURITY DEFINER RPC içinden (_yonetici_log) → sahtelenemez.
--   • Mevcut RPC'ler (bakiye_ekle, mic_yasak_ver/kaldir, platform_rol_ata,
--     admin_public_id_degistir, admin_sifre_sifirla) log yazacak şekilde
--     yeniden tanımlanır (idempotent — CREATE OR REPLACE).
--   • admin_email_degistir(hedef, yeni): DEVELOPER; auth.users + kullanicilar.
-- benim_kullanici_id() 003, ben_platform_yoneticisi() 021, ben_developer() 029.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.yonetici_islem_log (
    id         BIGSERIAL   PRIMARY KEY,
    yapan_id   BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    hedef_tip  TEXT        NOT NULL CHECK (hedef_tip IN ('kullanici', 'oda')),
    hedef_id   BIGINT      NOT NULL,
    islem      TEXT        NOT NULL,
    detay      TEXT,
    tarih      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_yonetici_log_hedef ON public.yonetici_islem_log (hedef_tip, hedef_id, id DESC);

ALTER TABLE public.yonetici_islem_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.yonetici_islem_log FROM anon, authenticated;
GRANT SELECT ON public.yonetici_islem_log TO authenticated;

DROP POLICY IF EXISTS yonetici_log_select ON public.yonetici_islem_log;
CREATE POLICY yonetici_log_select ON public.yonetici_islem_log
    FOR SELECT TO authenticated
    USING (public.ben_platform_yoneticisi());

-- ---- Dahili: log yaz (yapan = oturum sahibi) -------------------------------
CREATE OR REPLACE FUNCTION public._yonetici_log(p_tip TEXT, p_id BIGINT, p_islem TEXT, p_detay TEXT DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    INSERT INTO public.yonetici_islem_log (yapan_id, hedef_tip, hedef_id, islem, detay)
    VALUES (public.benim_kullanici_id(), p_tip, p_id, p_islem, p_detay);
$$;

-- ---- İşlem geçmişi okuyucu (yönetici) --------------------------------------
CREATE OR REPLACE FUNCTION public.admin_islem_gecmisi(p_tip TEXT, p_id BIGINT, p_limit INT DEFAULT 100)
RETURNS TABLE (
    id BIGINT, islem TEXT, detay TEXT, tarih TIMESTAMPTZ,
    yapan_id BIGINT, yapan_ad TEXT, yapan_public_id TEXT, yapan_rol TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT l.id::bigint, l.islem::text, l.detay::text, l.tarih::timestamptz,
           l.yapan_id::bigint, k.kullanici_adi::text, k.public_id::text, k.ekonomi_rolu::text
      FROM public.yonetici_islem_log l
      LEFT JOIN public.kullanicilar k ON k.id = l.yapan_id
     WHERE l.hedef_tip = p_tip AND l.hedef_id = p_id
     ORDER BY l.id DESC
     LIMIT p_limit;
END; $$;
REVOKE ALL ON FUNCTION public.admin_islem_gecmisi(TEXT, BIGINT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_islem_gecmisi(TEXT, BIGINT, INT) TO authenticated;

-- ============================================================================
-- Mevcut RPC'leri log yazacak şekilde YENİDEN TANIMLA (idempotent)
-- ============================================================================

-- bakiye ver/al (027) + log
CREATE OR REPLACE FUNCTION public.bakiye_ekle(p_hedef BIGINT, p_varlik TEXT, p_miktar BIGINT, p_sebep TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bakiye işlemi için yönetici olmalısın.';
    END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN
        RAISE EXCEPTION 'Geçersiz varlık.';
    END IF;
    IF p_miktar = 0 THEN RETURN; END IF;
    PERFORM public._bakiye_uygula(
        p_hedef, p_varlik, p_miktar,
        COALESCE(p_sebep, CASE WHEN p_miktar > 0 THEN 'Yönetici yükledi' ELSE 'Yönetici düştü' END),
        public.benim_kullanici_id());
    PERFORM public._yonetici_log('kullanici', p_hedef,
        CASE WHEN p_miktar > 0 THEN 'bakiye_ekle' ELSE 'bakiye_dus' END,
        (CASE WHEN p_varlik = 'elmas' THEN 'Elmas ' ELSE 'Altın ' END) || abs(p_miktar)::text
        || COALESCE(' · ' || p_sebep, ''));
EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Bakiye negatife düşemez.';
END; $$;

-- mic yasağı ver (028) + log
CREATE OR REPLACE FUNCTION public.mic_yasak_ver(p_hedef BIGINT, p_sebep TEXT DEFAULT NULL, p_dakika INT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bitis TIMESTAMPTZ;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Mic yasağı için yönetici olmalısın.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendine mic yasağı veremezsin.';
    END IF;
    IF p_dakika IS NOT NULL THEN
        IF p_dakika <= 0 THEN RAISE EXCEPTION 'Süre pozitif olmalı (ya da kalıcı için boş bırak).'; END IF;
        v_bitis := now() + make_interval(mins => p_dakika);
    END IF;
    INSERT INTO public.mic_yasaklari (kullanici_id, sebep, yasaklayan_id, bitis)
    VALUES (p_hedef, p_sebep, public.benim_kullanici_id(), v_bitis)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET sebep = EXCLUDED.sebep, yasaklayan_id = EXCLUDED.yasaklayan_id,
            bitis = EXCLUDED.bitis, olusturma = now();
    PERFORM public._yonetici_log('kullanici', p_hedef, 'mic_yasak_ver',
        (CASE WHEN v_bitis IS NULL THEN 'Kalıcı' ELSE to_char(v_bitis, 'YYYY-MM-DD HH24:MI') END)
        || COALESCE(' · ' || p_sebep, ''));
END; $$;

-- mic yasağı kaldır (028) + log
CREATE OR REPLACE FUNCTION public.mic_yasak_kaldir(p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yasak kaldırma için yönetici olmalısın.';
    END IF;
    DELETE FROM public.mic_yasaklari WHERE kullanici_id = p_hedef;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'mic_yasak_kaldir', NULL);
END; $$;

-- platform rol ata (024) + log
CREATE OR REPLACE FUNCTION public.platform_rol_ata(p_hedef BIGINT, p_rol TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT;
BEGIN
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
    PERFORM public._yonetici_log('kullanici', p_hedef, 'rol_ata', 'Yeni rol: ' || p_rol);
END; $$;

-- ID (public_id) düzenle (029) + log
CREATE OR REPLACE FUNCTION public.admin_public_id_degistir(p_hedef BIGINT, p_yeni TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_eski TEXT;
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
    SELECT public_id INTO v_eski FROM public.kullanicilar WHERE id = p_hedef;
    UPDATE public.kullanicilar SET public_id = p_yeni WHERE id = p_hedef;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'id_degistir',
        COALESCE(v_eski, '?') || ' → ' || p_yeni);
END; $$;

-- şifre sıfırla (029) + log (şifre içeriği loglanmaz)
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
    PERFORM public._yonetici_log('kullanici', p_hedef, 'sifre_sifirla', NULL);
END; $$;

-- ---- E-posta düzenle — DEVELOPER -------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_email_degistir(p_hedef BIGINT, p_yeni TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp, auth AS $$
DECLARE v_uid uuid; v_eski TEXT;
BEGIN
    IF NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Bu işlem yalnızca developer yetkisiyle yapılır.';
    END IF;
    IF p_yeni IS NULL OR position('@' in p_yeni) = 0 THEN
        RAISE EXCEPTION 'Geçersiz e-posta.';
    END IF;
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(p_yeni)) AND id <> (SELECT auth_uid FROM public.kullanicilar WHERE id = p_hedef)) THEN
        RAISE EXCEPTION 'Bu e-posta zaten kullanımda.';
    END IF;
    SELECT auth_uid, email INTO v_uid, v_eski FROM public.kullanicilar WHERE id = p_hedef;
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Kullanıcının auth kaydı yok.'; END IF;
    UPDATE auth.users
       SET email = lower(trim(p_yeni)),
           email_confirmed_at = COALESCE(email_confirmed_at, now())
     WHERE id = v_uid;
    UPDATE public.kullanicilar SET email = lower(trim(p_yeni)) WHERE id = p_hedef;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'email_degistir',
        COALESCE(v_eski, '?') || ' → ' || lower(trim(p_yeni)));
END; $$;
REVOKE ALL ON FUNCTION public.admin_email_degistir(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_email_degistir(BIGINT, TEXT) TO authenticated;
