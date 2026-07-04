-- ============================================================================
-- 045_public_id_9hane.sql — Yeni kayıtlara 9+ haneli public_id
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 016'dan SONRA. Idempotent (OR REPLACE).
--
-- Neden: Özel ID'ler (kapsül 6-7, premium ≤5 hane) NADİR/anlamlı olsun diye,
-- normal kayıt olan kullanıcılara 9+ haneli ID verilir. 9+ hane ile ≤7 haneli
-- özel ID'ler ASLA çakışmaz → arama iki kolonu da eşleştirebilir, çift anlam yok.
--
-- NOT: Mevcut kullanıcılar BACKFILL EDİLMEZ (ID'leri korunur). Sadece yeni kayıt.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.yeni_public_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_id  TEXT;
    v_try INT := 0;
BEGIN
    LOOP
        -- [100000000, 999999999] → 9 hane
        v_id := (floor(random() * 900000000) + 100000000)::bigint::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE public_id = v_id);
        v_try := v_try + 1;
        IF v_try > 50 THEN
            -- güvenlik supabı: 10 haneli aralığa çık
            v_id := (floor(random() * 9000000000) + 1000000000)::bigint::text;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE public_id = v_id);
        END IF;
    END LOOP;
    RETURN v_id;
END;
$$;
