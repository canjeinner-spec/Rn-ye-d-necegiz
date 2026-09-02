-- ============================================================================
-- 069_mic_akislari.sql — Mikrofondan indirme, mikrofon sırası, davet
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 068'den SONRA. İdempotent.
--
-- NEDEN:
--   • "Mikrofondan indir" tamamen YERELDİ (`setSeats(...)`): yöneticinin
--     ekranında kişi koltuktan kalkıyor, karşı tarafta hiçbir şey olmuyordu.
--     Başkasının koltuğunu boşaltmak sunucu işi — 068'deki `koltuktan_kalk`
--     yalnız KENDİ koltuğunu boşaltıyor.
--   • "Mikrofon sırası" broadcast'te tutuluyordu: sonradan giren host
--     bekleyenleri göremiyor, bağlantı kopunca sıra siliniyor, onay
--     karşı tarafın istemcisine güveniyordu. Sıra bir DURUM, tabloya taşındı.
--   • Mikrofon yasağı (028) yalnız İSTEMCİDE kontrol ediliyordu; artık
--     `koltuga_otur` sunucuda da bakıyor.
--
-- Davet (mic_davet) bilerek broadcast olarak kalıyor: kişiye özel, anlık ve
-- kalıcılığı anlamsız bir bildirim. Kabul edildiğinde zaten `koltuga_otur`
-- çağrılıyor, yani gerçek iş yine sunucuda oluyor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Oda moderatörü müyüm? (sahip / platform yöneticisi / oda yetkilisi)
--    `oda_uyeleri.rol` TEXT ve enum değerleri: sahip, yonetici, moderator, uye
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._oda_moderatoru(p_oda BIGINT)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RETURN FALSE; END IF;
    IF public.ben_platform_yoneticisi() THEN RETURN TRUE; END IF;
    IF EXISTS (SELECT 1 FROM public.odalar o
                WHERE o.id = p_oda AND o.olusturan_id = v_ben) THEN
        RETURN TRUE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.oda_uyeleri u
         WHERE u.oda_id = p_oda AND u.kullanici_id = v_ben
           AND u.rol::TEXT IN ('sahip', 'yonetici', 'moderator'));
