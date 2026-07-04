-- ============================================================================
-- 044_ozel_id.sql — ÖZEL ID (vitrin kimliği) + beta/premium HAK (entitlement)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 016 + 041/043'ten SONRA (Supabase SQL Editor). Idempotent.
--
--   • kullanicilar'a ozel_id / ozel_id_tip / ozel_id_tema + beta_tester +
--     premium_hak kolonları.
--   • ozel_id AYRI vitrin kolonu — public_id DEĞİŞMEZ (DM/link/işlem sabit).
--     UI'da public_id yerine ozel_id gösterilir. public_id 9+ hane (045),
--     ozel_id ≤7 hane → asla çakışmaz; arama iki kolonu da eşler.
--   • KRİTİK: kimse kendi kafasına özel ID ALAMAZ. beta_tester → yalnız KAPSÜL
--     (6-7 hane); premium_hak → PREMIUM (≤5 hane). RPC bunu ZORLAR (SECURITY
--     DEFINER); beta_tester/premium_hak kullanıcıya UPDATE edilemez (admin atar).
-- ============================================================================

-- ---- 1) Kolonlar -----------------------------------------------------------
ALTER TABLE public.kullanicilar
    ADD COLUMN IF NOT EXISTS ozel_id      TEXT,
    ADD COLUMN IF NOT EXISTS ozel_id_tip  TEXT,
    ADD COLUMN IF NOT EXISTS ozel_id_tema TEXT,
    ADD COLUMN IF NOT EXISTS beta_tester  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS premium_hak  BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.kullanicilar DROP CONSTRAINT IF EXISTS chk_ozel_id_tip;
ALTER TABLE public.kullanicilar ADD CONSTRAINT chk_ozel_id_tip
    CHECK (ozel_id_tip IS NULL OR ozel_id_tip IN ('premium', 'kapsul'));

-- Özel ID benzersiz (yalnızca dolu olanlar)
CREATE UNIQUE INDEX IF NOT EXISTS uq_kullanicilar_ozel_id
    ON public.kullanicilar (ozel_id) WHERE ozel_id IS NOT NULL;

-- ---- 2) Okuma yetkisi (kendi satırı). UPDATE grant YOK → yalnız RPC yazar ----
GRANT SELECT (ozel_id, ozel_id_tip, ozel_id_tema, beta_tester, premium_hak)
    ON public.kullanicilar TO authenticated;

-- ---- 3) profiller view'ini özel ID kolonlarıyla yeniden oluştur -------------
CREATE OR REPLACE VIEW public.profiller WITH (security_invoker = off) AS
SELECT
    id, public_id, kullanici_adi, profil_resmi, biyografi,
    cinsiyet, ulke, sehir, seviye_id, deneyim_puani, durum,
    ekonomi_rolu, ozel_id, ozel_id_tip, ozel_id_tema, olusturulma_tarihi
FROM public.kullanicilar
WHERE silinmis = FALSE;
GRANT SELECT ON public.profiller TO authenticated, anon;

-- ---- 4) RPC: özel ID ayarla (entitlement + basamak + benzersizlik) ----------
CREATE OR REPLACE FUNCTION public.ozel_id_ayarla(p_id TEXT, p_tip TEXT, p_tema TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid  BIGINT;
    v_beta BOOLEAN;
    v_prem BOOLEAN;
    v_len  INT;
BEGIN
    SELECT id, beta_tester, premium_hak INTO v_uid, v_beta, v_prem
        FROM public.kullanicilar WHERE auth_uid = (SELECT auth.uid());
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    p_id := trim(coalesce(p_id, ''));
    IF p_id !~ '^[0-9]+$' THEN RAISE EXCEPTION 'ID yalnızca rakamlardan oluşmalı.'; END IF;
    IF coalesce(trim(p_tema), '') = '' THEN RAISE EXCEPTION 'Bir tema seçmelisin.'; END IF;
    v_len := length(p_id);

    IF p_tip = 'premium' THEN
        IF NOT v_prem THEN RAISE EXCEPTION 'Premium özel ID hakkın yok.'; END IF;
        IF v_len < 1 OR v_len > 5 THEN RAISE EXCEPTION 'Premium ID en fazla 5 hane olmalı.'; END IF;
    ELSIF p_tip = 'kapsul' THEN
        IF NOT (v_beta OR v_prem) THEN RAISE EXCEPTION 'Kapsül özel ID hakkın yok.'; END IF;
        IF v_len < 6 OR v_len > 7 THEN RAISE EXCEPTION 'Kapsül ID 6 veya 7 hane olmalı.'; END IF;
    ELSE
        RAISE EXCEPTION 'Geçersiz tip.';
    END IF;

    -- Benzersizlik: HEM public_id HEM ozel_id (kendi satırı hariç)
    IF EXISTS (
        SELECT 1 FROM public.kullanicilar
        WHERE id <> v_uid AND (public_id = p_id OR ozel_id = p_id)
    ) THEN
        RAISE EXCEPTION 'Bu ID zaten kullanımda.';
    END IF;

    UPDATE public.kullanicilar
        SET ozel_id = p_id, ozel_id_tip = p_tip, ozel_id_tema = trim(p_tema)
        WHERE id = v_uid;
END;
$$;
REVOKE ALL ON FUNCTION public.ozel_id_ayarla(TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.ozel_id_ayarla(TEXT, TEXT, TEXT) TO authenticated;

-- ---- 5) RPC: özel ID kaldır ------------------------------------------------
CREATE OR REPLACE FUNCTION public.ozel_id_kaldir()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.kullanicilar
        SET ozel_id = NULL, ozel_id_tip = NULL, ozel_id_tema = NULL
        WHERE auth_uid = (SELECT auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.ozel_id_kaldir() FROM public;
GRANT EXECUTE ON FUNCTION public.ozel_id_kaldir() TO authenticated;

-- ---- 6) Admin: beta/premium HAK atama (yalnız developer/super_admin + log) --
CREATE OR REPLACE FUNCTION public.admin_hak_ata(p_hedef BIGINT, p_alan TEXT, p_deger BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkisiz.'; END IF;
    IF p_alan NOT IN ('beta_tester', 'premium_hak') THEN RAISE EXCEPTION 'Geçersiz alan.'; END IF;

    IF p_alan = 'beta_tester' THEN
        UPDATE public.kullanicilar SET beta_tester = p_deger WHERE id = p_hedef;
    ELSE
        UPDATE public.kullanicilar SET premium_hak = p_deger WHERE id = p_hedef;
    END IF;

    PERFORM public._yonetici_log('kullanici', p_hedef,
        (CASE WHEN p_deger THEN 'hak_ver' ELSE 'hak_al' END),
        jsonb_build_object('alan', p_alan));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_hak_ata(BIGINT, TEXT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_hak_ata(BIGINT, TEXT, BOOLEAN) TO authenticated;
