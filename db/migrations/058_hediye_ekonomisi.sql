-- ============================================================================
-- 058_hediye_ekonomisi.sql — Hediye gönderimi, yayıncı kazancı, %30 komisyon
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 003 (benim_kullanici_id), 021 (ben_platform_yoneticisi),
-- 027 (cuzdan, _bakiye_uygula)'den SONRA.
--
-- Hediye gönderme tamamen sahteydi: animasyon oynuyor, sohbete satır düşüyor,
-- ama gönderenin bakiyesinden BİR ŞEY DÜŞMÜYOR, alıcıya HİÇBİR ŞEY GEÇMİYORDU.
-- Yayıncı panelindeki kazanç da data/agency.ts sabitiydi ($142.50).
--
-- Para birimi mantığı:
--   • elmas → ödenen para birimi. Hediye elmasla gönderilir.
--   • altın → KAZANILAN para birimi. Alınan hediye altın olarak yazılır,
--     mağazada harcanır, para çekmede paraya döner.
--   • Kur: 1 elmas = 1 altın (brüt). Kesinti bunun üstünden yapılır.
--
-- Komisyon: alınan hediyenin %30'u platforma kalır, %70'i yayıncıya yazılır.
-- Oran platform_ayarlari tablosunda — kod dağıtmadan SQL'den değiştirilebilir.
--
-- Fiyat neden DB'de: katalog istemcide (data/gifts.ts) sabitti. Fiyat istemciden
-- gelseydi 500.000 elmaslık hediye 1 elmasa gönderilebilirdi.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Platform ayarları
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_ayarlari (
    anahtar  TEXT    PRIMARY KEY,
    deger    NUMERIC NOT NULL,
    aciklama TEXT
);

INSERT INTO public.platform_ayarlari (anahtar, deger, aciklama) VALUES
    ('hediye_komisyon', 0.30, 'Alınan hediyeden platforma kalan pay (0-1)')
ON CONFLICT (anahtar) DO NOTHING;   -- elle değiştirildiyse üstüne yazma

ALTER TABLE public.platform_ayarlari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_ayarlari FROM anon, authenticated;
GRANT SELECT ON public.platform_ayarlari TO authenticated;

DROP POLICY IF EXISTS ayar_select ON public.platform_ayarlari;
CREATE POLICY ayar_select ON public.platform_ayarlari
    FOR SELECT TO authenticated USING (TRUE);