END; $fn$;
REVOKE ALL ON FUNCTION public._oda_moderatoru(BIGINT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Mikrofon sırası tablosu
--    Sıra bir DURUM: sonradan giren yönetici bekleyenleri görmeli, bağlantı
--    kopunca sıra kaybolmamalı. Broadcast bunu veremiyordu.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oda_mic_sirasi (
    oda_id        BIGINT      NOT NULL REFERENCES public.odalar(id) ON DELETE CASCADE,
    kullanici_id  BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    talep_tarihi  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (oda_id, kullanici_id)
);
CREATE INDEX IF NOT EXISTS idx_mic_sirasi_oda ON public.oda_mic_sirasi (oda_id, talep_tarihi);

ALTER TABLE public.oda_mic_sirasi REPLICA IDENTITY FULL;
ALTER TABLE public.oda_mic_sirasi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oda_mic_sirasi_oku ON public.oda_mic_sirasi;
CREATE POLICY oda_mic_sirasi_oku ON public.oda_mic_sirasi
    FOR SELECT TO authenticated USING (TRUE);

REVOKE ALL ON TABLE public.oda_mic_sirasi FROM PUBLIC, anon;
-- 068 dersi: PUBLIC'ten revoke, role'e DOĞRUDAN verilmiş yetkiyi kaldırmaz.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.oda_mic_sirasi FROM authenticated;
GRANT SELECT ON TABLE public.oda_mic_sirasi TO authenticated;

DO $yayin$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'oda_mic_sirasi'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.oda_mic_sirasi;
    END IF;
END $yayin$;

-- ---------------------------------------------------------------------------
-- 3) `koltuga_otur` — mikrofon yasağı artık SUNUCUDA da kontrol ediliyor
--    (068'deki sürümün üstüne yazıyor; tek eklenen blok yasak kontrolü.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.koltuga_otur(p_oda BIGINT, p_koltuk SMALLINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben     BIGINT := public.benim_kullanici_id();
    v_sahip   BIGINT;
    v_kilitli BOOLEAN;
    v_dolu    BIGINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_koltuk < 1 OR p_koltuk > 20 THEN RAISE EXCEPTION 'Geçersiz koltuk.'; END IF;

    SELECT o.olusturan_id INTO v_sahip
      FROM public.odalar o WHERE o.id = p_oda AND NOT o.silinmis;
    IF v_sahip IS NULL THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

    IF p_koltuk = 20 AND v_sahip <> v_ben THEN
        RAISE EXCEPTION 'Bu koltuk oda sahibine ait.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.oda_yasaklari y
                WHERE y.oda_id = p_oda AND y.kullanici_id = v_ben) THEN
        RAISE EXCEPTION 'Bu odada yasaklısın.';
    END IF;

    -- 069: platform mikrofon yasağı (028). Eskiden yalnız istemci bakıyordu.
    IF EXISTS (SELECT 1 FROM public.mic_yasaklari m
                WHERE m.kullanici_id = v_ben
                  AND (m.bitis IS NULL OR m.bitis > now())) THEN
        RAISE EXCEPTION 'Mikrofon yasağın var.';
    END IF;

    SELECT k.kilitli, k.kullanici_id INTO v_kilitli, v_dolu
      FROM public.oda_koltuklari k
     WHERE k.oda_id = p_oda AND k.koltuk_no = p_koltuk;

    IF COALESCE(v_kilitli, FALSE) AND v_sahip <> v_ben
       AND NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bu koltuk kilitli.';
    END IF;

    IF v_dolu IS NOT NULL AND v_dolu <> v_ben THEN
        RAISE EXCEPTION 'Koltuk dolu.';
    END IF;

    UPDATE public.oda_koltuklari
       SET kullanici_id = NULL, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND kullanici_id = v_ben AND koltuk_no <> p_koltuk;

    INSERT INTO public.oda_koltuklari (oda_id, koltuk_no, kullanici_id, susturulmus, guncellenme_tarihi)
    VALUES (p_oda, p_koltuk, v_ben, FALSE, now())
    ON CONFLICT (oda_id, koltuk_no) DO UPDATE
        SET kullanici_id       = EXCLUDED.kullanici_id,
            susturulmus        = FALSE,
            guncellenme_tarihi = now();

    -- Koltuğa oturan sırada bekliyorsa sıradan düşer. (Tablo yukarıda,
    -- bu fonksiyondan ÖNCE kuruluyor — hata yakalayıcıya gerek yok. PL/pgSQL'de
    -- yakalanan hata bloğun tamamını geri alır, yani buraya konacak bir
    -- EXCEPTION koltuğa oturmayı da iptal ederdi.)
    DELETE FROM public.oda_mic_sirasi
     WHERE oda_id = p_oda AND kullanici_id = v_ben;
