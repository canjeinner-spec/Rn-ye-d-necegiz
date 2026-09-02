-- ============================================================================
-- 068_oda_koltuklari.sql — Koltuk / mikrofon / kilit artık VERİTABANINDAN
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 022 ve 065'ten SONRA. İdempotent.
--
-- ÖNEMLİ: `oda_koltuklari` TEMEL ŞEMADA ZATEN VAR — bu migration onu KURMAZ,
-- yalnızca üstüne RPC + yayın + politika ekler. (İlk taslakta tabloyu yeniden
-- kurmaya çalışmıştım; `CREATE TABLE IF NOT EXISTS` sessizce atlanacak ve
-- RPC'ler olmayan sütuna yazıp 42703 ile patlayacaktı — 058'deki `hediyeler`
-- hatasının aynısı. Canlı şema yoklandı, aşağısı gerçek yapıya göre yazıldı.)
--
-- GERÇEK YAPI (canlı veritabanından, 31 Ağustos):
--   oda_koltuklari(oda_id, koltuk_no, kullanici_id, kilitli, susturulmus,
--                  guncellenme_tarihi)
--   PRIMARY KEY (oda_id, koltuk_no)
--   UNIQUE (oda_id, kullanici_id)          → bir kişi odada tek koltukta
--   CHECK (koltuk_no BETWEEN 1 AND 20)     → koltuklar 1'DEN başlıyor, 0 yok
--   Trigger `trig_oda_koltuk_olustur` oda kurulunca 1..koltuk_sayisi satırını
--   kendisi açıyor; bizim satır yaratmamız gerekmiyor.
--
-- İSTEMCİ EŞLEMESİ: uygulamada koltuklar 0..7 indeksli ve oda sahibinin
-- koltuğu -1. Dönüşüm repo katmanında yapılıyor (roomsRepo):
--   istemci 0..7  <->  koltuk_no 1..8
--   istemci -1    <->  koltuk_no 20 (SAHIP_KOLTUK_NO)
-- 20 seçildi çünkü CHECK'in üst sınırı o ve trigger'ın açtığı aralığa
-- (1..koltuk_sayisi, pratikte 8) hiç girmiyor.
--
-- NEDEN BU İŞ YAPILIYOR: kim nerede oturuyor / mikrofonu açık mı / hangi
-- koltuk kilitli bilgisi Realtime PRESENCE ile taşınıyordu ve üç oturum
-- boyunca kararlı çalışmadı (aynı anahtarda birden çok kayıt, sırası garanti
-- değil, arkaplanda kayıt asılı kalıyor). Broadcast'e taşımak hızlandırdı ama
-- kararlılığı çözmedi: kaçan olayın telafisi yok. Tabloda durum kalıcı —
-- kaçan olay bir sonraki okumada zaten doğru geliyor. Kullanıcının ölçtüğü
-- tek kararlı taşıyıcı `postgres_changes` (oda listesi 065'ten beri onunla
-- anlık çalışıyor).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Yayın + okuma izni
--
-- Tablo realtime yayınında DEĞİLDİ (yoklandı) ve üzerinde hiç RLS politikası
-- yoktu. Yazma yalnız aşağıdaki SECURITY DEFINER fonksiyonlarla olacak;
-- doğrudan INSERT/UPDATE için politika bilerek tanımlanmıyor.
-- ---------------------------------------------------------------------------
ALTER TABLE public.oda_koltuklari REPLICA IDENTITY FULL;
ALTER TABLE public.oda_koltuklari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oda_koltuklari_oku ON public.oda_koltuklari;
CREATE POLICY oda_koltuklari_oku ON public.oda_koltuklari
    FOR SELECT TO authenticated USING (TRUE);

REVOKE ALL ON TABLE public.oda_koltuklari FROM PUBLIC, anon;
-- DİKKAT: `REVOKE ... FROM PUBLIC` role'e DOĞRUDAN verilmiş yetkileri
-- kaldırmaz. Bu tabloda `authenticated` INSERT/UPDATE/DELETE'i doğrudan
-- almıştı (canlıda yoklandı), o yüzden ayrıca geri alınıyor. Yazma yalnız
-- SECURITY DEFINER fonksiyonlarla olmalı; RLS zaten engelliyor ama grant'ın
-- da kapalı olması gerekiyor (biri ileride politika eklerse kapı açılmasın).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON TABLE public.oda_koltuklari FROM authenticated;
GRANT SELECT ON TABLE public.oda_koltuklari TO authenticated;

DO $yayin$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'oda_koltuklari'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.oda_koltuklari;
    END IF;
END $yayin$;

-- ---------------------------------------------------------------------------
-- 2) Koltuğa otur
--    p_koltuk: 1..20 (20 = oda sahibinin koltuğu). Dönüşümü istemci yapıyor.
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

    -- 20 numaralı koltuk sahne başı: yalnızca oda sahibinin.
    IF p_koltuk = 20 AND v_sahip <> v_ben THEN
        RAISE EXCEPTION 'Bu koltuk oda sahibine ait.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.oda_yasaklari y
                WHERE y.oda_id = p_oda AND y.kullanici_id = v_ben) THEN
        RAISE EXCEPTION 'Bu odada yasaklısın.';
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

    -- UNIQUE (oda_id, kullanici_id) var: yeni koltuğa yazmadan ÖNCE eskisini
    -- boşaltmak zorundayız, yoksa benzersizlik ihlali alırız.
    UPDATE public.oda_koltuklari
       SET kullanici_id = NULL, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND kullanici_id = v_ben AND koltuk_no <> p_koltuk;

    -- Satır trigger'la zaten açılmış olabilir (1..koltuk_sayisi); sahne başı
    -- koltuğu (20) ise ilk oturuşta yaratılıyor.
    INSERT INTO public.oda_koltuklari (oda_id, koltuk_no, kullanici_id, susturulmus, guncellenme_tarihi)
    VALUES (p_oda, p_koltuk, v_ben, FALSE, now())
    ON CONFLICT (oda_id, koltuk_no) DO UPDATE
        SET kullanici_id       = EXCLUDED.kullanici_id,
            susturulmus        = FALSE,
            guncellenme_tarihi = now();
