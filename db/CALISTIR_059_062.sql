-- ============================================================================
-- ARON CHAT — BIRLESIK MIGRATION  (059 + 060 + 061 + 062)
--
-- Bu dosya dort ayri migration'in SIRAYLA birlestirilmis halidir. Supabase SQL
-- editorune tek seferde yapistirilip calistirilir; sira onemli, cunku 061 ile
-- 062, 059'daki enum yardimcilarini (_enum_etiket) ve 060'taki donem
-- fonksiyonunu (_siralama_baslangic) kullaniyor.
--
-- Hepsi TEKRAR CALISTIRILABILIR: CREATE OR REPLACE / IF NOT EXISTS /
-- ON CONFLICT kullaniliyor, mevcut veri bozulmuyor.
--
-- Ne getiriyor:
--   059  hediye gonderimi temel semanin defterine baglanir, komisyon %30,
--        29 hediye katalogu, kazanc RPC'leri (yayinci paneli bunlari okuyor)
--   060  zenginlik / cazibe / oda siralamasi + donem sayaci
--   061  5 gunluk gorev + 7 gunluk giris serisi; ilerleme sunucuda TURETILIR
--   062  magaza ve cuzdan da ayni altini kullanir (iki ayri bakiye kalmaz)
--
-- Calistirdiktan sonra ayrica:
--   DROP FUNCTION IF EXISTS public.fn_kaynak();
--
-- NOT: hata alirsan buyuk ihtimalle su satirdir ->
--   "islem_tipi icinde uygun etiket yok. Mevcut: ..."
-- O satiri oldugu gibi bana at; enum etiketlerini bilmedigimiz icin dogru
-- olani secen bir arama var, aday listesi tutmazsa gercek listeyi yaziyor.
-- ============================================================================



-- ############################################################################
-- ##  059_hediye_temel_semaya_gecis.sql
-- ##  Hediye ekonomisi — temel semaya gecis (komisyon %30)
-- ############################################################################

-- ============================================================================
-- 059_hediye_temel_semaya_gecis.sql — Hediye akışını TEMEL şemaya taşı
-- ----------------------------------------------------------------------------
-- Neden: temel şemada zaten eksiksiz bir hediye ekonomisi varmış —
--   hediyeler, hediye_gecmisi + iki trigger:
--     BEFORE INSERT  hediye_gonder_fn : fiyatı katalogdan okur, komisyonu
--       ayarlar'dan alır, idempotency + yaptırım + günlük limit kontrolü
--       yapar, lot_harca ile ALTIN düşer, gönderene XP verir.
--     AFTER INSERT   hediye_after_fn  : kazanc_hareket ile alıcıya kazanç
--       yazar, platform payını sistem havuzuna işler, oda XP'sini ve
--       room_stat_deltalari'nı günceller, outbox_events'e olay basar.
--
-- Eksik olan tek şey İSTEMCİ ERİŞİMİYDİ: bu tabloların RLS'i açık ama hiç
-- politikası yok ve INSERT'i saran SECURITY DEFINER fonksiyon yazılmamış.
-- Bu dosya o kapıyı açar. 058'de kurduğumuz paralel yapı (hediye_katalogu,
-- hediye_gonderimleri, hediye_gonder) artık kullanılmayacak — veri taşımıyoruz,
-- ikisi de test verisiydi; eskisini silmiyoruz, sadece istemci ondan kopuyor.
--
-- ÖNEMLİ FARK: temel şemada hediye ALTIN ile gönderilir (lot_harca 'altin'),
-- elmas ise satın alınan/dönüştürülen varlıktır. Kazanç `kullanicilar.
-- kazanc_puani` üzerinde birikir ve çekim oradan yapılır.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Enum yardımcıları
--
-- `bakiye_kaynagi` ve `islem_tipi` temel şemanın enum'ları; repoda tanımları
-- yok, dökümde yalnızca "USER-DEFINED" yazıyor. Etiketi tahmin edip yanlış
-- yazarsak hata ancak kullanıcı işlemi denerken çıkar. Bu yüzden etiket
-- çalışma anında aranıyor; hiçbir aday tutmazsa fonksiyon veritabanındaki
-- GERÇEK etiket listesini yazan bir hata veriyor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._enum_etiket(p_tip TEXT, p_adaylar TEXT[])
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $ee$
    SELECT e.enumlabel::TEXT
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = p_tip
       AND e.enumlabel::TEXT = ANY (p_adaylar)
     ORDER BY array_position(p_adaylar, e.enumlabel::TEXT)
     LIMIT 1;
$ee$;

CREATE OR REPLACE FUNCTION public._enum_liste(p_tip TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $el$
    SELECT string_agg(e.enumlabel::TEXT, ', ' ORDER BY e.enumsortorder)
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = p_tip;
$el$;

-- ---------------------------------------------------------------------------
-- 1) Ayarlar — komisyon %30 (trigger varsayılanı 0.40'tı) ve hediye açık
-- ---------------------------------------------------------------------------
INSERT INTO public.ayarlar (anahtar, deger)
VALUES ('hediye_komisyon_orani', '0.30')
ON CONFLICT (anahtar) DO UPDATE SET deger = EXCLUDED.deger;

INSERT INTO public.feature_flags (anahtar, aktif, aciklama)
VALUES ('gifts_enabled', TRUE, 'Hediye gönderimi açık')
ON CONFLICT (anahtar) DO UPDATE SET aktif = TRUE;

-- ---------------------------------------------------------------------------
-- 2) Katalog — istemcinin ihtiyaç duyduğu görsel alanlar + tohumlama
--
-- Temel `hediyeler` tablosunda emoji/renk/kademe yok (ikon_url ve
-- animasyon_url var, asset gerektiriyor). İstemci hediyeleri kodla çiziyor;
-- bu yüzden ek alanlar ekliyoruz. Hepsi NULL kabul eder, mevcut satırları
-- bozmaz. `kod` istemcideki sabit kimlik ("rose", "throne"...).
-- ---------------------------------------------------------------------------
ALTER TABLE public.hediyeler ADD COLUMN IF NOT EXISTS kod    VARCHAR(40);
ALTER TABLE public.hediyeler ADD COLUMN IF NOT EXISTS emoji  TEXT;
ALTER TABLE public.hediyeler ADD COLUMN IF NOT EXISTS renk1  TEXT;
ALTER TABLE public.hediyeler ADD COLUMN IF NOT EXISTS renk2  TEXT;
ALTER TABLE public.hediyeler ADD COLUMN IF NOT EXISTS kademe TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hediye_kod ON public.hediyeler (kod) WHERE kod IS NOT NULL;