END; $fn$;
REVOKE ALL ON FUNCTION public.koltuga_otur(BIGINT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuga_otur(BIGINT, SMALLINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Mikrofondan indir — hedefin koltuğunu yönetici boşaltır
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.koltuktan_indir(p_oda BIGINT, p_hedef BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben    BIGINT := public.benim_kullanici_id();
    v_koltuk SMALLINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF NOT public._oda_moderatoru(p_oda) THEN
        RAISE EXCEPTION 'Bu işlem için oda yetkilisi olmalısın.';
    END IF;

    SELECT k.koltuk_no INTO v_koltuk
      FROM public.oda_koltuklari k
     WHERE k.oda_id = p_oda AND k.kullanici_id = p_hedef;
    IF v_koltuk IS NULL THEN RETURN; END IF;   -- zaten koltukta değil

    -- Oda sahibi sahne başındaki koltuğundan indirilemez.
    IF v_koltuk = 20 THEN
        RAISE EXCEPTION 'Oda sahibi kendi koltuğundan indirilemez.';
    END IF;

    UPDATE public.oda_koltuklari
       SET kullanici_id = NULL, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND koltuk_no = v_koltuk;
END; $fn$;
REVOKE ALL ON FUNCTION public.koltuktan_indir(BIGINT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuktan_indir(BIGINT, BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Sıraya gir / sıradan çık
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_sirasina_gir(p_oda BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    IF EXISTS (SELECT 1 FROM public.mic_yasaklari m
                WHERE m.kullanici_id = v_ben
                  AND (m.bitis IS NULL OR m.bitis > now())) THEN
        RAISE EXCEPTION 'Mikrofon yasağın var.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.oda_yasaklari y
                WHERE y.oda_id = p_oda AND y.kullanici_id = v_ben) THEN
        RAISE EXCEPTION 'Bu odada yasaklısın.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.oda_koltuklari k
                WHERE k.oda_id = p_oda AND k.kullanici_id = v_ben) THEN
        RAISE EXCEPTION 'Zaten mikrofondasın.';
    END IF;

    INSERT INTO public.oda_mic_sirasi (oda_id, kullanici_id, talep_tarihi)
    VALUES (p_oda, v_ben, now())
    ON CONFLICT (oda_id, kullanici_id) DO NOTHING;
END; $fn$;
REVOKE ALL ON FUNCTION public.mic_sirasina_gir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mic_sirasina_gir(BIGINT) TO authenticated;

-- p_hedef NULL = kendi elimi indiriyorum. Başkasını sıradan çıkarmak yönetici
-- işi (sıra sayfasında yönetici bekleyeni listeden düşürebiliyor).
CREATE OR REPLACE FUNCTION public.mic_sirasindan_cik(p_oda BIGINT, p_hedef BIGINT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben  BIGINT := public.benim_kullanici_id();
    v_kime BIGINT := COALESCE(p_hedef, public.benim_kullanici_id());
BEGIN
    IF v_ben IS NULL THEN RETURN; END IF;
    IF v_kime <> v_ben AND NOT public._oda_moderatoru(p_oda) THEN
        RAISE EXCEPTION 'Bu işlem için oda yetkilisi olmalısın.';
    END IF;
    DELETE FROM public.oda_mic_sirasi WHERE oda_id = p_oda AND kullanici_id = v_kime;
END; $fn$;
REVOKE ALL ON FUNCTION public.mic_sirasindan_cik(BIGINT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mic_sirasindan_cik(BIGINT, BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Sırayı onayla — yönetici hedefi İLK BOŞ ve KİLİTSİZ koltuğa oturtur
--
-- Onay artık karşı tarafın istemcisine güvenmiyor: eskiden "onaylandın"
-- broadcast'i atılıp oturma işini hedefin telefonu yapıyordu; mesaj kaçarsa
-- kimse oturmuyordu. Şimdi oturtma işlemi sunucuda oluyor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_sirasi_onayla(p_oda BIGINT, p_hedef BIGINT)
RETURNS SMALLINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_koltuk SMALLINT;
BEGIN
    IF public.benim_kullanici_id() IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF NOT public._oda_moderatoru(p_oda) THEN
        RAISE EXCEPTION 'Bu işlem için oda yetkilisi olmalısın.';
    END IF;

    -- Hedef zaten koltuktaysa yalnız sıradan düşür.
    IF EXISTS (SELECT 1 FROM public.oda_koltuklari k
                WHERE k.oda_id = p_oda AND k.kullanici_id = p_hedef) THEN
        DELETE FROM public.oda_mic_sirasi WHERE oda_id = p_oda AND kullanici_id = p_hedef;
        RETURN NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM public.mic_yasaklari m
                WHERE m.kullanici_id = p_hedef
                  AND (m.bitis IS NULL OR m.bitis > now())) THEN
        RAISE EXCEPTION 'Bu kullanıcının mikrofon yasağı var.';
    END IF;

    SELECT MIN(k.koltuk_no) INTO v_koltuk
      FROM public.oda_koltuklari k
     WHERE k.oda_id = p_oda
       AND k.kullanici_id IS NULL
       AND NOT k.kilitli
       AND k.koltuk_no BETWEEN 1 AND 19;
    IF v_koltuk IS NULL THEN RAISE EXCEPTION 'Boş koltuk yok.'; END IF;

    UPDATE public.oda_koltuklari
       SET kullanici_id = p_hedef, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND koltuk_no = v_koltuk;

    DELETE FROM public.oda_mic_sirasi WHERE oda_id = p_oda AND kullanici_id = p_hedef;
    RETURN v_koltuk;
END; $fn$;
REVOKE ALL ON FUNCTION public.mic_sirasi_onayla(BIGINT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mic_sirasi_onayla(BIGINT, BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Sırayı oku (isim/foto ile, bekleme sırasına göre)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_sirasi_getir(p_oda BIGINT)
RETURNS TABLE (
    kullanici_id  BIGINT,
    kullanici_adi TEXT,
    profil_resmi  TEXT,
    public_id     TEXT,
    talep_tarihi  TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    SELECT s.kullanici_id, u.kullanici_adi::TEXT, u.profil_resmi::TEXT,
           u.public_id::TEXT, s.talep_tarihi
      FROM public.oda_mic_sirasi s
      JOIN public.kullanicilar u ON u.id = s.kullanici_id
     WHERE s.oda_id = p_oda
     ORDER BY s.talep_tarihi;
$fn$;
REVOKE ALL ON FUNCTION public.mic_sirasi_getir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mic_sirasi_getir(BIGINT) TO authenticated;
