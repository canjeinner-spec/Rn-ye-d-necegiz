-- ============================================================================
-- 016_clean_public_ids.sql — Temiz rastgele public_id (kullanıcı ID'leri)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001'den SONRA (Supabase SQL Editor).
--
--   • Yeni kullanıcılara 6-7 haneli RASTGELE temiz sayısal ID (100000-9999999)
--   • Kısa ID'ler (≤5 hane) özel/yetkili ID'ler için boş bırakılır
--   • Kayıt trigger'ı güncellenir ('u00...' placeholder yerine)
--   • Mevcut TÜM hesaplar yeni biçime dönüştürülür (backfill)
-- ============================================================================

-- ---- 1) Benzersiz rastgele 6-7 haneli ID üretici ---------------------------
CREATE OR REPLACE FUNCTION public.yeni_public_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_id  TEXT;
    v_try INT := 0;
BEGIN
    LOOP
        -- [100000, 9999999] → 6-7 hane
        v_id := (floor(random() * 9900000) + 100000)::bigint::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE public_id = v_id);
        v_try := v_try + 1;
        IF v_try > 50 THEN
            -- güvenlik supabı: 8 haneli aralığa çık
            v_id := (floor(random() * 90000000) + 10000000)::bigint::text;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE public_id = v_id);
        END IF;
    END LOOP;
    RETURN v_id;
END;
$$;

-- ---- 2) Kayıt trigger'ını güncelle -----------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_pub TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.kullanicilar WHERE auth_uid = NEW.id) THEN
        RETURN NEW;
    END IF;

    v_pub := public.yeni_public_id();

    INSERT INTO public.kullanicilar (public_id, kullanici_adi, email, auth_uid)
    VALUES (
        v_pub,
        'user_' || v_pub,          -- benzersiz stub ad; profil adımında gerçek adla değişir
        NEW.email,
        NEW.id
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

-- ---- 3) Mevcut hesapları backfill et ---------------------------------------
-- Tüm kullanıcılara yeni temiz ID ver (her biri o anki tabloda benzersiz üretilir).
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.kullanicilar LOOP
        UPDATE public.kullanicilar SET public_id = public.yeni_public_id() WHERE id = r.id;
    END LOOP;
END $$;