-- Yalnızca eksik kodları ekler; tabloda zaten hediye varsa onlara dokunmaz.
INSERT INTO public.hediyeler (kod, ad, kategori, birim_fiyat, sira, aktif, emoji, renk1, renk2, kademe)
SELECT v.kod, v.ad, v.kategori, v.fiyat, v.sira, TRUE, v.emoji, v.renk1, v.renk2, v.kademe
  FROM (VALUES
    ('ring',    'CP Yüzüğü',      'Hediye',          50000,  1, '💍', '#FBCFE8', '#BE185D', 'epic'),
    ('pistol',  'Altın Tabanca',  'Hediye',          10000,  2, '🔫', '#FDE68A', '#B45309', 'rare'),
    ('watch',   'Altın Saat',     'Hediye',          10000,  3, '⌚', '#FDE68A', '#92400E', 'rare'),
    ('em',      'Zümrüt Yüzük',   'Hediye',          30000,  4, '💎', '#A7F3D0', '#047857', 'epic'),
    ('bag',     'Şanslı Paket',   'Hediye',          50000,  5, '🎁', '#FDE68A', '#B45309', 'epic'),
    ('throne',  'Aslan Tahtı',    'Hediye',         100000,  6, '🦁', '#FDE68A', '#92400E', 'legendary'),
    ('space',   'Yıldızlararası', 'Hediye',         100000,  7, '🚀', '#C4B5FD', '#4C1D95', 'legendary'),
    ('eiffel',  'Romantik Eyfel', 'Hediye',         300000,  8, '🗼', '#FBCFE8', '#9D174D', 'legendary'),
    ('rose',    'Tek Gül',        'Love',              520,  9, '🌹', '#FBCFE8', '#BE185D', 'normal'),
    ('heart',   'Kalp',           'Love',             1314, 10, '❤️', '#FCA5A5', '#B91C1C', 'normal'),
    ('kiss',    'Öpücük',         'Love',             1990, 11, '💋', '#FBCFE8', '#BE185D', 'rare'),
    ('bouquet', 'Gül Buketi',     'Love',             9999, 12, '💐', '#FBCFE8', '#9D174D', 'rare'),
    ('cprings', 'Çift Yüzük',     'Love',            13140, 13, '💞', '#FBCFE8', '#BE185D', 'epic'),
    ('teddy',   'Aşk Ayıcığı',    'Love',            20000, 14, '🧸', '#FDE68A', '#B45309', 'epic'),
    ('cupid',   'Aşk Oku',        'Love',            52000, 15, '💘', '#FBCFE8', '#BE185D', 'epic'),
    ('wedding', 'Düğün Sarayı',   'Love',           520000, 16, '💒', '#FBCFE8', '#9D174D', 'legendary'),
    ('clover',  'Şanslı Yonca',   'Lucky',            1000, 17, '🍀', '#A7F3D0', '#047857', 'normal'),
    ('dice',    'Zar',            'Lucky',            5000, 18, '🎲', '#E5E7EB', '#4B5563', 'normal'),
    ('slot',    'Slot',           'Lucky',           20000, 19, '🎰', '#FDE68A', '#B45309', 'rare'),
    ('gembox',  'Sürpriz Kutu',   'Lucky',           30000, 20, '💝', '#FBCFE8', '#BE185D', 'epic'),
    ('wheel',   'Çark',           'Şanslı Çekiliş',   8000, 21, '🎡', '#C4B5FD', '#5B21B6', 'rare'),
    ('star',    'Yıldız Yağmuru', 'Şanslı Çekiliş',  60000, 22, '🌟', '#FDE68A', '#B45309', 'epic'),
    ('crown',   'Kral Tacı',      'Aristokrat',     200000, 23, '👑', '#FDE68A', '#92400E', 'legendary'),
    ('castle',  'Altın Kale',     'Aristokrat',     500000, 24, '🏰', '#FDE68A', '#92400E', 'legendary'),
    ('car',     'Spor Araba',     'Aristokrat',     888000, 25, '🏎️', '#FCA5A5', '#B91C1C', 'legendary'),
    ('cpheart', 'CP Bağ',         'CP',              33000, 26, '💑', '#FBCFE8', '#BE185D', 'epic'),
    ('forever', 'Sonsuz Aşk',     'CP',             131400, 27, '♾️', '#C4B5FD', '#5B21B6', 'legendary'),
    ('galaxy',  'Galaksi',        'Özel',           999000, 28, '🌌', '#C4B5FD', '#312E81', 'legendary'),
    ('phoenix', 'Anka Kuşu',      'Özel',           666000, 29, '🔥', '#FDBA74', '#9A3412', 'legendary')
  ) AS v(kod, ad, kategori, fiyat, sira, emoji, renk1, renk2, kademe)
 WHERE NOT EXISTS (SELECT 1 FROM public.hediyeler h WHERE h.kod = v.kod);

-- ---------------------------------------------------------------------------
-- 3) İstemci erişimi — RLS politikaları
--
-- Bu tablolarda RLS açıktı ama HİÇ politika yoktu: yani herkese kapalıydı.
-- anon'a verilmiş yazma yetkilerini de geri alıyoruz (politika olmadığı için
-- zaten işlemiyordu, ama yetkiyi durduk yere bırakmayalım).
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hediyeler      FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.hediye_gecmisi FROM anon;

DROP POLICY IF EXISTS hediye_katalog_oku ON public.hediyeler;
CREATE POLICY hediye_katalog_oku ON public.hediyeler
    FOR SELECT TO authenticated
    USING (aktif OR public.ben_platform_yoneticisi());

