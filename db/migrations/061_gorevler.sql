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
-- `bakiye_kaynagi` ve `islem_tipi` temel şemanın enum'ları; repoda tanımları
-- yok. Etiketi tahmin etmek yerine çalışma anında aranıyor (_enum_etiket).
-- Hiçbir aday tutmazsa fonksiyon, veritabanındaki GERÇEK etiket listesini
-- yazan bir hata veriyor — o satırı görünce doğru etiket tek seferde konur.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Enum yardımcıları
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
