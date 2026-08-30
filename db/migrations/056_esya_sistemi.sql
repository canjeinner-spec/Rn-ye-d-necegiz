-- ============================================================================
-- 056_esya_sistemi.sql — Mağaza + envanter + kuşanma (gerçek ekonomi)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 003 (benim_kullanici_id), 021 (ben_platform_yoneticisi) ve
-- 027 (cuzdan, _bakiye_uygula)'den SONRA.
--
-- Mağaza ve "Eşyalarım" tamamen sahteydi: katalog data/store.ts sabitiydi,
-- bakiye ekranda yazan 12.400 sabitiydi, "Satın Al" yerel bir Set'e ekliyor,
-- "Kuşan" yerel state'i çeviriyordu. Uygulama kapanınca hepsi unutuluyordu.
--
-- Bu dosya üçünü de gerçek yapar:
--   • esyalar             — katalog (çerçeve / giriş efekti / sohbet balonu)
--   • kullanici_esyalari  — kimde ne var, ne zaman bitiyor, ne kuşanılı
--   • esya_satin_al       — altını ATOMİK düşer (cüzdan defterine de yazar)
--   • esya_kusan / esya_cikar — tip başına tek aktif eşya
--   • kusanili_esyalar    — herkese açık görünüm: kimin neyi kuşandığı
--     (odada/profilde başkasının çerçevesini çizebilmek için gerekli)
--
-- Görseller istemcide ÜRETİLİYOR (SVG + Reanimated); burada yalnızca `tema`
-- anahtarı tutulur. Bu yüzden yeni eşya eklemek için asset gerekmiyor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Katalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esyalar (
    id          TEXT    PRIMARY KEY,
    tip         TEXT    NOT NULL CHECK (tip IN ('cerceve', 'giris', 'balon')),
    ad          TEXT    NOT NULL,
    aciklama    TEXT,
    -- İstemcideki görsel anahtarı (data/esyaTemalari.ts + FramePreview).
    tema        TEXT    NOT NULL,
    nadirlik    TEXT    NOT NULL DEFAULT 'standart'
                CHECK (nadirlik IN ('standart', 'nadir', 'epik', 'efsane')),
    fiyat_altin BIGINT  NOT NULL DEFAULT 0 CHECK (fiyat_altin >= 0),
    -- NULL = süresiz. Doluysa satın alınca bugüne eklenir, tekrar alınca uzar.
    sure_gun    INTEGER CHECK (sure_gun IS NULL OR sure_gun > 0),
    aktif       BOOLEAN NOT NULL DEFAULT TRUE,
    sira        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_esya_tip ON public.esyalar (tip, sira);

ALTER TABLE public.esyalar ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.esyalar FROM anon, authenticated;
GRANT SELECT ON public.esyalar TO authenticated;

-- Katalog herkese açık (yalnızca aktif olanlar).
DROP POLICY IF EXISTS esya_select ON public.esyalar;
CREATE POLICY esya_select ON public.esyalar
    FOR SELECT TO authenticated
    USING (aktif OR public.ben_platform_yoneticisi());

-- ---------------------------------------------------------------------------
-- 2) Kullanıcının eşyaları
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kullanici_esyalari (
    kullanici_id BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    esya_id      TEXT        NOT NULL REFERENCES public.esyalar(id)      ON DELETE CASCADE,
    edinme       TIMESTAMPTZ NOT NULL DEFAULT now(),
    bitis        TIMESTAMPTZ,          -- NULL = süresiz
    kusanildi    BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (kullanici_id, esya_id)
);
CREATE INDEX IF NOT EXISTS idx_kul_esya_kullanici ON public.kullanici_esyalari (kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kul_esya_kusanili  ON public.kullanici_esyalari (kullanici_id) WHERE kusanildi;

ALTER TABLE public.kullanici_esyalari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kullanici_esyalari FROM anon, authenticated;
GRANT SELECT (kullanici_id, esya_id, edinme, bitis, kusanildi) ON public.kullanici_esyalari TO authenticated;

-- Envanterini yalnızca sen görürsün. Yazma YOK: satın alma/kuşanma
-- fonksiyonlarla yapılır (yoksa istemci kendine bedava eşya yazardı).
DROP POLICY IF EXISTS kul_esya_select ON public.kullanici_esyalari;
CREATE POLICY kul_esya_select ON public.kullanici_esyalari
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

-- ---------------------------------------------------------------------------
-- 3) Kuşanılan eşyalar — HERKESE AÇIK görünüm
--
-- Odada/profilde başkasının çerçevesini, giriş efektini, sohbet balonunu
-- çizebilmek için gerekli. Yalnızca "kim neyi kuşanmış" bilgisini verir;
-- envanterin tamamını (ne zaman aldın, ne zaman bitiyor) açmaz.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.kusanili_esyalar AS
SELECT ke.kullanici_id,
       e.tip,
       e.id   AS esya_id,
       e.tema,
       e.ad,
       e.nadirlik
  FROM public.kullanici_esyalari ke
  JOIN public.esyalar e ON e.id = ke.esya_id
 WHERE ke.kusanildi
   AND (ke.bitis IS NULL OR ke.bitis > now())
   AND e.aktif;

