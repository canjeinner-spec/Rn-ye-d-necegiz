-- ============================================================================
-- 066 — Oda rozetleri (kural motoru + elle verme)
--
-- Şimdiye kadar oda rozetleri YALNIZCA `data/seed.ts` içindeki sahte odalara
-- elle yazılmış sabitlerdi; gerçek odalarda hiç görünmüyordu. Görseller
-- (49 rozet) hazır, eksik olan veriydi.
--
-- İKİ KAYNAK, TEK GÖRÜNÜM:
--   • kural  → okuma anında hesaplanır, tabloda durmaz. "Haftalık şampiyon"
--     dün doğruysa bugün başka odanın olabilir; anlık görüntü tutmak yanlış
--     olurdu ve dolduracak zamanlayıcımız da yok (060'taki sıralamayla aynı
--     gerekçe: pg_cron kurulu değil).
--   • elle   → `oda_rozetleri` tablosunda durur. "Resmi Oda", "Etkinlik
--     Ortağı" gibi rozetler doğası gereği kazanılmaz, verilir.
--
-- `oda_rozetleri_getir` ikisini birleştirip döndürür; istemci farkı bilmez.
-- Rozet kodları `components/RoomBadges.tsx` içindeki görsel anahtarlarıyla
-- BİREBİR aynı olmalı, yoksa istemci çizemez.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Katalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oda_rozet_katalogu (
    kod      TEXT PRIMARY KEY,
    ad       TEXT NOT NULL,
    -- Kullanıcıya gösterilecek "nasıl kazanılır" metni.
    aciklama TEXT NOT NULL,
    kaynak   TEXT NOT NULL CHECK (kaynak IN ('kural', 'elle')),
    sira     INTEGER NOT NULL DEFAULT 0,
    aktif    BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.oda_rozet_katalogu (kod, ad, aciklama, kaynak, sira) VALUES
    -- ---- Kuralla kazanılanlar ----------------------------------------------
    ('weekly_champion', 'Haftalık Şampiyon', 'Bu hafta en çok hediye dönen oda',              'kural',  1),
    ('weekly_top2',     'Haftalık 2.',       'Bu haftanın hediye sıralamasında ikinci',       'kural',  2),
    ('weekly_top3',     'Haftalık 3.',       'Bu haftanın hediye sıralamasında üçüncü',       'kural',  3),
    ('top_gifter',      'Hediye Yağmuru',    'Bu hafta 50.000 altınlık hediye dönmüş',        'kural',  4),
    ('hot_streak',      'Ateş Serisi',       'Üç gün üst üste hediye alınmış',                'kural',  5),
    ('popular',         'Popüler',           'Son 7 günün en çok ziyaret edilen 5 odasından', 'kural',  6),
    ('chat_master',     'Sohbet Ustası',     'Son 7 günde 300+ mesaj yazılmış',               'kural',  7),
    ('night_owl',       'Gece Kuşu',         'Mesajların yarısı 00.00-06.00 arası',           'kural',  8),
    ('early_bird',      'Erkenci',           'Mesajların %40''ı 06.00-11.00 arası',           'kural',  9),
    ('rising_star',     'Yükselen Yıldız',   'Yeni açılmış ve 15+ kişi uğramış',              'kural', 10),
    ('level_master',    'Seviye Ustası',     'Oda seviyesi 10 ve üzeri',                      'kural', 11),
    -- ---- Elle verilenler ---------------------------------------------------
    ('legendary',       'Efsanevi',          'Yönetim tarafından verilir',                    'elle',  20),
    ('event_master',    'Etkinlik Ustası',   'Etkinlik ortağı odalara verilir',               'elle',  21),
    ('guardian',        'Koruyucu',          'Örnek moderasyon gösteren odalara',             'elle',  22),
    ('vip_member',      'VIP Oda',           'Yönetim tarafından verilir',                    'elle',  23),
    ('room_king',       'Oda Kralı',         'Yönetim tarafından verilir',                    'elle',  24),
    ('room_queen',      'Oda Kraliçesi',     'Yönetim tarafından verilir',                    'elle',  25),
    ('first_voice',     'İlk Ses',           'Kuruluş dönemi odalarına',                      'elle',  26),
    ('alpha',           'Alfa',              'Beta öncesi kurulan odalara',                   'elle',  27),
    ('winter_star',     'Kış Yıldızı',       'Sezonluk — yönetim verir',                      'elle',  28),
    ('spring_bloom',    'Bahar Çiçeği',      'Sezonluk — yönetim verir',                      'elle',  29),
    ('summer_sun',      'Yaz Güneşi',        'Sezonluk — yönetim verir',                      'elle',  30),
    ('autumn_leaf',     'Sonbahar Yaprağı',  'Sezonluk — yönetim verir',                      'elle',  31),
    ('music_lover',     'Müzik Sever',       'Yönetim tarafından verilir',                    'elle',  32),
    ('social_butterfly','Sosyal Kelebek',    'Yönetim tarafından verilir',                    'elle',  33),
    ('energy_star',     'Enerji Yıldızı',    'Yönetim tarafından verilir',                    'elle',  34)
ON CONFLICT (kod) DO UPDATE SET
    ad = EXCLUDED.ad, aciklama = EXCLUDED.aciklama,
    kaynak = EXCLUDED.kaynak, sira = EXCLUDED.sira, aktif = TRUE;

-- ---------------------------------------------------------------------------
-- 2) Elle verilen rozetler
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oda_rozetleri (
    oda_id   BIGINT      NOT NULL REFERENCES public.odalar(id) ON DELETE CASCADE,
    kod      TEXT        NOT NULL REFERENCES public.oda_rozet_katalogu(kod) ON DELETE CASCADE,
    veren_id BIGINT,
    sebep    TEXT,
    verilme  TIMESTAMPTZ NOT NULL DEFAULT now(),
    bitis    TIMESTAMPTZ,     -- NULL = süresiz
    PRIMARY KEY (oda_id, kod)
);
CREATE INDEX IF NOT EXISTS idx_oda_rozet_oda ON public.oda_rozetleri (oda_id);