-- ---------------------------------------------------------------------------
-- 2) Hediye kataloğu
--
-- NOT: temel şemada (schema v7) zaten "hediyeler" adında bir tablo var ama
-- kolonları farklı; CREATE TABLE IF NOT EXISTS onu görüp geçiyor ve INSERT
-- "column sekme does not exist" ile patlıyordu. Cüzdanda yapılanın aynısı:
-- eskisine DOKUNMUYORUZ, kendi tablomuzu ayrı adla kuruyoruz.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hediye_katalogu (
    id           TEXT    PRIMARY KEY,
    sekme        INTEGER NOT NULL DEFAULT 0,   -- data/gifts.ts sekme sırası
    ad           TEXT    NOT NULL,
    emoji        TEXT    NOT NULL,
    fiyat_elmas  BIGINT  NOT NULL CHECK (fiyat_elmas > 0),
    kademe       TEXT    NOT NULL DEFAULT 'normal'
                 CHECK (kademe IN ('normal', 'rare', 'epic', 'legendary')),
    aktif        BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_hediye_katalog_sekme ON public.hediye_katalogu (sekme);

ALTER TABLE public.hediye_katalogu ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hediye_katalogu FROM anon, authenticated;
GRANT SELECT ON public.hediye_katalogu TO authenticated;

DROP POLICY IF EXISTS hediye_katalog_select ON public.hediye_katalogu;
CREATE POLICY hediye_katalog_select ON public.hediye_katalogu
    FOR SELECT TO authenticated USING (aktif OR public.ben_platform_yoneticisi());

INSERT INTO public.hediye_katalogu (id, sekme, ad, emoji, fiyat_elmas, kademe) VALUES
('ring', 0, 'CP Yüzüğü', '💍', 50000, 'epic'),
('pistol', 0, 'Altın Tabanca', '🔫', 10000, 'rare'),
('watch', 0, 'Altın Saat', '⌚', 10000, 'rare'),
('em', 0, 'Zümrüt Yüzük', '💎', 30000, 'epic'),
('bag', 0, 'Şanslı Paket', '🎁', 50000, 'epic'),
('throne', 0, 'Aslan Tahtı', '🦁', 100000, 'legendary'),
('space', 0, 'Yıldızlararası', '🚀', 100000, 'legendary'),
('eiffel', 0, 'Romantik Eyfel', '🗼', 300000, 'legendary'),
('rose', 1, 'Tek Gül', '🌹', 520, 'normal'),
('heart', 1, 'Kalp', '❤️', 1314, 'normal'),
('kiss', 1, 'Öpücük', '💋', 1990, 'rare'),
('bouquet', 1, 'Gül Buketi', '💐', 9999, 'rare'),
('cprings', 1, 'Çift Yüzük', '💞', 13140, 'epic'),
('teddy', 1, 'Aşk Ayıcığı', '🧸', 20000, 'epic'),
('cupid', 1, 'Aşk Oku', '💘', 52000, 'epic'),
('wedding', 1, 'Düğün Sarayı', '💒', 520000, 'legendary'),
('clover', 2, 'Şanslı Yonca', '🍀', 1000, 'normal'),
('dice', 2, 'Zar', '🎲', 5000, 'normal'),
('slot', 2, 'Slot', '🎰', 20000, 'rare'),
('gembox', 2, 'Sürpriz Kutu', '💝', 30000, 'epic'),
('wheel', 3, 'Çark', '🎡', 8000, 'rare'),
('star', 3, 'Yıldız Yağmuru', '🌟', 60000, 'epic'),
('crown', 4, 'Kral Tacı', '👑', 200000, 'legendary'),
('castle', 4, 'Altın Kale', '🏰', 500000, 'legendary'),
('car', 4, 'Spor Araba', '🏎️', 888000, 'legendary'),
('cpheart', 5, 'CP Bağ', '💑', 33000, 'epic'),
('forever', 5, 'Sonsuz Aşk', '♾️', 131400, 'legendary'),
('galaxy', 6, 'Galaksi', '🌌', 999000, 'legendary'),
('phoenix', 6, 'Anka Kuşu', '🔥', 666000, 'legendary')
ON CONFLICT (id) DO UPDATE SET
    sekme = EXCLUDED.sekme, ad = EXCLUDED.ad, emoji = EXCLUDED.emoji,
    fiyat_elmas = EXCLUDED.fiyat_elmas, kademe = EXCLUDED.kademe, aktif = TRUE;

-- ---------------------------------------------------------------------------
-- 3) Gönderim defteri — yayıncı kazancının tek kaynağı
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hediye_gonderimleri (
    id             BIGSERIAL   PRIMARY KEY,
    gonderen_id    BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    alici_id       BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    oda_id         BIGINT      REFERENCES public.odalar(id) ON DELETE SET NULL,
    hediye_id      TEXT        NOT NULL REFERENCES public.hediye_katalogu(id),
    adet           INTEGER     NOT NULL CHECK (adet > 0),
    birim_elmas    BIGINT      NOT NULL,
    toplam_elmas   BIGINT      NOT NULL,
    kazanc_altin   BIGINT      NOT NULL,   -- alıcıya yazılan
    komisyon_altin BIGINT      NOT NULL,   -- platformda kalan
    tarih          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hediye_alici  ON public.hediye_gonderimleri (alici_id, tarih DESC);
CREATE INDEX IF NOT EXISTS idx_hediye_gonderen ON public.hediye_gonderimleri (gonderen_id, tarih DESC);
CREATE INDEX IF NOT EXISTS idx_hediye_oda ON public.hediye_gonderimleri (oda_id, tarih DESC);

ALTER TABLE public.hediye_gonderimleri ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hediye_gonderimleri FROM anon, authenticated;
GRANT SELECT ON public.hediye_gonderimleri TO authenticated;

-- Kendi gönderdiğin ve sana gelen kayıtlar. Yazma yalnızca RPC ile.
DROP POLICY IF EXISTS hediye_gonderim_select ON public.hediye_gonderimleri;
CREATE POLICY hediye_gonderim_select ON public.hediye_gonderimleri
    FOR SELECT TO authenticated
    USING (gonderen_id = public.benim_kullanici_id()
        OR alici_id = public.benim_kullanici_id()
        OR public.ben_platform_yoneticisi());

-- ---------------------------------------------------------------------------
-- 4) Hediye gönder — elması düş, kazancı yaz, deftere geç (tek işlem)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hediye_gonder(
    p_hediye_id TEXT,
    p_adet      INTEGER,
    p_alici_id  BIGINT,
    p_oda_id    BIGINT DEFAULT NULL
)
RETURNS TABLE (elmas BIGINT, altin BIGINT, kazanc BIGINT, komisyon BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben      BIGINT := public.benim_kullanici_id();
    v_hediye   public.hediye_katalogu%ROWTYPE;
    v_oran     NUMERIC;
    v_toplam   BIGINT;
    v_kazanc   BIGINT;
    v_komisyon BIGINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_adet IS NULL OR p_adet <= 0 OR p_adet > 10000 THEN
        RAISE EXCEPTION 'Geçersiz adet.';
    END IF;
    IF p_alici_id = v_ben THEN
        RAISE EXCEPTION 'Kendine hediye gönderemezsin.';
    END IF;

    SELECT * INTO v_hediye FROM public.hediye_katalogu WHERE id = p_hediye_id AND aktif;
    IF NOT FOUND THEN RAISE EXCEPTION 'Hediye bulunamadı.'; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = p_alici_id) THEN
        RAISE EXCEPTION 'Alıcı bulunamadı.';
    END IF;

    v_toplam := v_hediye.fiyat_elmas * p_adet;

    SELECT deger INTO v_oran FROM public.platform_ayarlari WHERE anahtar = 'hediye_komisyon';
    v_oran := COALESCE(v_oran, 0.30);

    -- Gönderenden elması düş (yetersizse check_violation)
    BEGIN
        PERFORM public._bakiye_uygula(v_ben, 'elmas', -v_toplam,
                                      'Hediye: ' || v_hediye.ad || ' x' || p_adet, v_ben);
    EXCEPTION WHEN check_violation THEN
        RAISE EXCEPTION 'Yetersiz elmas.';
    END;

    -- Alıcıya kazancı ALTIN olarak yaz; kalan platformda
    v_kazanc   := FLOOR(v_toplam * (1 - v_oran));
    v_komisyon := v_toplam - v_kazanc;

    PERFORM public._bakiye_uygula(p_alici_id, 'altin', v_kazanc,
                                  'Hediye kazancı: ' || v_hediye.ad, v_ben);

    INSERT INTO public.hediye_gonderimleri
        (gonderen_id, alici_id, oda_id, hediye_id, adet, birim_elmas, toplam_elmas, kazanc_altin, komisyon_altin)
    VALUES
        (v_ben, p_alici_id, p_oda_id, p_hediye_id, p_adet, v_hediye.fiyat_elmas, v_toplam, v_kazanc, v_komisyon);

    RETURN QUERY
        SELECT COALESCE(c.elmas, 0), COALESCE(c.altin, 0), v_kazanc, v_komisyon
          FROM public.cuzdan c WHERE c.kullanici_id = v_ben;