GRANT SELECT ON public.kusanili_esyalar TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Satın alma — altını atomik düşer, cüzdan defterine yazar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esya_satin_al(p_esya_id TEXT)
RETURNS TABLE (elmas BIGINT, altin BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben   BIGINT := public.benim_kullanici_id();
    v_esya  public.esyalar%ROWTYPE;
    v_mevcut public.kullanici_esyalari%ROWTYPE;
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

    -- Bakiyeden düş (negatife düşerse check_violation → yetersiz bakiye).
    BEGIN
        PERFORM public._bakiye_uygula(v_ben, 'altin', -v_esya.fiyat_altin,
                                      'Mağaza: ' || v_esya.ad, v_ben);
    EXCEPTION WHEN check_violation THEN
        RAISE EXCEPTION 'Yetersiz altın.';
    END;

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
        SELECT COALESCE(c.elmas, 0), COALESCE(c.altin, 0)
          FROM public.cuzdan c WHERE c.kullanici_id = v_ben;
END; $$;

REVOKE ALL ON FUNCTION public.esya_satin_al(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esya_satin_al(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Kuşan / çıkar — tip başına tek aktif eşya
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esya_kusan(p_esya_id TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben BIGINT := public.benim_kullanici_id();
    v_tip TEXT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    SELECT e.tip INTO v_tip
      FROM public.kullanici_esyalari ke
      JOIN public.esyalar e ON e.id = ke.esya_id
     WHERE ke.kullanici_id = v_ben
       AND ke.esya_id = p_esya_id
       AND (ke.bitis IS NULL OR ke.bitis > now());

    IF v_tip IS NULL THEN
        RAISE EXCEPTION 'Bu eşya sende yok ya da süresi dolmuş.';
    END IF;

    -- Aynı tipteki diğerlerini çıkar (tek çerçeve, tek giriş, tek balon).
    UPDATE public.kullanici_esyalari ke
       SET kusanildi = FALSE
      FROM public.esyalar e
     WHERE ke.esya_id = e.id
       AND ke.kullanici_id = v_ben
       AND e.tip = v_tip
       AND ke.kusanildi;

    UPDATE public.kullanici_esyalari
       SET kusanildi = TRUE
     WHERE kullanici_id = v_ben AND esya_id = p_esya_id;
END; $$;

REVOKE ALL ON FUNCTION public.esya_kusan(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esya_kusan(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.esya_cikar(p_esya_id TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    UPDATE public.kullanici_esyalari
       SET kusanildi = FALSE
     WHERE kullanici_id = v_ben AND esya_id = p_esya_id;
END; $$;

REVOKE ALL ON FUNCTION public.esya_cikar(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esya_cikar(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Katalog verisi — 42 eşya
--
-- Tekrar çalıştırılabilir: ad/fiyat/sıra güncellenir, kimsenin envanteri
-- bozulmaz.
-- ---------------------------------------------------------------------------
INSERT INTO public.esyalar (id, tip, ad, aciklama, tema, nadirlik, fiyat_altin, sure_gun, sira) VALUES
-- ---- Çerçeveler ----------------------------------------------------------
('cerceve_gumus',        'cerceve', 'Gümüş Halka',    'Yavaşça dönen gümüş halka',        'gumus',        'standart',   800,   30,  1),
('cerceve_neon_mavi',    'cerceve', 'Neon Mavi',      'Nabız gibi atan elektrik mavisi',  'neon_mavi',    'standart',  1200,   30,  2),
('cerceve_zumrut',       'cerceve', 'Zümrüt',         'Derin yeşil çift halka',           'zumrut',       'standart',  1500,   30,  3),
('cerceve_kehribar',     'cerceve', 'Kehribar',       'Sıcak amber parıltı',              'kehribar',     'standart',  1500,   30,  4),
('cerceve_okyanus',      'cerceve', 'Okyanus',        'Mavi-turkuaz akış',                'okyanus',      'nadir',     2500,   30,  5),
('cerceve_gul',          'cerceve', 'Gül Altın',      'Pembe-altın ikili halka',          'gul',          'nadir',     2800,   30,  6),
('cerceve_mor_sis',      'cerceve', 'Mor Sis',        'Süzülen mor partiküller',          'mor_sis',      'nadir',     3000,   30,  7),
('cerceve_buz',          'cerceve', 'Buz Kristali',   'Kırılgan buz parıltısı',           'buz',          'nadir',     3200,   30,  8),
('cerceve_safir',        'cerceve', 'Safir',          'Koyu mavi taş parlaması',          'safir',        'nadir',     3500,   30,  9),
('cerceve_kizil',        'cerceve', 'Kızıl Fırtına',  'Çift kor kıvılcım halkası',        'kizil',        'epik',      5000,   30, 10),
('cerceve_lav',          'cerceve', 'Lav',            'Akan lav çatlakları',              'lav',          'epik',      5500,   30, 11),
('cerceve_gun_batimi',   'cerceve', 'Gün Batımı',     'Turuncudan pembeye geçiş',         'gun_batimi',   'epik',      6000,   30, 12),
('cerceve_yesil_dalga',  'cerceve', 'Yeşil Dalga',    'Ses dalgası efekti',               'yesil_dalga',  'epik',      6500,   30, 13),
('cerceve_mor_lazer',    'cerceve', 'Mor Lazer',      'Lazer ışın halkası',               'mor_lazer',    'epik',      7000,   30, 14),
('cerceve_altin_tac',    'cerceve', 'Altın Taç',      'Dönen altın taç',                  'altin_tac',    'efsane',    9000,   30, 15),
('cerceve_obsidyen',     'cerceve', 'Obsidyen',       'Karanlık taş + altın damar',       'obsidyen',     'efsane',   12000,   30, 16),
('cerceve_galaksi',      'cerceve', 'Galaksi',        'Mor-mavi yıldız girdabı',          'galaksi',      'efsane',   14000,   30, 17),
('cerceve_platin',       'cerceve', 'Platin',         'Soğuk platin parlaklığı',          'platin',       'efsane',   16000,   30, 18),
('cerceve_altin_yayin',  'cerceve', 'Altın Yayın',    'Konsantrik yayın halkaları',       'altin_yayin',  'efsane',   20000,   30, 19),
('cerceve_ejder',        'cerceve', 'Ejder Közü',     'Sönmeyen kor — süresiz',           'ejder',        'efsane',   25000, NULL, 20),
-- ---- Giriş efektleri -----------------------------------------------------
('giris_yildiz',         'giris',   'Yıldız Tozu',    'Arkanda yıldızlar dökülür',        'yildiz',       'standart',  1000,   30,  1),
('giris_kalp',           'giris',   'Kalp Yağmuru',   'Kalpler süzülerek düşer',          'kalp',         'standart',  1200,   30,  2),
('giris_konfeti',        'giris',   'Konfeti',        'Renkli konfeti patlaması',         'konfeti',      'standart',  1400,   30,  3),
('giris_dalga',          'giris',   'Ses Dalgası',    'Girişte ses dalgası yayılır',      'dalga',        'nadir',     2200,   30,  4),
('giris_kar',            'giris',   'Kar Tanesi',     'Buz mavisi kar taneleri',          'kar',          'nadir',     2400,   30,  5),
('giris_simsek',         'giris',   'Şimşek',         'Ekranı bir an aydınlatır',         'simsek',       'nadir',     3000,   30,  6),
('giris_alev',           'giris',   'Alev Girişi',    'Alevden bir iz bırakır',           'alev',         'epik',      4500,   30,  7),
('giris_kanat',          'giris',   'Melek Kanadı',   'Beyaz kanatlarla süzülüş',         'kanat',        'epik',      5200,   30,  8),
('giris_meteor',         'giris',   'Meteor',         'Gökten düşen kor taş',             'meteor',       'epik',      6000,   30,  9),
('giris_araba',          'giris',   'Spor Araba',     'Gaza basarak giriş',               'araba',        'efsane',    9500,   30, 10),
('giris_altin_yagmur',   'giris',   'Altın Yağmuru',  'Altın sikkeler dökülür',           'altin_yagmur', 'efsane',   13000,   30, 11),
('giris_taht',           'giris',   'Sultan Tahtı',   'Tahtla giriş — süresiz',           'taht',         'efsane',   22000, NULL, 12),
-- ---- Sohbet balonları ----------------------------------------------------
('balon_sade',           'balon',   'Sade',           'Temiz, ince çerçeveli balon',      'sade',         'standart',   500,   30,  1),
('balon_altin',          'balon',   'Altın Baloncuk', 'Altın hatlı sıcak balon',          'altin',        'standart',  1000,   30,  2),
('balon_okyanus',        'balon',   'Okyanus',        'Mavi-turkuaz geçişli balon',       'okyanus',      'standart',  1200,   30,  3),
('balon_gul',            'balon',   'Gül',            'Pembe-altın yumuşak balon',        'gul',          'nadir',     1800,   30,  4),
('balon_mor_neon',       'balon',   'Mor Neon',       'Işıldayan mor kenar',              'mor_neon',     'nadir',     2200,   30,  5),
('balon_zumrut',         'balon',   'Zümrüt',         'Derin yeşil cam',                  'zumrut',       'nadir',     2400,   30,  6),
('balon_ates',           'balon',   'Ateş',           'Kordan kenarlı balon',             'ates',         'epik',      3600,   30,  7),
('balon_buz',            'balon',   'Buz',            'Buzlu cam görünümü',               'buz',          'epik',      3800,   30,  8),
('balon_galaksi',        'balon',   'Galaksi',        'Yıldız tozu geçişi',               'galaksi',      'efsane',    7000,   30,  9),
('balon_kraliyet',       'balon',   'Kraliyet',       'Altın taçlı balon — süresiz',      'kraliyet',     'efsane',   11000, NULL, 10)
ON CONFLICT (id) DO UPDATE SET
    tip         = EXCLUDED.tip,
    ad          = EXCLUDED.ad,
    aciklama    = EXCLUDED.aciklama,
    tema        = EXCLUDED.tema,
    nadirlik    = EXCLUDED.nadirlik,
    fiyat_altin = EXCLUDED.fiyat_altin,
    sure_gun    = EXCLUDED.sure_gun,
    sira        = EXCLUDED.sira,
    aktif       = TRUE;