ALTER TABLE public.oda_rozet_katalogu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oda_rozetleri      ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oda_rozet_katalogu, public.oda_rozetleri FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.oda_rozet_katalogu TO authenticated;

DROP POLICY IF EXISTS oda_rozet_katalog_oku ON public.oda_rozet_katalogu;
CREATE POLICY oda_rozet_katalog_oku ON public.oda_rozet_katalogu
    FOR SELECT TO authenticated USING (aktif);

-- `oda_rozetleri`ne doğrudan SELECT yok: rozetler tek kapıdan
-- (oda_rozetleri_getir) çıkıyor, yazma da yalnızca yönetici fonksiyonuyla.

-- ---------------------------------------------------------------------------
-- 3) Rozetleri getir — kural + elle, tek listede
--
-- `deger` yalnızca sayılı rozetlerde dolu (şimdilik `lv`).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oda_rozetleri_getir(p_oda_ids BIGINT[])
RETURNS TABLE (oda_id BIGINT, kod TEXT, deger INTEGER, sira INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH hedef AS (
        SELECT o.id, o.toplam_deneyim, o.olusturulma_tarihi
          FROM public.odalar o
         WHERE o.id = ANY (p_oda_ids) AND NOT o.silinmis
    ),
    hafta AS (SELECT public._siralama_baslangic('hafta') AS an),
    gun7  AS (SELECT now() - INTERVAL '7 days' AS an),

    -- Haftalık hediye hacmi + sıra
    hediye AS (
        SELECT h.oda_id AS oid, SUM(h.toplam_deger)::BIGINT AS deger
          FROM public.hediye_gecmisi h, hafta w
         WHERE h.oda_id IS NOT NULL AND h.gonderilme_tarihi >= w.an
         GROUP BY h.oda_id
    ),
    hediye_sirali AS (
        SELECT oid, deger, ROW_NUMBER() OVER (ORDER BY deger DESC, oid) AS sira FROM hediye
    ),

    -- Son 7 günün ziyaretçi sayısı + popülerlik sırası
    ziyaret AS (
        SELECT z.oda_id AS oid, COUNT(DISTINCT z.kullanici_id) AS kisi
          FROM public.oda_ziyaretleri z, gun7 g
         WHERE z.son_giris >= g.an
         GROUP BY z.oda_id
    ),
    ziyaret_sirali AS (
        SELECT oid, kisi, ROW_NUMBER() OVER (ORDER BY kisi DESC, oid) AS sira FROM ziyaret
    ),

    -- Son 7 günün mesaj dağılımı (saatler Europe/Istanbul)
    mesaj AS (
        SELECT m.oda_id AS oid,
               COUNT(*) AS toplam,
               COUNT(*) FILTER (
                   WHERE EXTRACT(HOUR FROM m.gonderilme_tarihi AT TIME ZONE 'Europe/Istanbul') < 6
               ) AS gece,
               COUNT(*) FILTER (
                   WHERE EXTRACT(HOUR FROM m.gonderilme_tarihi AT TIME ZONE 'Europe/Istanbul') BETWEEN 6 AND 10
               ) AS sabah
          FROM public.oda_mesajlari m, gun7 g
         WHERE m.gonderilme_tarihi >= g.an
         GROUP BY m.oda_id
    ),

    -- Son üç günün her birinde hediye dönmüş mü
    seri AS (
        SELECT h.oda_id AS oid
          FROM public.hediye_gecmisi h
         WHERE h.oda_id IS NOT NULL
           AND h.gonderilme_tarihi >= (now() AT TIME ZONE 'Europe/Istanbul')::DATE - 2
         GROUP BY h.oda_id
        HAVING COUNT(DISTINCT (h.gonderilme_tarihi AT TIME ZONE 'Europe/Istanbul')::DATE) >= 3
    ),

    kural AS (
        SELECT t.id, 'weekly_champion'::TEXT, NULL::INTEGER FROM hedef t JOIN hediye_sirali s ON s.oid = t.id WHERE s.sira = 1
        UNION ALL SELECT t.id, 'weekly_top2', NULL FROM hedef t JOIN hediye_sirali s ON s.oid = t.id WHERE s.sira = 2
        UNION ALL SELECT t.id, 'weekly_top3', NULL FROM hedef t JOIN hediye_sirali s ON s.oid = t.id WHERE s.sira = 3
        UNION ALL SELECT t.id, 'top_gifter',  NULL FROM hedef t JOIN hediye_sirali s ON s.oid = t.id WHERE s.deger >= 50000
        UNION ALL SELECT t.id, 'hot_streak',  NULL FROM hedef t JOIN seri s ON s.oid = t.id
        UNION ALL SELECT t.id, 'popular',     NULL FROM hedef t JOIN ziyaret_sirali z ON z.oid = t.id WHERE z.sira <= 5 AND z.kisi >= 5
        UNION ALL SELECT t.id, 'chat_master', NULL FROM hedef t JOIN mesaj m ON m.oid = t.id WHERE m.toplam >= 300
        UNION ALL SELECT t.id, 'night_owl',   NULL FROM hedef t JOIN mesaj m ON m.oid = t.id WHERE m.toplam >= 30 AND m.gece * 2 >= m.toplam
        UNION ALL SELECT t.id, 'early_bird',  NULL FROM hedef t JOIN mesaj m ON m.oid = t.id WHERE m.toplam >= 30 AND m.sabah * 5 >= m.toplam * 2
        UNION ALL SELECT t.id, 'rising_star', NULL FROM hedef t JOIN ziyaret z ON z.oid = t.id
                   WHERE t.olusturulma_tarihi >= now() - INTERVAL '7 days' AND z.kisi >= 15
        UNION ALL SELECT t.id, 'level_master', NULL FROM hedef t
                   WHERE (SELECT COUNT(*) FROM public.oda_seviyeleri sv WHERE sv.minimum_deneyim_puani <= t.toplam_deneyim) >= 10
        -- Seviye rozeti sayılıdır: gösterilecek değer odanın seviyesi.
        UNION ALL SELECT t.id, 'lv',
                   GREATEST(1, (SELECT COUNT(*)::INTEGER FROM public.oda_seviyeleri sv WHERE sv.minimum_deneyim_puani <= t.toplam_deneyim))
              FROM hedef t
    ),
    elle AS (
        SELECT r.oda_id, r.kod, NULL::INTEGER
          FROM public.oda_rozetleri r
          JOIN hedef t ON t.id = r.oda_id
         WHERE r.bitis IS NULL OR r.bitis > now()
    )
    SELECT b.id, b.kod, b.deger, COALESCE(k.sira, 99)
      FROM (SELECT * FROM kural UNION ALL SELECT * FROM elle) AS b(id, kod, deger)
      LEFT JOIN public.oda_rozet_katalogu k ON k.kod = b.kod
     WHERE b.kod = 'lv' OR COALESCE(k.aktif, FALSE)
     ORDER BY 1, 4, 2;
$$;
REVOKE ALL ON FUNCTION public.oda_rozetleri_getir(BIGINT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_rozetleri_getir(BIGINT[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Elle ver / geri al (yönetici)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_oda_rozet_ver(
    p_oda_id BIGINT, p_kod TEXT, p_gun INTEGER DEFAULT NULL, p_sebep TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_kaynak TEXT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bu işlem için yönetici olmalısın.';
    END IF;

    SELECT kaynak INTO v_kaynak FROM public.oda_rozet_katalogu WHERE kod = p_kod AND aktif;
    IF v_kaynak IS NULL THEN RAISE EXCEPTION 'Rozet bulunamadı: %', p_kod; END IF;
    -- Kuralla kazanılan rozeti elle vermek listeyi yalancı yapar; koşulu
    -- sağlamayan oda onu taşımamalı.
    IF v_kaynak <> 'elle' THEN
        RAISE EXCEPTION 'Bu rozet kuralla kazanılır, elle verilemez: %', p_kod;
    END IF;

    INSERT INTO public.oda_rozetleri (oda_id, kod, veren_id, sebep, bitis)
    VALUES (p_oda_id, p_kod, public.benim_kullanici_id(), p_sebep,
            CASE WHEN p_gun IS NULL THEN NULL ELSE now() + (p_gun || ' days')::INTERVAL END)
    ON CONFLICT (oda_id, kod) DO UPDATE
        SET veren_id = EXCLUDED.veren_id, sebep = EXCLUDED.sebep,
            verilme = now(), bitis = EXCLUDED.bitis;
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_rozet_ver(BIGINT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_oda_rozet_ver(BIGINT, TEXT, INTEGER, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_oda_rozet_al(p_oda_id BIGINT, p_kod TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bu işlem için yönetici olmalısın.';
    END IF;
    DELETE FROM public.oda_rozetleri WHERE oda_id = p_oda_id AND kod = p_kod;
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_rozet_al(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_oda_rozet_al(BIGINT, TEXT) TO authenticated;

-- Yönetim ekranı: bir odanın elle verilmiş rozetleri (kim vermiş, ne zaman).
CREATE OR REPLACE FUNCTION public.admin_oda_rozet_listesi(p_oda_id BIGINT)
RETURNS TABLE (kod TEXT, ad TEXT, sebep TEXT, verilme TIMESTAMPTZ, bitis TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT r.kod, k.ad, r.sebep, r.verilme, r.bitis
      FROM public.oda_rozetleri r
      JOIN public.oda_rozet_katalogu k ON k.kod = r.kod
     WHERE r.oda_id = p_oda_id AND public.ben_platform_yoneticisi()
     ORDER BY r.verilme DESC;
$$;
REVOKE ALL ON FUNCTION public.admin_oda_rozet_listesi(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_oda_rozet_listesi(BIGINT) TO authenticated;

-- Hız — rozet sorguları hep tarihe göre süzüyor.
CREATE INDEX IF NOT EXISTS idx_oda_mesajlari_tarih ON public.oda_mesajlari (oda_id, gonderilme_tarihi DESC);
CREATE INDEX IF NOT EXISTS idx_oda_ziyaret_tarih   ON public.oda_ziyaretleri (oda_id, son_giris DESC);
