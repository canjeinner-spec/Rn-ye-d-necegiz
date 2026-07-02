-- ============================================================================
-- 026_xp.sql — Seviye/XP sistemi (deneyim kazanma + seviye güncelleme)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • xp_gunluk: kaynak başına günlük tavan takibi (client erişimi YOK).
--   • xp_ekle(kaynak): puan yazar, tavanı uygular, seviyeler tablosundan
--     seviye_id'yi günceller. Dönen değer: gerçekten kazanılan puan.
--       gunluk_giris → 20 puan (günde 1 kez)
--       oda_katilim  → 10 puan (günde 1 kez)
--       oda_mesaj    →  2 puan (günde en çok 40 = 20 mesaj)
--   • seviyeler tablosu client'a okunur yapılır (referans verisi) ve boşsa
--     basit eğriyle seed edilir (LV n eşiği = 100·(n−1)², n=1..30).
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.xp_gunluk (
    kullanici_id BIGINT NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    gun          DATE   NOT NULL DEFAULT CURRENT_DATE,
    kaynak       TEXT   NOT NULL,
    miktar       INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (kullanici_id, gun, kaynak)
);
ALTER TABLE public.xp_gunluk ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_gunluk FROM anon, authenticated; -- yalnızca RPC içi

-- ---- seviyeler: okunabilir referans verisi + boşsa seed ---------------------
DO $$
BEGIN
    IF to_regclass('public.seviyeler') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT ON public.seviyeler TO authenticated';
        EXECUTE 'ALTER TABLE public.seviyeler ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS seviyeler_select ON public.seviyeler';
        EXECUTE 'CREATE POLICY seviyeler_select ON public.seviyeler FOR SELECT TO authenticated USING (TRUE)';
        -- Boşsa basit eğriyle doldur (kolonlar uymazsa sessizce geç)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM public.seviyeler) THEN
                INSERT INTO public.seviyeler (id, ad, minimum_deneyim_puani)
                SELECT n, 'LV ' || n, 100 * (n - 1) * (n - 1)
                  FROM generate_series(1, 30) AS n;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'seviyeler seed atlandı: %', SQLERRM;
        END;
    END IF;
END $$;

-- ---- RPC: xp_ekle -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.xp_ekle(p_kaynak TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_uid    BIGINT := public.benim_kullanici_id();
    v_puan   INT;
    v_tavan  INT;
    v_onceki INT;
    v_delta  INT;
    v_xp     BIGINT;
BEGIN
    IF v_uid IS NULL THEN RETURN 0; END IF;

    CASE p_kaynak
        WHEN 'gunluk_giris' THEN v_puan := 20; v_tavan := 20;
        WHEN 'oda_katilim'  THEN v_puan := 10; v_tavan := 10;
        WHEN 'oda_mesaj'    THEN v_puan := 2;  v_tavan := 40;
        ELSE RETURN 0;
    END CASE;

    -- Günlük tavan: upsert edip gerçek artışı (delta) hesapla
    INSERT INTO public.xp_gunluk (kullanici_id, gun, kaynak, miktar)
    VALUES (v_uid, CURRENT_DATE, p_kaynak, 0)
    ON CONFLICT (kullanici_id, gun, kaynak) DO NOTHING;

    SELECT miktar INTO v_onceki FROM public.xp_gunluk
     WHERE kullanici_id = v_uid AND gun = CURRENT_DATE AND kaynak = p_kaynak
     FOR UPDATE;

    v_delta := LEAST(v_tavan, v_onceki + v_puan) - v_onceki;
    IF v_delta <= 0 THEN RETURN 0; END IF;

    UPDATE public.xp_gunluk SET miktar = v_onceki + v_delta
     WHERE kullanici_id = v_uid AND gun = CURRENT_DATE AND kaynak = p_kaynak;

    UPDATE public.kullanicilar
       SET deneyim_puani = COALESCE(deneyim_puani, 0) + v_delta
     WHERE id = v_uid
     RETURNING deneyim_puani INTO v_xp;

    -- Seviyeyi eşik tablosundan güncelle (satır yoksa dokunma — FK-güvenli)
    IF to_regclass('public.seviyeler') IS NOT NULL THEN
        UPDATE public.kullanicilar k
           SET seviye_id = s.id
          FROM (
                SELECT id FROM public.seviyeler
                 WHERE minimum_deneyim_puani <= v_xp
                 ORDER BY minimum_deneyim_puani DESC
                 LIMIT 1
               ) s
         WHERE k.id = v_uid;
    END IF;

    RETURN v_delta;
END; $$;
REVOKE ALL ON FUNCTION public.xp_ekle(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.xp_ekle(TEXT) TO authenticated;
