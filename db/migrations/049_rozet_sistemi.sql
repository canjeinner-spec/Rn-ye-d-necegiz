-- ============================================================================
-- 049_rozet_sistemi.sql — Rozet kataloğu + kazanma kuralları + otomatik verme
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 026 (xp) + 033 (yönetici log) + 044 (beta_tester)'ten SONRA.
--
-- Temel şemada `rozetler` (id, ad, aciklama, ikon_url) ve
-- `kullanici_rozetleri` (id, kullanici_id, rozet_id, kazanma_tarihi) zaten
-- vardı ama İKİSİ DE BOŞTU — hiç rozet tanımlanmamış, kimseye verilmemişti.
-- Bu migration o iki tabloyu kullanılabilir hâle getirir:
--
--   • Katalog genişletilir: kod (uygulamadaki PNG anahtarı), kategori, sıra,
--     ve KAZANMA KURALI (metrik + eşik). Kural boşsa rozet elle verilir.
--   • 62 rozet tohumlanır (6 seviye + 7 rol + 1 özel + 48 oda rozeti).
--   • rozet_metrikleri(): bir kullanıcının ölçülebilir istatistikleri.
--   • rozetleri_degerlendir(): kuralı tutan rozetleri otomatik verir.
--   • rozet_ver / rozet_al: yönetici eliyle verme/alma (+ denetim kaydı).
--   • rozetlerim / kullanici_rozetleri_getir: okuma.
--
-- Idempotent: tekrar çalıştırmak zarar vermez.
-- ============================================================================

-- ── A) Katalog kolonları ────────────────────────────────────────────────────
ALTER TABLE public.rozetler
    ADD COLUMN IF NOT EXISTS kod          TEXT,
    ADD COLUMN IF NOT EXISTS kategori     TEXT,
    ADD COLUMN IF NOT EXISTS sira         INT     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS aktif        BOOLEAN NOT NULL DEFAULT TRUE,
    -- Kural: metrik adı + eşik. NULL ise rozet yalnızca elle verilir.
    ADD COLUMN IF NOT EXISTS kural_metrik TEXT,
    ADD COLUMN IF NOT EXISTS kural_esik   INT;

-- NOT: kısmi index (WHERE kod IS NOT NULL) kullanılmıyor; `ON CONFLICT (kod)`
-- kısmi index'le eşleşmez ve "no unique or exclusion constraint matching"
-- hatası verir. Düz unique index zaten birden çok NULL'a izin verir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rozet_kod ON public.rozetler (kod);

-- Aynı rozet bir kullanıcıya iki kez verilmesin
CREATE UNIQUE INDEX IF NOT EXISTS uq_kullanici_rozet
    ON public.kullanici_rozetleri (kullanici_id, rozet_id);

-- ── B) Okuma izinleri ───────────────────────────────────────────────────────
ALTER TABLE public.rozetler            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kullanici_rozetleri ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.rozetler            TO authenticated;
GRANT SELECT ON public.kullanici_rozetleri TO authenticated;

DROP POLICY IF EXISTS rozet_select ON public.rozetler;
CREATE POLICY rozet_select ON public.rozetler
    FOR SELECT TO authenticated USING (TRUE);  -- katalog herkese açık

DROP POLICY IF EXISTS kullanici_rozet_select ON public.kullanici_rozetleri;
CREATE POLICY kullanici_rozet_select ON public.kullanici_rozetleri
    FOR SELECT TO authenticated USING (TRUE);  -- rozetler profilde görünür