DROP POLICY IF EXISTS hediye_gecmis_oku ON public.hediye_gecmisi;
CREATE POLICY hediye_gecmis_oku ON public.hediye_gecmisi
    FOR SELECT TO authenticated
    USING (gonderen_id = public.benim_kullanici_id()
        OR alici_id   = public.benim_kullanici_id()
        OR public.ben_platform_yoneticisi());

-- ---------------------------------------------------------------------------
-- 4) Gönderim sarmalayıcısı
--
-- Tüm iş trigger'da; buranın işi kimliği güvenceye almak (gonderen_id daima
-- oturum sahibi) ve idempotency anahtarını garantilemek. NOT NULL kolonlara
-- 0 yazıyoruz — BEFORE trigger gerçek değerleri doldurup üstüne yazıyor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hediye_gonder_v2(
    p_hediye_id INTEGER,
    p_miktar    INTEGER,
    p_alici_id  BIGINT,
    p_oda_id    BIGINT  DEFAULT NULL,
    p_idem      VARCHAR DEFAULT NULL,
    p_mesaj     TEXT    DEFAULT NULL
)
RETURNS TABLE (kayit_id BIGINT, toplam BIGINT, kazanc BIGINT, komisyon BIGINT, altin BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben  BIGINT := public.benim_kullanici_id();
    v_id   BIGINT;
    v_top  BIGINT;
    v_kaz  BIGINT;
    v_kom  BIGINT;
    v_alt  BIGINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_miktar IS NULL OR p_miktar <= 0 OR p_miktar > 10000 THEN
        RAISE EXCEPTION 'Geçersiz adet.';
    END IF;
    IF p_alici_id = v_ben THEN
        RAISE EXCEPTION 'Kendine hediye gönderemezsin.';
    END IF;

    INSERT INTO public.hediye_gecmisi (
        gonderen_id, alici_id, hediye_id, miktar,
        birim_fiyat, toplam_deger, komisyon_orani, kazanc_miktari, platform_geliri,
        oda_id, mesaj, idempotency_key)
    VALUES (
        v_ben, p_alici_id, p_hediye_id, p_miktar,
        0, 0, 0, 0, 0,
        p_oda_id, p_mesaj,
        COALESCE(p_idem, md5(random()::TEXT || clock_timestamp()::TEXT)))
    RETURNING id, toplam_deger, kazanc_miktari, platform_geliri
         INTO v_id, v_top, v_kaz, v_kom;

    SELECT cached_altin_balance INTO v_alt FROM public.kullanicilar WHERE id = v_ben;

    RETURN QUERY SELECT v_id, v_top, v_kaz, v_kom, COALESCE(v_alt, 0);
END; $$;

REVOKE ALL ON FUNCTION public.hediye_gonder_v2(INTEGER, INTEGER, BIGINT, BIGINT, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hediye_gonder_v2(INTEGER, INTEGER, BIGINT, BIGINT, VARCHAR, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Bakiyem — temel şemadaki gerçek bakiyeler
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.benim_bakiyem_v2()
RETURNS TABLE (altin BIGINT, toplam BIGINT, promo BIGINT, cekilebilir BIGINT, kazanc BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE(cached_altin_balance, 0),
           COALESCE(cached_total_balance, 0),
           COALESCE(cached_promo_balance, 0),
           COALESCE(cached_withdrawable_balance, 0),
           COALESCE(kazanc_puani, 0)
      FROM public.kullanicilar
     WHERE id = public.benim_kullanici_id();
$$;
REVOKE ALL ON FUNCTION public.benim_bakiyem_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.benim_bakiyem_v2() TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Yayıncı paneli okumaları — artık hediye_gecmisi üzerinden
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kazanc_ozeti_v2()
RETURNS TABLE (bugun BIGINT, bu_ay BIGINT, toplam BIGINT, komisyon BIGINT, hediye_ay BIGINT, kisi_ay BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT
        COALESCE(SUM(kazanc_miktari) FILTER (WHERE gonderilme_tarihi >= date_trunc('day', now())), 0),
        COALESCE(SUM(kazanc_miktari) FILTER (WHERE gonderilme_tarihi >= date_trunc('month', now())), 0),
        COALESCE(SUM(kazanc_miktari), 0),
        COALESCE(SUM(platform_geliri) FILTER (WHERE gonderilme_tarihi >= date_trunc('month', now())), 0),
        COALESCE(COUNT(*) FILTER (WHERE gonderilme_tarihi >= date_trunc('month', now())), 0),
        COALESCE(COUNT(DISTINCT gonderen_id) FILTER (WHERE gonderilme_tarihi >= date_trunc('month', now())), 0)
      FROM public.hediye_gecmisi
     WHERE alici_id = public.benim_kullanici_id();
$$;
REVOKE ALL ON FUNCTION public.kazanc_ozeti_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kazanc_ozeti_v2() TO authenticated;

CREATE OR REPLACE FUNCTION public.kazanc_saatlik_v2(p_gun_once INTEGER DEFAULT 0)
RETURNS TABLE (saat INTEGER, altin BIGINT, hediye BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH gun AS (SELECT date_trunc('day', now()) - (p_gun_once || ' days')::INTERVAL AS bas)
    SELECT s.saat::INTEGER,
           COALESCE(SUM(h.kazanc_miktari), 0)::BIGINT,
           COALESCE(COUNT(h.id), 0)::BIGINT
      FROM generate_series(0, 23) AS s(saat)
      CROSS JOIN gun
      LEFT JOIN public.hediye_gecmisi h
             ON h.alici_id = public.benim_kullanici_id()
            AND h.gonderilme_tarihi >= gun.bas
            AND h.gonderilme_tarihi <  gun.bas + INTERVAL '1 day'
            AND EXTRACT(HOUR FROM h.gonderilme_tarihi)::INTEGER = s.saat
     GROUP BY s.saat
     ORDER BY s.saat;
$$;
REVOKE ALL ON FUNCTION public.kazanc_saatlik_v2(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kazanc_saatlik_v2(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.kazanc_gunluk_v2(p_gun INTEGER DEFAULT 7)
RETURNS TABLE (gun DATE, altin BIGINT, hediye BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT d::DATE,
           COALESCE(SUM(h.kazanc_miktari), 0)::BIGINT,
           COALESCE(COUNT(h.id), 0)::BIGINT
      FROM generate_series(
               date_trunc('day', now()) - ((GREATEST(p_gun, 1) - 1) || ' days')::INTERVAL,
               date_trunc('day', now()),
               INTERVAL '1 day') AS d
      LEFT JOIN public.hediye_gecmisi h
             ON h.alici_id = public.benim_kullanici_id()
            AND h.gonderilme_tarihi >= d
            AND h.gonderilme_tarihi <  d + INTERVAL '1 day'
     GROUP BY d
     ORDER BY d;
$$;
REVOKE ALL ON FUNCTION public.kazanc_gunluk_v2(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kazanc_gunluk_v2(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.son_hediyelerim_v2(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (id BIGINT, gonderen TEXT, gonderen_pid TEXT, hediye_ad TEXT, emoji TEXT,
               adet INTEGER, kazanc BIGINT, tarih TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT h.id, k.kullanici_adi::TEXT, k.public_id::TEXT, g.ad::TEXT,
           COALESCE(g.emoji, '🎁')::TEXT, h.miktar, h.kazanc_miktari, h.gonderilme_tarihi
      FROM public.hediye_gecmisi h
      JOIN public.hediyeler g    ON g.id = h.hediye_id
      LEFT JOIN public.kullanicilar k ON k.id = h.gonderen_id
     WHERE h.alici_id = public.benim_kullanici_id()
     ORDER BY h.gonderilme_tarihi DESC
     LIMIT GREATEST(p_limit, 1);
$$;
REVOKE ALL ON FUNCTION public.son_hediyelerim_v2(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.son_hediyelerim_v2(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Test için altın yükleme — gerçek defter üzerinden (yönetici)
--
-- Artık bakiye elle UPDATE edilmiyor: lot_yatir bir "lot" açar, cache'i
-- günceller ve wallet_ledger'a satır yazar. Yani test parası da gerçek
-- muhasebeden geçer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_altin_yukle(p_kullanici BIGINT, p_miktar BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_bakiye BIGINT;
    v_kaynak TEXT;
    v_islem  TEXT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bu işlem için yönetici olmalısın.';
    END IF;
    IF p_miktar <= 0 THEN RAISE EXCEPTION 'Miktar pozitif olmalı.'; END IF;

    v_kaynak := public._enum_etiket('bakiye_kaynagi',
        ARRAY['admin_grant', 'admin', 'sistem', 'promo', 'promosyon', 'bonus', 'odul']);
    v_islem := public._enum_etiket('islem_tipi',
        ARRAY['admin_ekleme', 'admin', 'sistem_ekleme', 'promosyon', 'promo', 'bonus', 'odul']);
    IF v_kaynak IS NULL THEN
        RAISE EXCEPTION 'bakiye_kaynagi icinde uygun etiket yok. Mevcut: %',
            public._enum_liste('bakiye_kaynagi');
    END IF;
    IF v_islem IS NULL THEN
        RAISE EXCEPTION 'islem_tipi icinde uygun etiket yok. Mevcut: %',
            public._enum_liste('islem_tipi');
    END IF;

    EXECUTE format(
        'SELECT public.lot_yatir($1, %L::varlik_tipi, %L::bakiye_kaynagi, $2, %L::islem_tipi)',
        'altin', v_kaynak, v_islem)
    USING p_kullanici, p_miktar;

    SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
    RETURN COALESCE(v_bakiye, 0);
END; $$;

REVOKE ALL ON FUNCTION public.admin_altin_yukle(BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_altin_yukle(BIGINT, BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Komisyon oranını istemciye aç
--
-- `ayarlar` tablosunun politikası yok (kapalı); yüzdeyi ekranda yazabilmek
-- için tek değeri okutan minik bir fonksiyon.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hediye_komisyon()
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT public.ayar_numeric('hediye_komisyon_orani', 0.30);
$$;
REVOKE ALL ON FUNCTION public.hediye_komisyon() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hediye_komisyon() TO authenticated;


-- ############################################################################
-- ##  060_siralama.sql
-- ##  Siralama — zenginlik / cazibe / odalar
-- ############################################################################

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


-- ############################################################################
-- ##  061_gorevler.sql
-- ##  Gorevler + gunluk giris serisi
-- ############################################################################

-- ============================================================================
-- 061 — Görevler ve günlük giriş ödülü
--
-- Önce 060 çalıştırılmalı (dönem başlangıcı için `_siralama_baslangic`).
--
-- NEDEN TÜRETME:
-- `kullanici_gorev_ilerlemesi.ilerleme` sütununu istemci "görevi ilerlet"
-- diyerek doldursaydı, herkes kendi ilerlemesini yazabilirdi — ödül bedava
-- olurdu. Bu yüzden ilerleme HİÇ YAZILMIYOR: her okumada kaynak tablolardan
-- (oda_ziyaretleri, hediye_gecmisi, oda_mesajlari, kullanicilar_takip)
-- sayılıyor. O tabloya yalnızca "ödül alındı" işareti düşüyor.
-- Yan fayda: görev olayları için ayrı bir tetikleyici ağı kurmaya gerek yok.
--
-- ENUM ETİKETLERİ:
-- `bakiye_kaynagi` ve `islem_tipi` etiketleri çalışma anında aranıyor
-- (_enum_etiket / _enum_liste — 059'da tanımlanıyor, burada güvenlik için
-- tekrar yazılıyor ki 061 tek başına da çalışsın).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Enum yardımcıları (059 ile aynı tanım)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._enum_etiket(p_tip TEXT, p_adaylar TEXT[])
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT e.enumlabel::TEXT
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = p_tip
       AND e.enumlabel::TEXT = ANY (p_adaylar)
     ORDER BY array_position(p_adaylar, e.enumlabel::TEXT)
     LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._enum_liste(p_tip TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT string_agg(e.enumlabel::TEXT, ', ' ORDER BY e.enumsortorder)
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = p_tip;
$$;

-- ---------------------------------------------------------------------------
-- 1) Ödül ödemesi — gerçek defter üzerinden
--
-- Görev/giriş ödülü PROMO paradır: satın alınmış değil, hediyeye harcanabilir
-- ama çekilememeli. Bu yüzden lot kaynağı olarak promo benzeri bir etiket
-- aranıyor; `balance_lots.kaynak` zaten bu ayrımı taşıyor
-- (kullanicilar.cached_promo_balance oradan besleniyor).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._odul_ver(p_kullanici BIGINT, p_miktar BIGINT, p_ref TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_kaynak TEXT;
    v_islem  TEXT;
    v_bakiye BIGINT;
BEGIN
    IF p_miktar <= 0 THEN RETURN NULL; END IF;

    v_kaynak := public._enum_etiket('bakiye_kaynagi',
        ARRAY['promo', 'promosyon', 'bonus', 'odul', 'gorev', 'sistem', 'admin_grant']);
    v_islem := public._enum_etiket('islem_tipi',
        ARRAY['gorev_odulu', 'gorev', 'promosyon', 'promo', 'bonus', 'odul',
              'sistem_ekleme', 'admin_ekleme']);

    IF v_kaynak IS NULL THEN
        RAISE EXCEPTION 'bakiye_kaynagi icinde uygun etiket yok. Mevcut: %',
            public._enum_liste('bakiye_kaynagi');
    END IF;
    IF v_islem IS NULL THEN
        RAISE EXCEPTION 'islem_tipi icinde uygun etiket yok. Mevcut: %',
            public._enum_liste('islem_tipi');
    END IF;

    EXECUTE format(
        'SELECT public.lot_yatir($1, %L::varlik_tipi, %L::bakiye_kaynagi, $2, %L::islem_tipi, %L)',
        'altin', v_kaynak, v_islem, p_ref)
    USING p_kullanici, p_miktar;

    SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
    RETURN COALESCE(v_bakiye, 0);
END; $$;
REVOKE ALL ON FUNCTION public._odul_ver(BIGINT, BIGINT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2) Görev katalogu
--
-- `tip` sütununa dokunulmuyor: varsayılanı zaten 'gunluk' ve `gorev_tipi`
-- enum'unun diğer etiketlerini bilmiyoruz. Haftalık görev eklenecekse önce
-- etiket öğrenilecek.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_gorevler_kod ON public.gorevler (kod);

INSERT INTO public.gorevler (kod, ad, aciklama, hedef_sayi, odul_varlik, odul_miktar, sira, aktif) VALUES
    ('oda_katil',     'Bir odaya katıl',   'Herhangi bir sesli odaya gir',        1, 'altin', 100, 1, TRUE),
    ('mesaj_yaz',     '10 mesaj yaz',      'Odalarda sohbet et',                 10, 'altin', 150, 2, TRUE),
    ('hediye_gonder', 'Hediye gönder',     'Bir kullanıcıya hediye gönder',       1, 'altin', 300, 3, TRUE),
    ('hediye_al',     'Hediye al',         'Sana hediye gönderilsin',             1, 'altin', 200, 4, TRUE),
    ('takip_et',      'Birini takip et',   'Yeni bir kullanıcı takip et',         1, 'altin', 100, 5, TRUE)
ON CONFLICT (kod) DO UPDATE SET
    ad          = EXCLUDED.ad,
    aciklama    = EXCLUDED.aciklama,
    hedef_sayi  = EXCLUDED.hedef_sayi,
    odul_varlik = EXCLUDED.odul_varlik,
    odul_miktar = EXCLUDED.odul_miktar,
    sira        = EXCLUDED.sira,
    aktif       = TRUE;

-- Aynı görevin aynı gün ödülü iki kez alınamasın (yarış koşulu dahil).
CREATE UNIQUE INDEX IF NOT EXISTS idx_gorev_ilerleme_tekil
    ON public.kullanici_gorev_ilerlemesi (kullanici_id, gorev_id, donem_anahtari);

-- ---------------------------------------------------------------------------
-- 3) Günlük giriş ödülleri — 7 günlük seri
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_gunluk_odul_gun ON public.gunluk_giris_odulleri (gun_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gunluk_giris_kullanici ON public.kullanici_gunluk_giris (kullanici_id);

INSERT INTO public.gunluk_giris_odulleri (gun_no, varlik, miktar) VALUES
    (1, 'altin',  100),
    (2, 'altin',  150),
    (3, 'altin',  200),
    (4, 'altin',  300),
    (5, 'altin',  450),
    (6, 'altin',  650),
    (7, 'altin', 1500)
ON CONFLICT (gun_no) DO UPDATE SET varlik = EXCLUDED.varlik, miktar = EXCLUDED.miktar;

-- ---------------------------------------------------------------------------
-- 4) Bugünün anahtarı (Europe/Istanbul)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._bugun_tr()
RETURNS DATE
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT (now() AT TIME ZONE 'Europe/Istanbul')::DATE;
$$;

-- ---------------------------------------------------------------------------
-- 5) Görevlerim — ilerleme kaynak tablolardan türetiliyor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gorevlerim()
RETURNS TABLE (kod TEXT, ad TEXT, aciklama TEXT, hedef INTEGER, ilerleme INTEGER,
               odul BIGINT, alindi BOOLEAN, sira INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH ben AS (SELECT public.benim_kullanici_id() AS id),
         t0 AS (SELECT public._siralama_baslangic('gun') AS an),
         sayac AS (
             SELECT
                 (SELECT COUNT(*) FROM public.oda_ziyaretleri z
                   WHERE z.kullanici_id = b.id AND z.son_giris >= t.an)          AS oda_katil,
                 (SELECT COUNT(*) FROM public.oda_mesajlari m
                   WHERE m.kullanici_id = b.id AND m.gonderilme_tarihi >= t.an)  AS mesaj_yaz,
                 (SELECT COUNT(*) FROM public.hediye_gecmisi h
                   WHERE h.gonderen_id = b.id AND h.gonderilme_tarihi >= t.an)   AS hediye_gonder,
                 (SELECT COUNT(*) FROM public.hediye_gecmisi h
                   WHERE h.alici_id = b.id AND h.gonderilme_tarihi >= t.an)      AS hediye_al,
                 (SELECT COUNT(*) FROM public.kullanicilar_takip k
                   WHERE k.takip_eden_id = b.id AND k.takip_tarihi >= t.an)      AS takip_et
               FROM ben b, t0 t
         )
    SELECT g.kod::TEXT, g.ad::TEXT, COALESCE(g.aciklama, '')::TEXT, g.hedef_sayi,
           LEAST(
               CASE g.kod
                   WHEN 'oda_katil'     THEN s.oda_katil
                   WHEN 'mesaj_yaz'     THEN s.mesaj_yaz
                   WHEN 'hediye_gonder' THEN s.hediye_gonder
                   WHEN 'hediye_al'     THEN s.hediye_al
                   WHEN 'takip_et'      THEN s.takip_et
                   ELSE 0
               END, g.hedef_sayi)::INTEGER,
           g.odul_miktar,
           COALESCE(i.odul_alindi, FALSE),
           g.sira
      FROM public.gorevler g
      CROSS JOIN sayac s
      CROSS JOIN ben b
      LEFT JOIN public.kullanici_gorev_ilerlemesi i
             ON i.kullanici_id = b.id
            AND i.gorev_id = g.id
            AND i.donem_anahtari = to_char(public._bugun_tr(), 'YYYY-MM-DD')
     WHERE g.aktif AND b.id IS NOT NULL
     ORDER BY g.sira, g.id;
$$;
REVOKE ALL ON FUNCTION public.gorevlerim() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gorevlerim() TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Görev ödülünü al
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gorev_odul_al(p_kod TEXT)
RETURNS TABLE (odul BIGINT, altin BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben     BIGINT := public.benim_kullanici_id();
    v_gorev   public.gorevler%ROWTYPE;
    v_ilerle  INTEGER;
    v_anahtar TEXT := to_char(public._bugun_tr(), 'YYYY-MM-DD');
    v_yazildi INTEGER;
    v_bakiye  BIGINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    SELECT * INTO v_gorev FROM public.gorevler WHERE kod = p_kod AND aktif;
    IF NOT FOUND THEN RAISE EXCEPTION 'Görev bulunamadı.'; END IF;

    -- İlerleme yine TÜRETİLİYOR: istemcinin gönderdiği sayıya güvenilmiyor.
    SELECT g.ilerleme INTO v_ilerle FROM public.gorevlerim() g WHERE g.kod = p_kod;
    IF COALESCE(v_ilerle, 0) < v_gorev.hedef_sayi THEN
        RAISE EXCEPTION 'Görev henüz tamamlanmadı.';
    END IF;

    -- Tek satır, tek gün: ikinci deneme 0 satır günceller.
    INSERT INTO public.kullanici_gorev_ilerlemesi
        (kullanici_id, gorev_id, donem_anahtari, ilerleme, tamamlandi, odul_alindi)
    VALUES (v_ben, v_gorev.id, v_anahtar, v_ilerle, TRUE, TRUE)
    ON CONFLICT (kullanici_id, gorev_id, donem_anahtari) DO UPDATE
        SET ilerleme = EXCLUDED.ilerleme, tamamlandi = TRUE, odul_alindi = TRUE
      WHERE NOT kullanici_gorev_ilerlemesi.odul_alindi;
    GET DIAGNOSTICS v_yazildi = ROW_COUNT;

    IF v_yazildi = 0 THEN RAISE EXCEPTION 'Bu görevin ödülü bugün zaten alındı.'; END IF;

    v_bakiye := public._odul_ver(v_ben, v_gorev.odul_miktar, 'gorev');
    RETURN QUERY SELECT v_gorev.odul_miktar, COALESCE(v_bakiye, 0);
END; $$;
REVOKE ALL ON FUNCTION public.gorev_odul_al(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gorev_odul_al(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Günlük giriş — durum
--
-- Seri kuralı: dün alındıysa gün +1 (7'den sonra başa döner), daha eskiyse
-- seri kırılır ve 1. günden başlar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gunluk_giris_durum()
RETURNS TABLE (gun_no SMALLINT, miktar BIGINT, alindi BOOLEAN, bugun BOOLEAN, seri INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben     BIGINT := public.benim_kullanici_id();
    v_kayit   public.kullanici_gunluk_giris%ROWTYPE;
    v_bugun   DATE := public._bugun_tr();
    v_hedef   SMALLINT;
    v_alindi  BOOLEAN;
    v_seri    INTEGER;
BEGIN
    IF v_ben IS NULL THEN RETURN; END IF;

    SELECT * INTO v_kayit FROM public.kullanici_gunluk_giris WHERE kullanici_id = v_ben;

    IF NOT FOUND OR v_kayit.son_giris_tarihi IS NULL THEN
        v_hedef := 1; v_alindi := FALSE; v_seri := 0;
    ELSIF v_kayit.son_giris_tarihi = v_bugun THEN
        v_hedef := v_kayit.son_alinan_gun; v_alindi := TRUE; v_seri := v_kayit.mevcut_seri;
    ELSIF v_kayit.son_giris_tarihi = v_bugun - 1 THEN
        v_hedef := (v_kayit.son_alinan_gun % 7) + 1; v_alindi := FALSE; v_seri := v_kayit.mevcut_seri;
    ELSE
        v_hedef := 1; v_alindi := FALSE; v_seri := 0;   -- seri kırıldı
    END IF;

    RETURN QUERY
        SELECT o.gun_no, o.miktar,
               (o.gun_no < v_hedef) OR (o.gun_no = v_hedef AND v_alindi),
               o.gun_no = v_hedef,
               v_seri
          FROM public.gunluk_giris_odulleri o
         ORDER BY o.gun_no;
END; $$;
REVOKE ALL ON FUNCTION public.gunluk_giris_durum() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gunluk_giris_durum() TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Günlük giriş — ödülü al
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gunluk_giris_al()
RETURNS TABLE (gun_no SMALLINT, odul BIGINT, altin BIGINT, seri INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben    BIGINT := public.benim_kullanici_id();
    v_kayit  public.kullanici_gunluk_giris%ROWTYPE;
    v_bugun  DATE := public._bugun_tr();
    v_gun    SMALLINT;
    v_seri   INTEGER;
    v_odul   BIGINT;
    v_bakiye BIGINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    SELECT * INTO v_kayit FROM public.kullanici_gunluk_giris
     WHERE kullanici_id = v_ben FOR UPDATE;

    IF FOUND AND v_kayit.son_giris_tarihi = v_bugun THEN
        RAISE EXCEPTION 'Bugünün ödülü zaten alındı.';
    END IF;

    IF FOUND AND v_kayit.son_giris_tarihi = v_bugun - 1 THEN
        v_gun  := (v_kayit.son_alinan_gun % 7) + 1;
        v_seri := v_kayit.mevcut_seri + 1;
    ELSE
        v_gun  := 1;
        v_seri := 1;
    END IF;

    SELECT o.miktar INTO v_odul FROM public.gunluk_giris_odulleri o WHERE o.gun_no = v_gun;
    IF v_odul IS NULL THEN RAISE EXCEPTION 'Gün ödülü tanımlı değil.'; END IF;

    INSERT INTO public.kullanici_gunluk_giris
        (kullanici_id, mevcut_seri, son_alinan_gun, son_giris_tarihi)
    VALUES (v_ben, v_seri, v_gun, v_bugun)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET mevcut_seri = EXCLUDED.mevcut_seri,
            son_alinan_gun = EXCLUDED.son_alinan_gun,
            son_giris_tarihi = EXCLUDED.son_giris_tarihi;

    v_bakiye := public._odul_ver(v_ben, v_odul, 'gunluk_giris');
    RETURN QUERY SELECT v_gun, v_odul, COALESCE(v_bakiye, 0), v_seri;
END; $$;
REVOKE ALL ON FUNCTION public.gunluk_giris_al() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gunluk_giris_al() TO authenticated;

-- ---------------------------------------------------------------------------
-- 9) Okuma politikaları
--
-- Katalog herkese açık; ilerleme yalnızca kendi satırın. Yazma yok — ödül
-- fonksiyonlarla veriliyor, yoksa herkes kendine "alındı" yazmadan ödül
-- kasardı.
-- ---------------------------------------------------------------------------
ALTER TABLE public.gorevler                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gunluk_giris_odulleri      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kullanici_gorev_ilerlemesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kullanici_gunluk_giris     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gorevler, public.gunluk_giris_odulleri,
              public.kullanici_gorev_ilerlemesi, public.kullanici_gunluk_giris
       FROM anon, authenticated;
GRANT SELECT ON public.gorevler, public.gunluk_giris_odulleri TO authenticated;
GRANT SELECT ON public.kullanici_gorev_ilerlemesi, public.kullanici_gunluk_giris TO authenticated;

DROP POLICY IF EXISTS gorev_katalog_oku ON public.gorevler;
CREATE POLICY gorev_katalog_oku ON public.gorevler
    FOR SELECT TO authenticated USING (aktif);

DROP POLICY IF EXISTS gunluk_odul_oku ON public.gunluk_giris_odulleri;
CREATE POLICY gunluk_odul_oku ON public.gunluk_giris_odulleri
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS gorev_ilerleme_oku ON public.kullanici_gorev_ilerlemesi;
CREATE POLICY gorev_ilerleme_oku ON public.kullanici_gorev_ilerlemesi
    FOR SELECT TO authenticated USING (kullanici_id = public.benim_kullanici_id());

DROP POLICY IF EXISTS gunluk_giris_oku ON public.kullanici_gunluk_giris;
CREATE POLICY gunluk_giris_oku ON public.kullanici_gunluk_giris
    FOR SELECT TO authenticated USING (kullanici_id = public.benim_kullanici_id());


-- ############################################################################
-- ##  062_tek_altin_bakiyesi.sql
-- ##  Tek altin bakiyesi — magaza ve cuzdan temel deftere
-- ############################################################################

-- ============================================================================
-- 062 — Tek altın bakiyesi (mağaza + cüzdan, temel şemaya)
--
-- Önce 059 ve 061 çalıştırılmalı (`_enum_etiket` orada tanımlanıyor).
--
-- SORUN:
-- 059 ile hediye gönderimi TEMEL şemanın defterine geçti: altın
-- `balance_lots`tan `lot_harca` ile düşüyor, bakiye
-- `kullanicilar.cached_altin_balance`ta duruyor.
-- Ama mağaza (056) hâlâ bizim eski `cuzdan` tablomuzdan harcıyor ve
-- `benim_bakiyem()` de orayı okuyor. Yani 059'dan sonra kullanıcının İKİ ayrı
-- altını olacaktı: hediye kutusu bir rakam, mağaza/cüzdan/profil başka bir
-- rakam gösterecekti. Altın yüklemesi (admin_altin_yukle) yalnız temel deftere
-- yazdığı için mağaza sürekli "Yetersiz altın" derdi.
--
-- ÇÖZÜM:
-- Tablolar yerinde kalıyor (esyalar / kullanici_esyalari değişmiyor).
-- Yalnızca ALTININ NEREDEN DÜŞTÜĞÜ ve NEREDEN OKUNDUĞU tek yere çekiliyor.
-- Böylece istemcide tek satır değişmeden profil, cüzdan, mağaza ve hediye
-- kutusu aynı sayıyı gösteriyor.
--
-- Eski `cuzdan` tablosu SİLİNMİYOR: içinde test bakiyeleri var ve geri dönmek
-- gerekirse duruyor. Sadece artık kimse okumuyor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Altın harcama yardımcısı — enum etiketleri çalışma anında çözülüyor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._altin_harca(p_kullanici BIGINT, p_miktar BIGINT, p_ref TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_islem  TEXT;
    v_bakiye BIGINT;
BEGIN
    IF p_miktar <= 0 THEN
        SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
        RETURN COALESCE(v_bakiye, 0);
    END IF;

    v_islem := public._enum_etiket('islem_tipi',
        ARRAY['magaza', 'magaza_harcama', 'esya_satin_alma', 'satin_alma',
              'harcama', 'esya', 'hediye_gonderme']);
    IF v_islem IS NULL THEN
        RAISE EXCEPTION 'islem_tipi icinde uygun etiket yok. Mevcut: %',
            public._enum_liste('islem_tipi');
    END IF;

    BEGIN
        EXECUTE format(
            'SELECT public.lot_harca($1, %L::varlik_tipi, $2, %L::islem_tipi, %L)',
            'altin', v_islem, p_ref)
        USING p_kullanici, p_miktar;
    EXCEPTION WHEN OTHERS THEN
        -- Yetersiz bakiye mesajı ekranda tek ve anlaşılır olsun diye
        -- normalleştiriliyor; BAŞKA bir hata ise olduğu gibi yukarı gidiyor
        -- (yoksa yanlış enum etiketi de "Yetersiz altın" diye görünürdü).
        IF SQLERRM ILIKE '%bakiye%' OR SQLERRM ILIKE '%yetersiz%' OR SQLSTATE = '23514' THEN
            RAISE EXCEPTION 'Yetersiz altın.';
        END IF;
        RAISE;
    END;

    SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
    RETURN COALESCE(v_bakiye, 0);
END; $$;
REVOKE ALL ON FUNCTION public._altin_harca(BIGINT, BIGINT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2) Mağaza satın alması artık temel defterden harcıyor
--
-- Gövde 056'daki ile aynı; değişen tek şey bakiye satırı ve dönen değerler.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esya_satin_al(p_esya_id TEXT)
RETURNS TABLE (elmas BIGINT, altin BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben        BIGINT := public.benim_kullanici_id();
    v_esya       public.esyalar%ROWTYPE;
    v_mevcut     public.kullanici_esyalari%ROWTYPE;
    v_yeni_bitis TIMESTAMPTZ;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    SELECT * INTO v_esya FROM public.esyalar WHERE id = p_esya_id AND aktif;
    IF NOT FOUND THEN RAISE EXCEPTION 'Eşya bulunamadı.'; END IF;

    SELECT * INTO v_mevcut
      FROM public.kullanici_esyalari
     WHERE kullanici_id = v_ben AND esya_id = p_esya_id;

    -- Süresiz eşyayı ikinci kez satmayalım.
    IF FOUND AND v_mevcut.bitis IS NULL THEN
        RAISE EXCEPTION 'Bu eşya zaten sende.';
    END IF;

    PERFORM public._altin_harca(v_ben, v_esya.fiyat_altin, 'esya:' || v_esya.id);

    -- Süreli eşyada: kalan süre varsa üstüne eklenir, yoksa bugünden başlar.
    IF v_esya.sure_gun IS NULL THEN
        v_yeni_bitis := NULL;
    ELSE
        v_yeni_bitis := GREATEST(now(), COALESCE(v_mevcut.bitis, now()))
                        + (v_esya.sure_gun || ' days')::INTERVAL;
    END IF;

    INSERT INTO public.kullanici_esyalari (kullanici_id, esya_id, bitis)
    VALUES (v_ben, p_esya_id, v_yeni_bitis)
    ON CONFLICT (kullanici_id, esya_id) DO UPDATE
        SET bitis = EXCLUDED.bitis;

    RETURN QUERY
        SELECT COALESCE(k.cached_total_balance, 0), COALESCE(k.cached_altin_balance, 0)
          FROM public.kullanicilar k WHERE k.id = v_ben;
END; $$;
REVOKE ALL ON FUNCTION public.esya_satin_al(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esya_satin_al(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) benim_bakiyem() artık temel defteri okuyor
--
-- İmza aynı kaldığı için profil, cüzdan ve mağaza ekranlarında tek satır
-- değişmiyor; sadece okudukları sayı doğru yerden geliyor.
--   elmas = cached_total_balance      (satın alınan ana varlık)
--   altin = cached_altin_balance      (hediye/mağaza parası)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.benim_bakiyem()
RETURNS TABLE (elmas BIGINT, altin BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE(k.cached_total_balance, 0), COALESCE(k.cached_altin_balance, 0)
      FROM public.kullanicilar k
     WHERE k.id = public.benim_kullanici_id();
$$;
REVOKE ALL ON FUNCTION public.benim_bakiyem() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.benim_bakiyem() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Cüzdan hareketleri — gerçek defterden
--
-- Cüzdan ekranı `cuzdan_hareketleri` tablosunu okuyordu; artık hareketler
-- `wallet_ledger`a yazılıyor, o tablo susuyor. Enum sütunları metne
-- çevriliyor ki istemci enum etiketlerini bilmek zorunda kalmasın.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hareketlerim_v2(p_limit INTEGER DEFAULT 40)
RETURNS TABLE (id BIGINT, varlik TEXT, miktar BIGINT, aciklama TEXT, tarih TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT w.id,
           w.varlik::TEXT,
           CASE WHEN w.yon::TEXT ILIKE '%cik%' OR w.yon::TEXT ILIKE '%out%' OR w.yon::TEXT ILIKE '%harca%'
                THEN -w.miktar ELSE w.miktar END,
           COALESCE(NULLIF(w.aciklama, ''), w.islem::TEXT),
           w.olusturulma_tarihi
      FROM public.wallet_ledger w
     WHERE w.kullanici_id = public.benim_kullanici_id()
     ORDER BY w.olusturulma_tarihi DESC, w.id DESC
     LIMIT GREATEST(COALESCE(p_limit, 40), 1);
$$;
REVOKE ALL ON FUNCTION public.hareketlerim_v2(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hareketlerim_v2(INTEGER) TO authenticated;
