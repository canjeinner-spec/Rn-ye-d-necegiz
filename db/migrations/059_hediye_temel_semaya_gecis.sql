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