-- ── C) Katalog tohumu ───────────────────────────────────────────────────────
-- kod = uygulamadaki PNG anahtarı. Yazma yalnız buradan; ON CONFLICT ile
-- tekrar çalıştırmada ad/açıklama/kural güncellenir, kazanılmış rozetler
-- bozulmaz.
INSERT INTO public.rozetler (kod, ad, aciklama, ikon_url, kategori, sira, kural_metrik, kural_esik)
VALUES
    -- Seviye rütbeleri (otomatik: seviye eşiği)
    ('level_bronze',     'Bronze',        'İlk adımlar. 1+ seviye.',                    'level/level_bronze',     'level',  10, 'seviye',      1),
    ('level_silver',     'Silver',        'Gümüş rütbe. 10+ seviye.',                   'level/level_silver',     'level',  20, 'seviye',     10),
    ('level_gold',       'Gold',          'Altın rütbe. 20+ seviye.',                   'level/level_gold',       'level',  30, 'seviye',     20),
    ('level_platinum',   'Platinum',      'Platin rütbe. 30+ seviye.',                  'level/level_platinum',   'level',  40, 'seviye',     30),
    ('level_diamond',    'Diamond',       'Elmas rütbe. 40+ seviye.',                   'level/level_diamond',    'level',  50, 'seviye',     40),
    ('level_legendary',  'Legendary',     'Efsanevi rütbe. 50+ seviye.',                'level/level_legendary',  'level',  60, 'seviye',     50),

    -- Roller (rolden gelir, rozet sistemi otomatik vermez)
    ('role_developer',   'Developer',     'Aron Chat geliştirici ekibi.',               'role/developer',         'role',  110, NULL, NULL),
    ('role_super_admin', 'Super Admin',   'Platform genelinde tam yetkili yönetici.',   'role/super_admin',       'role',  120, NULL, NULL),
    ('role_admin',       'Admin',         'Platform yöneticisi.',                       'role/admin',             'role',  130, NULL, NULL),
    ('role_moderator',   'Moderator',     'Topluluk moderatörü.',                       'role/moderator',         'role',  140, NULL, NULL),
    ('role_streamer',    'Streamer',      'Onaylı yayıncı.',                            'role/streamer',          'role',  150, NULL, NULL),
    ('role_vip',         'VIP',           'VIP üyelik ayrıcalıkları.',                  'role/vip',               'role',  160, NULL, NULL),
    ('role_vip_hukumdar','VIP Sovereign', 'En üst düzey VIP.',                          'role/vip_hukumdar',      'role',  170, NULL, NULL),

    -- Özel
    ('special_beta_tester','Beta Tester', 'Beta test sürecine katkı sağlayan üyeler.',  'special/beta_tester',    'special',210, 'beta',        1),

    -- Oda / etkinlik rozetleri — ölçülebilir kurallar
    ('first_voice',      'İlk Ses',       'Bir odada ilk mesajını gönderdin.',          'room/first_voice',       'room',  300, 'oda_mesaj',     1),
    ('active_speaker',   'Aktif Konuşmacı','Odalarda 100 mesaj.',                       'room/active_speaker',    'room',  310, 'oda_mesaj',   100),
    ('chatterbox',       'Geveze',        'Odalarda 500 mesaj.',                        'room/chatterbox',        'room',  320, 'oda_mesaj',   500),
    ('chat_master',      'Sohbet Ustası', 'Odalarda 1000 mesaj.',                       'room/chat_master',       'room',  330, 'oda_mesaj',  1000),
    ('social_butterfly', 'Sosyal Kelebek','200 özel mesaj gönderdin.',                  'room/social_butterfly',  'room',  340, 'dm_mesaj',    200),
    ('team_player',      'Takım Oyuncusu','5 farklı odaya üye oldun.',                  'room/team_player',       'room',  350, 'oda_uyelik',    5),
    ('popular',          'Popüler',       'Profilin 100 kez ziyaret edildi.',           'room/popular',           'room',  360, 'ziyaretci',   100),
    ('loyal_member',     'Sadık Üye',     '30 gündür aramızdasın.',                     'room/loyal_member',      'room',  370, 'hesap_gun',    30),
    ('trusted_member',   'Güvenilir Üye', '90 gündür aramızdasın.',                     'room/trusted_member',    'room',  380, 'hesap_gun',    90),
    ('alpha',            'Alpha',         'İlk 180 günün üyesi.',                       'room/alpha',             'room',  390, 'hesap_gun',   180),
    ('level_master',     'Seviye Ustası', '25+ seviyeye ulaştın.',                      'room/level_master',      'room',  400, 'seviye',       25),
    ('legendary',        'Efsane',        '50+ seviyeye ulaştın.',                      'room/legendary',         'room',  410, 'seviye',       50),
    ('music_lover',      'Müzik Sever',   '50 gönderi paylaştın.',                      'room/music_lover',       'room',  420, 'gonderi',      50),
    ('energy_star',      'Enerji Yıldızı','500 beğeni verdin.',                         'room/energy_star',       'room',  430, 'begeni',      500),
    ('consistent',       'İstikrarlı',    '100 yorum yazdın.',                          'room/consistent',        'room',  440, 'yorum',       100),

    -- Elle verilenler (henüz ölçülemeyen: hediye, seri, sıralama, sezon)
    ('room_owner',       'Oda Sahibi',        'Kendi odasını yöneten üye.',             'room/room_owner',        'room',  500, NULL, NULL),
    ('co_owner',         'Yardımcı Sahip',    'Odanın ikinci yetkilisi.',               'room/co_owner',          'room',  510, NULL, NULL),
    ('room_king',        'Oda Kralı',         'Odanın kralı.',                          'room/room_king',         'room',  520, NULL, NULL),
    ('room_king_v2',     'Oda Kralı II',      'Odanın kralı (yeni tasarım).',           'room/room_king_v2',      'room',  521, NULL, NULL),
    ('room_queen',       'Oda Kraliçesi',     'Odanın kraliçesi.',                      'room/room_queen',        'room',  530, NULL, NULL),
    ('guardian',         'Koruyucu',          'Topluluğu koruyan üye.',                 'room/guardian',          'room',  540, NULL, NULL),
    ('top_gifter',       'En Cömert',         'En çok hediye gönderen.',                'room/top_gifter',        'room',  550, NULL, NULL),
    ('gift_giver',       'Hediye Dağıtan',    'Bolca hediye gönderen üye.',             'room/gift_giver',        'room',  560, NULL, NULL),
    ('daily_streak',     'Günlük Seri',       'Kesintisiz günlük giriş.',               'room/daily_streak',      'room',  570, NULL, NULL),
    ('streak_master',    'Seri Ustası',       'Uzun kesintisiz seri.',                  'room/streak_master',     'room',  580, NULL, NULL),
    ('hot_streak',       'Ateşli Seri',       'Yükselen seri.',                         'room/hot_streak',        'room',  590, NULL, NULL),
    ('night_owl',        'Gece Kuşu',         'Gece aktif olan üye.',                   'room/night_owl',         'room',  600, NULL, NULL),
    ('night_shift',      'Gece Vardiyası',    'Gece odalarını çeviren üye.',            'room/night_shift',       'room',  610, NULL, NULL),
    ('early_bird',       'Erken Kuş',         'Sabahın ilk üyesi.',                     'room/early_bird',        'room',  620, NULL, NULL),
    ('weekly_champion',  'Haftanın Şampiyonu','Haftalık zirvenin sahibi.',              'room/weekly_champion',   'room',  700, NULL, NULL),
    ('weekly_top1',      'Haftalık 1.',       'Haftalık sıralamada birinci.',           'room/weekly_top1',       'room',  710, NULL, NULL),
    ('weekly_top2',      'Haftalık 2.',       'Haftalık sıralamada ikinci.',            'room/weekly_top2',       'room',  720, NULL, NULL),
    ('weekly_top3',      'Haftalık 3.',       'Haftalık sıralamada üçüncü.',            'room/weekly_top3',       'room',  730, NULL, NULL),
    ('rank_bronze',      'Bronz Sıra',        'Sıralamada bronz basamak.',              'room/rank_bronze',       'room',  740, NULL, NULL),
    ('rank_silver',      'Gümüş Sıra',        'Sıralamada gümüş basamak.',              'room/rank_silver',       'room',  750, NULL, NULL),
    ('rank_pusher',      'Yükselen',          'Sıralamada hızla tırmanan.',             'room/rank_pusher',       'room',  760, NULL, NULL),
    ('rising_star',      'Yükselen Yıldız',   'Hızla büyüyen yeni üye.',                'room/rising_star',       'room',  770, NULL, NULL),
    ('vip_member',       'VIP Üye',           'VIP ayrıcalıklarına sahip üye.',         'room/vip_member',        'room',  780, NULL, NULL),
    ('bingo_master',     'Bingo Ustası',      'Bingo etkinliğinin galibi.',             'room/bingo_master',      'room',  800, NULL, NULL),
    ('event_master',     'Etkinlik Ustası',   'Etkinliklerde öne çıkan üye.',           'room/event_master',      'room',  810, NULL, NULL),
    ('spring_bloom',     'Bahar',             'Bahar sezonu rozeti.',                   'room/spring_bloom',      'room',  820, NULL, NULL),
    ('summer_sun',       'Yaz',               'Yaz sezonu rozeti.',                     'room/summer_sun',        'room',  830, NULL, NULL),
    ('autumn_leaf',      'Sonbahar',          'Sonbahar sezonu rozeti.',                'room/autumn_leaf',       'room',  840, NULL, NULL),
    ('winter_star',      'Kış',               'Kış sezonu rozeti.',                     'room/winter_star',       'room',  850, NULL, NULL),
    ('room2',            'Oda Rozeti II',     'Oda rozeti.',                            'room/room2',             'room',  900, NULL, NULL),
    ('room3',            'Oda Rozeti III',    'Oda rozeti.',                            'room/room3',             'room',  910, NULL, NULL),
    ('room4',            'Oda Rozeti IV',     'Oda rozeti.',                            'room/room4',             'room',  920, NULL, NULL),
    ('room5',            'Oda Rozeti V',      'Oda rozeti.',                            'room/room5',             'room',  930, NULL, NULL)