END; $$;

REVOKE ALL ON FUNCTION public.hediye_gonder(TEXT, INTEGER, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hediye_gonder(TEXT, INTEGER, BIGINT, BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Kazanç okuma — yayıncı paneli
-- ---------------------------------------------------------------------------

/** Özet: bugün / bu ay / toplam kazanç + hediye ve gönderen sayısı. */
CREATE OR REPLACE FUNCTION public.kazanc_ozeti()
RETURNS TABLE (
    bugun     BIGINT,
    bu_ay     BIGINT,
    toplam    BIGINT,
    komisyon  BIGINT,
    hediye_ay BIGINT,
    kisi_ay   BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT
        COALESCE(SUM(kazanc_altin) FILTER (WHERE tarih >= date_trunc('day', now())), 0),
        COALESCE(SUM(kazanc_altin) FILTER (WHERE tarih >= date_trunc('month', now())), 0),
        COALESCE(SUM(kazanc_altin), 0),
        COALESCE(SUM(komisyon_altin) FILTER (WHERE tarih >= date_trunc('month', now())), 0),
        COALESCE(COUNT(*) FILTER (WHERE tarih >= date_trunc('month', now())), 0),
        COALESCE(COUNT(DISTINCT gonderen_id) FILTER (WHERE tarih >= date_trunc('month', now())), 0)
      FROM public.hediye_gonderimleri
     WHERE alici_id = public.benim_kullanici_id();
$$;
REVOKE ALL ON FUNCTION public.kazanc_ozeti() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kazanc_ozeti() TO authenticated;

/** Saatlik kırılım — "hangi saatte ne kazandım". 24 satır, boş saatler 0. */
CREATE OR REPLACE FUNCTION public.kazanc_saatlik(p_gun_once INTEGER DEFAULT 0)
RETURNS TABLE (saat INTEGER, altin BIGINT, hediye BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH gun AS (
        SELECT date_trunc('day', now()) - (p_gun_once || ' days')::INTERVAL AS bas
    )
    SELECT s.saat::INTEGER,
           COALESCE(SUM(h.kazanc_altin), 0)::BIGINT,
           COALESCE(COUNT(h.id), 0)::BIGINT
      FROM generate_series(0, 23) AS s(saat)
      CROSS JOIN gun
      LEFT JOIN public.hediye_gonderimleri h
             ON h.alici_id = public.benim_kullanici_id()
            AND h.tarih >= gun.bas
            AND h.tarih <  gun.bas + INTERVAL '1 day'
            AND EXTRACT(HOUR FROM h.tarih)::INTEGER = s.saat
     GROUP BY s.saat
     ORDER BY s.saat;
$$;
REVOKE ALL ON FUNCTION public.kazanc_saatlik(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kazanc_saatlik(INTEGER) TO authenticated;

/** Günlük kırılım — son N gün (grafik). */
CREATE OR REPLACE FUNCTION public.kazanc_gunluk(p_gun INTEGER DEFAULT 7)
RETURNS TABLE (gun DATE, altin BIGINT, hediye BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT d::DATE,
           COALESCE(SUM(h.kazanc_altin), 0)::BIGINT,
           COALESCE(COUNT(h.id), 0)::BIGINT
      FROM generate_series(
               date_trunc('day', now()) - ((GREATEST(p_gun, 1) - 1) || ' days')::INTERVAL,
               date_trunc('day', now()),
               INTERVAL '1 day') AS d
      LEFT JOIN public.hediye_gonderimleri h
             ON h.alici_id = public.benim_kullanici_id()
            AND h.tarih >= d
            AND h.tarih <  d + INTERVAL '1 day'
     GROUP BY d
     ORDER BY d;
$$;
REVOKE ALL ON FUNCTION public.kazanc_gunluk(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kazanc_gunluk(INTEGER) TO authenticated;

/** Son gelen hediyeler — kimden, ne, ne kadar kazandırdı. */
CREATE OR REPLACE FUNCTION public.son_hediyelerim(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    id           BIGINT,
    gonderen     TEXT,
    gonderen_pid TEXT,
    hediye_ad    TEXT,
    emoji        TEXT,
    adet         INTEGER,
    kazanc       BIGINT,
    tarih        TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT h.id, k.kullanici_adi, k.public_id, g.ad, g.emoji, h.adet, h.kazanc_altin, h.tarih
      FROM public.hediye_gonderimleri h
      JOIN public.hediye_katalogu g     ON g.id = h.hediye_id
      JOIN public.kullanicilar k  ON k.id = h.gonderen_id
     WHERE h.alici_id = public.benim_kullanici_id()
     ORDER BY h.tarih DESC
     LIMIT GREATEST(p_limit, 1);
$$;
REVOKE ALL ON FUNCTION public.son_hediyelerim(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.son_hediyelerim(INTEGER) TO authenticated;
