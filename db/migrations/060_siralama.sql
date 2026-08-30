-- ============================================================================
-- 060 — Sıralama (Zenginlik / Cazibe / Odalar)
--
-- NEDEN BÖYLE:
-- Temel şemada `leaderboards` + `leaderboard_entries` var ama BOŞ ve içini
-- dolduracak bir zamanlayıcı yok (pg_cron kurulu değil). O tasarım "periyodik
-- iş sıralamayı hesaplar, anlık görüntüyü yazar" mantığında; bizde o iş yok.
--
-- Bu yüzden sıralama OKUMA ANINDA hesaplanıyor; kaynak `hediye_gecmisi`.
-- Veri hacmi küçükken bu hem daha basit hem her zaman güncel. Yavaşlarsa
-- anlık görüntü tabloları zaten hazır, oraya geçilir — bu fonksiyonların
-- imzası değişmediği için istemci kodu aynı kalır.
--
-- Dönem sınırları Europe/Istanbul'a göre: kullanıcı Türkiye'de, "bugün" ve
-- "bu hafta" onun takvimine göre bitmeli, UTC'ye göre değil.
--
--   Zenginlik = HARCANAN  (hediye_gecmisi.toplam_deger,   gönderen)
--   Cazibe    = KAZANILAN (hediye_gecmisi.kazanc_miktari, alıcı)
--   Odalar    = odada dönen hediye değeri
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Dönem sınırları
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._siralama_baslangic(p_periyot TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT CASE lower(COALESCE(p_periyot, 'hafta'))
        WHEN 'gun' THEN date_trunc('day',   now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'
        WHEN 'ay'  THEN date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'
        WHEN 'tum' THEN '-infinity'::TIMESTAMPTZ
        ELSE            date_trunc('week',  now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'
    END;
$$;

-- Dönemin bitişi — başlıktaki "2g 14s kaldı" sayacı buradan besleniyor.
CREATE OR REPLACE FUNCTION public.siralama_donem_bitis(p_periyot TEXT DEFAULT 'hafta')
RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT CASE lower(COALESCE(p_periyot, 'hafta'))
        WHEN 'gun' THEN public._siralama_baslangic('gun')   + INTERVAL '1 day'
        WHEN 'ay'  THEN public._siralama_baslangic('ay')    + INTERVAL '1 month'
        WHEN 'tum' THEN NULL
        ELSE            public._siralama_baslangic('hafta') + INTERVAL '1 week'
    END;
$$;
REVOKE ALL ON FUNCTION public.siralama_donem_bitis(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siralama_donem_bitis(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Zenginlik — en çok hediye GÖNDEREN
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siralama_zenginlik(p_periyot TEXT DEFAULT 'hafta', p_limit INTEGER DEFAULT 50)
RETURNS TABLE (sira INTEGER, kullanici_id BIGINT, public_id TEXT, ad TEXT,
               foto TEXT, rozet TEXT, puan BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH t AS (
        SELECT h.gonderen_id AS uid, SUM(h.toplam_deger)::BIGINT AS p
          FROM public.hediye_gecmisi h
         WHERE h.gonderen_id IS NOT NULL
           AND h.gonderilme_tarihi >= public._siralama_baslangic(p_periyot)
         GROUP BY h.gonderen_id
    )
    SELECT (ROW_NUMBER() OVER (ORDER BY t.p DESC, k.id))::INTEGER,
           k.id, k.public_id::TEXT, k.kullanici_adi::TEXT,
           k.profil_resmi, k.kusanilan_rozet, t.p
      FROM t
      JOIN public.kullanicilar k ON k.id = t.uid
     WHERE NOT k.silinmis AND NOT k.banli AND t.p > 0
     ORDER BY t.p DESC, k.id
     LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;
REVOKE ALL ON FUNCTION public.siralama_zenginlik(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siralama_zenginlik(TEXT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Cazibe — en çok hediye ALAN
--
-- Puan olarak `kazanc_miktari` (komisyon düşülmüş hâli) kullanılıyor, çünkü
-- yayıncı panelinde gösterilen kazançla aynı sayı olmalı; iki ekran farklı
-- rakam söylerse hangisinin doğru olduğu belli olmaz.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siralama_cazibe(p_periyot TEXT DEFAULT 'hafta', p_limit INTEGER DEFAULT 50)
RETURNS TABLE (sira INTEGER, kullanici_id BIGINT, public_id TEXT, ad TEXT,
               foto TEXT, rozet TEXT, puan BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH t AS (
        SELECT h.alici_id AS uid, SUM(h.kazanc_miktari)::BIGINT AS p
          FROM public.hediye_gecmisi h
         WHERE h.gonderilme_tarihi >= public._siralama_baslangic(p_periyot)
         GROUP BY h.alici_id
    )
    SELECT (ROW_NUMBER() OVER (ORDER BY t.p DESC, k.id))::INTEGER,
           k.id, k.public_id::TEXT, k.kullanici_adi::TEXT,
           k.profil_resmi, k.kusanilan_rozet, t.p
      FROM t
      JOIN public.kullanicilar k ON k.id = t.uid
     WHERE NOT k.silinmis AND NOT k.banli AND t.p > 0
     ORDER BY t.p DESC, k.id
     LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;
REVOKE ALL ON FUNCTION public.siralama_cazibe(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siralama_cazibe(TEXT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Odalar — dönem içinde en çok hediye dönen odalar
--
-- İşlem görmüş ve silinmiş odalar listede yer almaz: sıralama bir vitrindir,
-- kilitli odayı oraya koyup kullanıcıyı kapıdan çevirmek anlamsız.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siralama_odalar(p_periyot TEXT DEFAULT 'hafta', p_limit INTEGER DEFAULT 50)
RETURNS TABLE (sira INTEGER, oda_id BIGINT, public_id TEXT, ad TEXT,
               kapak TEXT, sahip TEXT, online INTEGER, puan BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH t AS (
        SELECT h.oda_id AS oid, SUM(h.toplam_deger)::BIGINT AS p
          FROM public.hediye_gecmisi h
         WHERE h.oda_id IS NOT NULL
           AND h.gonderilme_tarihi >= public._siralama_baslangic(p_periyot)
         GROUP BY h.oda_id
    )
    SELECT (ROW_NUMBER() OVER (ORDER BY t.p DESC, o.id))::INTEGER,
           o.id, o.public_id::TEXT, o.ad::TEXT, o.kapak_url,
           COALESCE(k.kullanici_adi, '')::TEXT, o.aktif_katilimci_sayisi, t.p
      FROM t
      JOIN public.odalar o ON o.id = t.oid
      LEFT JOIN public.kullanicilar k ON k.id = o.olusturan_id
     WHERE NOT o.silinmis AND NOT o.islem_gordu AND t.p > 0
     ORDER BY t.p DESC, o.id
     LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;
REVOKE ALL ON FUNCTION public.siralama_odalar(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siralama_odalar(TEXT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Hız — dönem sorguları hep tarihe göre süzüyor
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_hediye_gecmisi_tarih
    ON public.hediye_gecmisi (gonderilme_tarihi DESC);
CREATE INDEX IF NOT EXISTS idx_hediye_gecmisi_gonderen_tarih
    ON public.hediye_gecmisi (gonderen_id, gonderilme_tarihi DESC);
CREATE INDEX IF NOT EXISTS idx_hediye_gecmisi_alici_tarih
    ON public.hediye_gecmisi (alici_id, gonderilme_tarihi DESC);