ON CONFLICT (kod) DO UPDATE
    SET ad = EXCLUDED.ad,
        aciklama = EXCLUDED.aciklama,
        ikon_url = EXCLUDED.ikon_url,
        kategori = EXCLUDED.kategori,
        sira = EXCLUDED.sira,
        kural_metrik = EXCLUDED.kural_metrik,
        kural_esik = EXCLUDED.kural_esik;

-- ── D) Kullanıcı metrikleri ─────────────────────────────────────────────────
-- Rozet kurallarının okuduğu ölçülebilir istatistikler. Yalnızca GERÇEKTEN
-- var olan tablolardan hesaplanır; hediye/seri/sıralama gibi henüz izlenmeyen
-- şeyler burada YOK, o rozetler elle veriliyor.
CREATE OR REPLACE FUNCTION public.rozet_metrikleri(p_kullanici BIGINT)
RETURNS TABLE (metrik TEXT, deger BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT 'seviye',     COALESCE((SELECT k.seviye_id FROM public.kullanicilar k WHERE k.id = p_kullanici), 0)::bigint
    UNION ALL SELECT 'xp', COALESCE((SELECT k.deneyim_puani FROM public.kullanicilar k WHERE k.id = p_kullanici), 0)::bigint
    UNION ALL SELECT 'beta', (SELECT CASE WHEN COALESCE(k.beta_tester, FALSE) THEN 1 ELSE 0 END FROM public.kullanicilar k WHERE k.id = p_kullanici)::bigint
    UNION ALL SELECT 'hesap_gun', COALESCE((SELECT EXTRACT(DAY FROM (now() - k.olusturulma_tarihi))::bigint FROM public.kullanicilar k WHERE k.id = p_kullanici), 0)
    UNION ALL SELECT 'oda_mesaj',  (SELECT count(*) FROM public.oda_mesajlari m WHERE m.kullanici_id = p_kullanici)
    UNION ALL SELECT 'dm_mesaj',   (SELECT count(*) FROM public.dm_mesajlari d WHERE d.gonderen_id = p_kullanici)
    UNION ALL SELECT 'oda_uyelik', (SELECT count(*) FROM public.oda_uyeleri u WHERE u.kullanici_id = p_kullanici)
    UNION ALL SELECT 'gonderi',    (SELECT count(*) FROM public.gonderiler g WHERE g.kullanici_id = p_kullanici)
    UNION ALL SELECT 'yorum',      (SELECT count(*) FROM public.gonderi_yorumlari y WHERE y.kullanici_id = p_kullanici)
    UNION ALL SELECT 'begeni',     (SELECT count(*) FROM public.gonderi_begeniler b WHERE b.kullanici_id = p_kullanici)
    UNION ALL SELECT 'ziyaretci',  (SELECT count(*) FROM public.profil_ziyaretleri z WHERE z.ziyaret_edilen_id = p_kullanici);
$$;
REVOKE ALL ON FUNCTION public.rozet_metrikleri(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.rozet_metrikleri(BIGINT) TO authenticated;

-- ── E) Otomatik değerlendirme ───────────────────────────────────────────────
-- Kuralı tutan ve henüz verilmemiş rozetleri verir. Yeni verilen rozet
-- sayısını döndürür. Kullanıcı kendi hesabı için çağırır (uygulama açılışta).
CREATE OR REPLACE FUNCTION public.rozetleri_degerlendir(p_kullanici BIGINT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_hedef BIGINT;
    v_yeni  INT := 0;
BEGIN
    v_hedef := COALESCE(p_kullanici, public.benim_kullanici_id());
    IF v_hedef IS NULL THEN RETURN 0; END IF;
    -- Başkasının rozetlerini yalnızca yönetici değerlendirebilir
    IF v_hedef <> public.benim_kullanici_id() AND NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;

    WITH m AS (SELECT * FROM public.rozet_metrikleri(v_hedef)),
    hak_edilen AS (
        SELECT r.id
          FROM public.rozetler r
          JOIN m ON m.metrik = r.kural_metrik
         WHERE r.aktif
           AND r.kural_metrik IS NOT NULL
           AND r.kural_esik IS NOT NULL
           AND m.deger >= r.kural_esik
    ),
    eklenen AS (
        INSERT INTO public.kullanici_rozetleri (kullanici_id, rozet_id)
        SELECT v_hedef, h.id FROM hak_edilen h
        ON CONFLICT (kullanici_id, rozet_id) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_yeni FROM eklenen;

    RETURN v_yeni;
END; $$;
REVOKE ALL ON FUNCTION public.rozetleri_degerlendir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.rozetleri_degerlendir(BIGINT) TO authenticated;

-- ── F) Yönetici eliyle verme / alma ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rozet_ver(p_hedef BIGINT, p_kod TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_rozet BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    SELECT id INTO v_rozet FROM public.rozetler WHERE kod = p_kod;
    IF v_rozet IS NULL THEN RAISE EXCEPTION 'Rozet bulunamadı: %', p_kod; END IF;
    INSERT INTO public.kullanici_rozetleri (kullanici_id, rozet_id)
    VALUES (p_hedef, v_rozet)
    ON CONFLICT (kullanici_id, rozet_id) DO NOTHING;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'rozet_ver', p_kod);
END; $$;
REVOKE ALL ON FUNCTION public.rozet_ver(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rozet_ver(BIGINT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rozet_al(p_hedef BIGINT, p_kod TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_rozet BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    SELECT id INTO v_rozet FROM public.rozetler WHERE kod = p_kod;
    IF v_rozet IS NULL THEN RAISE EXCEPTION 'Rozet bulunamadı: %', p_kod; END IF;
    DELETE FROM public.kullanici_rozetleri WHERE kullanici_id = p_hedef AND rozet_id = v_rozet;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'rozet_al', p_kod);
END; $$;
REVOKE ALL ON FUNCTION public.rozet_al(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rozet_al(BIGINT, TEXT) TO authenticated;

-- ── G) Okuma ────────────────────────────────────────────────────────────────
-- Bir kullanıcının rozetleri (kazanılmış), gösterim sırasına göre.
CREATE OR REPLACE FUNCTION public.kullanici_rozetleri_getir(p_kullanici BIGINT)
RETURNS TABLE (kod TEXT, ad TEXT, aciklama TEXT, kategori TEXT, kazanma_tarihi TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT r.kod, r.ad, r.aciklama, r.kategori, kr.kazanma_tarihi
      FROM public.kullanici_rozetleri kr
      JOIN public.rozetler r ON r.id = kr.rozet_id
     WHERE kr.kullanici_id = p_kullanici AND r.aktif
     ORDER BY r.sira, r.id;
$$;
REVOKE ALL ON FUNCTION public.kullanici_rozetleri_getir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.kullanici_rozetleri_getir(BIGINT) TO authenticated;

-- Katalog + kullanıcının ilerlemesi (kazanılmamışlar için "kaç/kaç").
CREATE OR REPLACE FUNCTION public.rozet_ilerlemem()
RETURNS TABLE (kod TEXT, ad TEXT, aciklama TEXT, kategori TEXT, kazanildi BOOLEAN,
               kural_metrik TEXT, kural_esik INT, ilerleme BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH ben AS (SELECT public.benim_kullanici_id() AS id),
         m AS (SELECT * FROM public.rozet_metrikleri((SELECT id FROM ben)))
    SELECT r.kod, r.ad, r.aciklama, r.kategori,
           (kr.rozet_id IS NOT NULL) AS kazanildi,
           r.kural_metrik, r.kural_esik,
           COALESCE(m.deger, 0) AS ilerleme
      FROM public.rozetler r
      LEFT JOIN public.kullanici_rozetleri kr
             ON kr.rozet_id = r.id AND kr.kullanici_id = (SELECT id FROM ben)
      LEFT JOIN m ON m.metrik = r.kural_metrik
     WHERE r.aktif
     ORDER BY r.sira, r.id;
$$;
REVOKE ALL ON FUNCTION public.rozet_ilerlemem() FROM public;
GRANT EXECUTE ON FUNCTION public.rozet_ilerlemem() TO authenticated;
