-- ============================================================================
-- 070_oda_katilimcilari.sql — "Odada kim var" artık sunucuda
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 068 ve 069'dan SONRA. İdempotent.
--
-- ÖNEMLİ: `oda_katilimcilar` TEMEL ŞEMADA ZATEN VAR — bu migration onu KURMAZ.
-- Canlı yapı (yoklandı, 31 Ağustos):
--   oda_katilimcilar(kullanici_id, oda_id, session_id, giris_tarihi, last_heartbeat)
--   PRIMARY KEY (kullanici_id)   → bir kişi aynı anda TEK odada olabilir
-- Yanında `oda_stale_katilimcilari_temizle(p_esik_dakika DEFAULT 5)` da var:
--   son kalp atışı eşikten eskiyse satırı siliyor.
-- Yani sunucu taraflı oda katılımı için altyapı hazırmış ama TABLO BOŞ,
-- kimse yazmıyor ve `pg_cron` kurulu olmadığı için temizleyiciyi çağıran da yok.
--
-- NEDEN ŞİMDİ: "odada kim var" bilgisi Realtime PRESENCE ile taşınıyordu ve
-- üç oturum boyunca kararlı çalışmadı. Koltukları 068 ile tabloya taşıdık ve
-- sorun orada bitti; geriye kalan tek presence bağımlılığı bu listeydi.
-- Belirti: ağ koptuktan / arkaplandan dönünce oda boş görünüyor, kişi sayısı
-- 0 düşüyor, kullanıcı "odadaki herkes anlık görünmeli" diyor. Doğru cevap.
--
-- KALP ATIŞI: istemci odaya girince yazıyor, ~25 sn'de bir tazeliyor, çıkarken
-- siliyor. Uygulama çökerse satır kalır — bu yüzden her katılımda önce
-- temizleyici çağrılıyor (cron olmadığı için tetikleyici biziz). Eşik 2 dakika:
-- birkaç kaçan kalp atışı kimseyi düşürmesin ama hayalet de uzun kalmasın.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Yayın + okuma izni
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_oda_katilimci_oda ON public.oda_katilimcilar (oda_id);

ALTER TABLE public.oda_katilimcilar REPLICA IDENTITY FULL;
ALTER TABLE public.oda_katilimcilar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oda_katilimcilar_oku ON public.oda_katilimcilar;
CREATE POLICY oda_katilimcilar_oku ON public.oda_katilimcilar
    FOR SELECT TO authenticated USING (TRUE);

REVOKE ALL ON TABLE public.oda_katilimcilar FROM PUBLIC, anon;
-- 068 dersi: PUBLIC'ten revoke, role'e DOĞRUDAN verilmiş yetkiyi kaldırmaz.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.oda_katilimcilar FROM authenticated;
GRANT SELECT ON TABLE public.oda_katilimcilar TO authenticated;

DO $yayin$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'oda_katilimcilar'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.oda_katilimcilar;
    END IF;
END $yayin$;

-- ---------------------------------------------------------------------------
-- 2) Odaya katıl
--    PK kullanici_id olduğu için başka odadaysa satır o odaya TAŞINIR.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.odaya_katil(p_oda BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.odalar o WHERE o.id = p_oda AND NOT o.silinmis) THEN
        RAISE EXCEPTION 'Oda bulunamadı.';
    END IF;

    -- pg_cron yok; temizleyiciyi katılım anında biz tetikliyoruz. Ucuz.
    PERFORM public.oda_stale_katilimcilari_temizle(2);

    INSERT INTO public.oda_katilimcilar (kullanici_id, oda_id, giris_tarihi, last_heartbeat)
    VALUES (v_ben, p_oda, now(), now())
    ON CONFLICT (kullanici_id) DO UPDATE
        SET oda_id         = EXCLUDED.oda_id,
            giris_tarihi   = CASE WHEN public.oda_katilimcilar.oda_id = EXCLUDED.oda_id
                                  THEN public.oda_katilimcilar.giris_tarihi
                                  ELSE now() END,
            last_heartbeat = now();
END; $fn$;
REVOKE ALL ON FUNCTION public.odaya_katil(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.odaya_katil(BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Kalp atışı — "hâlâ buradayım"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oda_kalp_atisi(p_oda BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RETURN; END IF;
    UPDATE public.oda_katilimcilar
       SET last_heartbeat = now()
     WHERE kullanici_id = v_ben AND oda_id = p_oda;
    -- Satır bir şekilde silinmişse (temizleyici, çökme) geri koy.
    IF NOT FOUND THEN
        INSERT INTO public.oda_katilimcilar (kullanici_id, oda_id, giris_tarihi, last_heartbeat)
        VALUES (v_ben, p_oda, now(), now())
        ON CONFLICT (kullanici_id) DO UPDATE
            SET oda_id = EXCLUDED.oda_id, last_heartbeat = now();
    END IF;
END; $fn$;
REVOKE ALL ON FUNCTION public.oda_kalp_atisi(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_kalp_atisi(BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Odadan ayrıl
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.odadan_ayril()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RETURN; END IF;
    DELETE FROM public.oda_katilimcilar WHERE kullanici_id = v_ben;
END; $fn$;
REVOKE ALL ON FUNCTION public.odadan_ayril() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.odadan_ayril() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Odadakileri oku — isim/foto/yetki ile, en yeni giren sonda
--    Bayat satırlar okumada da eleniyor: temizleyici gecikse bile liste
--    doğru görünsün.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oda_katilimcilari_getir(p_oda BIGINT)
RETURNS TABLE (
    kullanici_id  BIGINT,
    kullanici_adi TEXT,
    profil_resmi  TEXT,
    public_id     TEXT,
    yetkili       BOOLEAN,
    giris_tarihi  TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    SELECT k.kullanici_id, u.kullanici_adi::TEXT, u.profil_resmi::TEXT,
           u.public_id::TEXT,
           (u.ekonomi_rolu::TEXT IN ('developer', 'super_admin')),
           k.giris_tarihi
      FROM public.oda_katilimcilar k
      JOIN public.kullanicilar u ON u.id = k.kullanici_id
     WHERE k.oda_id = p_oda
       AND k.last_heartbeat > now() - INTERVAL '2 minutes'
     ORDER BY k.giris_tarihi;
$fn$;
REVOKE ALL ON FUNCTION public.oda_katilimcilari_getir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_katilimcilari_getir(BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Oda listesindeki kişi sayısı da buradan
--    `odalar.aktif_katilimci_sayisi` istemcinin yazdığı bir sayıydı (057) ve
--    üç oturum boyunca hayalet oda / boş liste sorunları çıkardı. Artık
--    gerçek katılımcı tablosundan sayılıyor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oda_kisi_sayilari()
RETURNS TABLE (oda_id BIGINT, sayi INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    SELECT k.oda_id, count(*)::INTEGER
      FROM public.oda_katilimcilar k
     WHERE k.last_heartbeat > now() - INTERVAL '2 minutes'
     GROUP BY k.oda_id;
$fn$;
REVOKE ALL ON FUNCTION public.oda_kisi_sayilari() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_kisi_sayilari() TO authenticated;