END; $fn$;
REVOKE ALL ON FUNCTION public.koltuga_otur(BIGINT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuga_otur(BIGINT, SMALLINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Koltuktan kalk (odadan çıkarken ve otomatik düşerken de çağrılıyor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.koltuktan_kalk(p_oda BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RETURN; END IF;
    -- Sahne başı koltuğu (20) satırı ilk oturuşta yaratıldığı için siliniyor;
    -- trigger'ın açtığı 1..N satırları KALIYOR, sadece boşaltılıyor.
    DELETE FROM public.oda_koltuklari
     WHERE oda_id = p_oda AND kullanici_id = v_ben AND koltuk_no = 20;
    UPDATE public.oda_koltuklari
       SET kullanici_id = NULL, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND kullanici_id = v_ben;
END; $fn$;
REVOKE ALL ON FUNCTION public.koltuktan_kalk(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuktan_kalk(BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Mikrofonu aç/kapat
--    Sütun `susturulmus`, yani mantık TERS: mikrofon açık = susturulmus FALSE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.koltuk_mic(p_oda BIGINT, p_acik BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    UPDATE public.oda_koltuklari
       SET susturulmus = NOT COALESCE(p_acik, TRUE), guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND kullanici_id = v_ben;
END; $fn$;
REVOKE ALL ON FUNCTION public.koltuk_mic(BIGINT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuk_mic(BIGINT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Koltuk kilitle / aç — yalnız oda sahibi ya da platform yöneticisi
--    Kilitlenen koltukta oturan varsa indiriliyor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.koltuk_kilit(p_oda BIGINT, p_koltuk SMALLINT, p_kilit BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben   BIGINT := public.benim_kullanici_id();
    v_sahip BIGINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_koltuk < 1 OR p_koltuk > 19 THEN RAISE EXCEPTION 'Geçersiz koltuk.'; END IF;

    SELECT o.olusturan_id INTO v_sahip FROM public.odalar o WHERE o.id = p_oda;
    IF v_sahip IS NULL THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;
    IF v_sahip <> v_ben AND NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Koltuk kilidi oda sahibinin yetkisinde.';
    END IF;

    INSERT INTO public.oda_koltuklari (oda_id, koltuk_no, kilitli, guncellenme_tarihi)
    VALUES (p_oda, p_koltuk, COALESCE(p_kilit, FALSE), now())
    ON CONFLICT (oda_id, koltuk_no) DO UPDATE
        SET kilitli            = COALESCE(p_kilit, FALSE),
            kullanici_id       = CASE WHEN COALESCE(p_kilit, FALSE) THEN NULL
                                      ELSE public.oda_koltuklari.kullanici_id END,
            guncellenme_tarihi = now();
END; $fn$;
REVOKE ALL ON FUNCTION public.koltuk_kilit(BIGINT, SMALLINT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuk_kilit(BIGINT, SMALLINT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Odanın koltuk tablosu — isim/foto ile tek çağrıda
--    `koltuk_no` HAM olarak dönüyor (1..20); 0 tabanına çevirme istemcide.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.oda_koltuklari_getir(p_oda BIGINT)
RETURNS TABLE (
    koltuk_no     SMALLINT,
    kullanici_id  BIGINT,
    susturulmus   BOOLEAN,
    kilitli       BOOLEAN,
    kullanici_adi TEXT,
    profil_resmi  TEXT,
    public_id     TEXT,
    yetkili       BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    SELECT k.koltuk_no, k.kullanici_id, k.susturulmus, k.kilitli,
           u.kullanici_adi::TEXT, u.profil_resmi::TEXT, u.public_id::TEXT,
           (u.ekonomi_rolu::TEXT IN ('developer', 'super_admin'))
      FROM public.oda_koltuklari k
      LEFT JOIN public.kullanicilar u ON u.id = k.kullanici_id
     WHERE k.oda_id = p_oda
     ORDER BY k.koltuk_no;
$fn$;
REVOKE ALL ON FUNCTION public.oda_koltuklari_getir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_koltuklari_getir(BIGINT) TO authenticated;

-- ============================================================================
-- NOT — KULLANILMAYAN ALTYAPI (ileride):
-- `oda_katilimcilar` (kullanici_id PK, oda_id, session_id, last_heartbeat) ve
-- `oda_stale_katilimcilari_temizle(p_esik_dakika DEFAULT 5)` temel şemada var
-- ama tablo BOŞ, kimse yazmıyor ve `pg_cron` kurulu olmadığı için temizleyiciyi
-- çağıran da yok. "Odada kim var" sorusunun doğru cevabı burası: istemci kalp
-- atışı yazar, temizleyici düşenleri siler, oda listesi de sayacı oradan alır.
-- Bugünkü istemci-yazan `aktif_katilimci_sayisi` sayacını ve presence'ı
-- tamamen aradan çıkarır. Ayrı bir iş olarak planlandı.
-- ============================================================================
