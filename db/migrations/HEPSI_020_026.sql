-- ============================================================================
-- HEPSI_020_026.sql — 020..024 + 026 tek dosyada (BİRLEŞİK, idempotent)
-- ----------------------------------------------------------------------------
-- KULLANIM (Supabase SQL Editor):
--   1) ÖNCE 025_rol_enum_degerleri.sql'i TEK BAŞINA çalıştır (enum değerleri).
--   2) SONRA bu dosyayı komple yapıştırıp çalıştır.
-- Bu dosya 020,021,022,023,024,026 içeriklerinin birleşimidir; her parça
-- IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS ile yazıldığı için
-- daha önce kısmen uygulanmış bir veritabanında da güvenle tekrar çalışır.
-- Tüm ekonomi_rolu karşılaştırmaları ::text ile yapılır (22P02 imkânsız).
-- ============================================================================


-- ═══════════════════════════ [020_delete_account.sql] ═══════════════════════════

-- ============================================================================
-- 020_delete_account.sql — Hesabı kalıcı olarak silme (self-service)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003'ten SONRA (Supabase SQL Editor).
--
--   • hesabimi_sil(): oturum sahibinin kendi kullanicilar + auth.users
--     satırını siler. SECURITY DEFINER olduğu için client'ın service_role
--     anahtarına ihtiyacı yok; fonksiyon Postgres içinde auth şemasına da
--     erişebiliyor (Supabase Auth REST katmanı devre dışı, düz SQL).
--   • kullanicilar(id) referans veren tabloların büyük çoğunluğu (gönderiler,
--     yorumlar, beğeniler, arkadaşlıklar, engel, görev/kupon/özel-id vb.)
--     ON DELETE CASCADE ile tanımlı → kullanicilar satırı silinince otomatik
--     temizlenir. Bilinmeyen/cascade'siz bir FK varsa fonksiyon
--     foreign_key_violation'ı yakalayıp anlaşılır bir Türkçe hata döner
--     (tüm işlem tek transaction'da — yarım silme olmaz).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hesabimi_sil()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Oturum bulunamadı.';
    END IF;

    DELETE FROM public.kullanicilar WHERE auth_uid = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Hesap silinemedi: bazı ilişkili veriler engel oluşturuyor. Lütfen destek ile iletişime geç.';
END; $$;

REVOKE ALL ON FUNCTION public.hesabimi_sil() FROM public;
GRANT EXECUTE ON FUNCTION public.hesabimi_sil() TO authenticated;

-- ═══════════════════════════ [021_oda_uyeleri.sql] ═══════════════════════════

-- ============================================================================
-- 021_oda_uyeleri.sql — Oda üyeliği + oda içi roller (sahip / yardimci / uye)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003'ten SONRA (Supabase SQL Editor).
--
--   • oda_uyeleri: kalıcı üyelik grafiği. Oda kurulunca kuran otomatik
--     'sahip' olur (trigger); mevcut odalar backfill edilir.
--   • Herkes üye listesini okuyabilir; kendi adına yalnızca 'uye' olarak
--     katılabilir; sahip odadan ayrılamaz (odayı silmek ayrı iş).
--   • Rol atama ve üye çıkarma SECURITY DEFINER RPC'lerle: yetki kontrolü
--     fonksiyon içinde — client'a service_role asla gerekmez.
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.oda_uyeleri (
    oda_id          BIGINT      NOT NULL REFERENCES public.odalar(id) ON DELETE CASCADE,
    kullanici_id    BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    rol             TEXT        NOT NULL DEFAULT 'uye' CHECK (rol IN ('sahip', 'yardimci', 'uye')),
    katilma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (oda_id, kullanici_id)
);
CREATE INDEX IF NOT EXISTS idx_oda_uye_kullanici ON public.oda_uyeleri (kullanici_id);

ALTER TABLE public.oda_uyeleri ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oda_uyeleri FROM anon, authenticated;
GRANT SELECT (oda_id, kullanici_id, rol, katilma_tarihi) ON public.oda_uyeleri TO authenticated;
GRANT INSERT (oda_id, kullanici_id, rol) ON public.oda_uyeleri TO authenticated;
GRANT DELETE ON public.oda_uyeleri TO authenticated;

-- Üye listeleri herkese açık (sayaç + rol rozetleri için)
DROP POLICY IF EXISTS oda_uye_select ON public.oda_uyeleri;
CREATE POLICY oda_uye_select ON public.oda_uyeleri
    FOR SELECT TO authenticated USING (TRUE);

-- Kendi adına, yalnızca 'uye' olarak katıl
DROP POLICY IF EXISTS oda_uye_insert ON public.oda_uyeleri;
CREATE POLICY oda_uye_insert ON public.oda_uyeleri
    FOR INSERT TO authenticated
    WITH CHECK (kullanici_id = public.benim_kullanici_id() AND rol = 'uye');

-- Kendi üyeliğinden ayrıl (sahip ayrılamaz)
DROP POLICY IF EXISTS oda_uye_delete ON public.oda_uyeleri;
CREATE POLICY oda_uye_delete ON public.oda_uyeleri
    FOR DELETE TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() AND rol <> 'sahip');

-- ---- Oda kurulunca kuran 'sahip' olur -----------------------------------
CREATE OR REPLACE FUNCTION public.oda_sahibi_ekle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NEW.olusturan_id IS NOT NULL THEN
        INSERT INTO public.oda_uyeleri (oda_id, kullanici_id, rol)
        VALUES (NEW.id, NEW.olusturan_id, 'sahip')
        ON CONFLICT (oda_id, kullanici_id) DO UPDATE SET rol = 'sahip';
    END IF;
    RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_oda_sahibi ON public.odalar;
CREATE TRIGGER trg_oda_sahibi AFTER INSERT ON public.odalar
    FOR EACH ROW EXECUTE FUNCTION public.oda_sahibi_ekle();

-- Mevcut odaların sahiplerini backfill et
INSERT INTO public.oda_uyeleri (oda_id, kullanici_id, rol)
SELECT o.id, o.olusturan_id, 'sahip'
  FROM public.odalar o
 WHERE o.olusturan_id IS NOT NULL
ON CONFLICT (oda_id, kullanici_id) DO UPDATE SET rol = 'sahip';

-- ---- Yardımcı: platform yöneticisi mi? -----------------------------------
-- Not: ekonomi_rolu bir ENUM — ::text ile karşılaştırıyoruz ki enum'da
-- olmayan bir değer literal olarak parse hatası vermesin (22P02).
CREATE OR REPLACE FUNCTION public.ben_platform_yoneticisi()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.kullanicilar
         WHERE id = public.benim_kullanici_id()
           AND ekonomi_rolu::text IN ('developer', 'super_admin')
    );
$$;

-- ---- RPC: rol ata (yalnızca sahip veya platform yöneticisi) ---------------
CREATE OR REPLACE FUNCTION public.oda_rol_ata(p_oda_id BIGINT, p_hedef BIGINT, p_rol TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT;
BEGIN
    IF p_rol NOT IN ('yardimci', 'uye') THEN
        RAISE EXCEPTION 'Geçersiz rol.';
    END IF;
    SELECT rol INTO v_benim FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = public.benim_kullanici_id();
    IF v_benim IS DISTINCT FROM 'sahip' AND NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Rol atamak için oda sahibi olmalısın.';
    END IF;
    UPDATE public.oda_uyeleri SET rol = p_rol
     WHERE oda_id = p_oda_id AND kullanici_id = p_hedef AND rol <> 'sahip';
END; $$;
REVOKE ALL ON FUNCTION public.oda_rol_ata(BIGINT, BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_rol_ata(BIGINT, BIGINT, TEXT) TO authenticated;

-- ---- RPC: üye çıkar (sahip herkesi; yardımcı yalnızca 'uye'yi) -------------
CREATE OR REPLACE FUNCTION public.oda_uye_cikar(p_oda_id BIGINT, p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT; v_hedef TEXT;
BEGIN
    SELECT rol INTO v_benim FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = public.benim_kullanici_id();
    SELECT rol INTO v_hedef FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
    IF v_hedef IS NULL THEN RETURN; END IF;
    IF v_hedef = 'sahip' THEN
        RAISE EXCEPTION 'Oda sahibi çıkarılamaz.';
    END IF;
    IF public.ben_platform_yoneticisi()
       OR v_benim = 'sahip'
       OR (v_benim = 'yardimci' AND v_hedef = 'uye') THEN
        DELETE FROM public.oda_uyeleri WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
    ELSE
        RAISE EXCEPTION 'Bu üyeyi çıkarma yetkin yok.';
    END IF;
END; $$;
REVOKE ALL ON FUNCTION public.oda_uye_cikar(BIGINT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_uye_cikar(BIGINT, BIGINT) TO authenticated;

-- ═══════════════════════════ [022_oda_yasaklari.sql] ═══════════════════════════

-- ============================================================================
-- 022_oda_yasaklari.sql — Kalıcı oda yasaklama (odadan atılanlar)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • oda_yasaklari: kim, hangi odadan, kim tarafından, ne zaman yasaklandı.
--   • Okuma herkese açık (kendi yasağını görüp giriş engeli uygulanabilsin,
--     oda yönetimi listeyi gösterebilsin diye).
--   • Yazma YALNIZCA RPC ile: oda_yasakla / oda_yasak_kaldir — yetki kontrolü
--     fonksiyon içinde (sahip herkesi, yardımcı yalnızca üyeyi yasaklar).
--     Yasaklanınca üyelik de düşer.
-- benim_kullanici_id() 003'te, ben_platform_yoneticisi() 021'de tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.oda_yasaklari (
    oda_id            BIGINT      NOT NULL REFERENCES public.odalar(id) ON DELETE CASCADE,
    kullanici_id      BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    yasaklayan_id     BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    yasaklanma_tarihi TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (oda_id, kullanici_id)
);
CREATE INDEX IF NOT EXISTS idx_oda_yasak_kullanici ON public.oda_yasaklari (kullanici_id);

ALTER TABLE public.oda_yasaklari ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oda_yasaklari FROM anon, authenticated;
GRANT SELECT (oda_id, kullanici_id, yasaklayan_id, yasaklanma_tarihi) ON public.oda_yasaklari TO authenticated;

DROP POLICY IF EXISTS oda_yasak_select ON public.oda_yasaklari;
CREATE POLICY oda_yasak_select ON public.oda_yasaklari
    FOR SELECT TO authenticated USING (TRUE);

-- ---- RPC: yasakla (üyeliği de düşürür) ------------------------------------
CREATE OR REPLACE FUNCTION public.oda_yasakla(p_oda_id BIGINT, p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT; v_hedef TEXT;
BEGIN
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendini yasaklayamazsın.';
    END IF;
    SELECT rol INTO v_benim FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = public.benim_kullanici_id();
    SELECT rol INTO v_hedef FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
    IF v_hedef = 'sahip' THEN
        RAISE EXCEPTION 'Oda sahibi yasaklanamaz.';
    END IF;
    IF NOT (public.ben_platform_yoneticisi()
            OR v_benim = 'sahip'
            OR (v_benim = 'yardimci' AND COALESCE(v_hedef, 'uye') = 'uye')) THEN
        RAISE EXCEPTION 'Bu kullanıcıyı yasaklama yetkin yok.';
    END IF;
    INSERT INTO public.oda_yasaklari (oda_id, kullanici_id, yasaklayan_id)
    VALUES (p_oda_id, p_hedef, public.benim_kullanici_id())
    ON CONFLICT (oda_id, kullanici_id) DO NOTHING;
    DELETE FROM public.oda_uyeleri WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.oda_yasakla(BIGINT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_yasakla(BIGINT, BIGINT) TO authenticated;

-- ---- RPC: yasağı kaldır -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.oda_yasak_kaldir(p_oda_id BIGINT, p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT;
BEGIN
    SELECT rol INTO v_benim FROM public.oda_uyeleri
     WHERE oda_id = p_oda_id AND kullanici_id = public.benim_kullanici_id();
    IF NOT (public.ben_platform_yoneticisi() OR v_benim IN ('sahip', 'yardimci')) THEN
        RAISE EXCEPTION 'Yasak kaldırma yetkin yok.';
    END IF;
    DELETE FROM public.oda_yasaklari WHERE oda_id = p_oda_id AND kullanici_id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.oda_yasak_kaldir(BIGINT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_yasak_kaldir(BIGINT, BIGINT) TO authenticated;

-- ---- Yasaklı kullanıcı tekrar üye olamasın (insert policy güncelle) --------
DROP POLICY IF EXISTS oda_uye_insert ON public.oda_uyeleri;
CREATE POLICY oda_uye_insert ON public.oda_uyeleri
    FOR INSERT TO authenticated
    WITH CHECK (
        kullanici_id = public.benim_kullanici_id()
        AND rol = 'uye'
        AND NOT EXISTS (
            SELECT 1 FROM public.oda_yasaklari y
             WHERE y.oda_id = oda_uyeleri.oda_id
               AND y.kullanici_id = public.benim_kullanici_id()
        )
    );

-- ═══════════════════════════ [023_raporlar.sql] ═══════════════════════════

-- ============================================================================
-- 023_raporlar.sql — Kullanıcı / oda raporları (şikayet kaydı)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • raporlar: kim, neyi (kullanıcı|oda), neden, opsiyonel detayla raporladı.
--   • Herkes kendi adına rapor açar; kendi raporlarını görür.
--   • Platform yöneticileri (developer/super_admin) tüm raporları görür ve
--     durumunu günceller (bekliyor → incelendi) — in-app yönetim ekranı için.
-- benim_kullanici_id() 003'te, ben_platform_yoneticisi() 021'de tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.raporlar (
    id                  BIGSERIAL   PRIMARY KEY,
    tip                 TEXT        NOT NULL CHECK (tip IN ('kullanici', 'oda')),
    raporlayan_id       BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    hedef_kullanici_id  BIGINT      REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    hedef_oda_id        BIGINT      REFERENCES public.odalar(id) ON DELETE CASCADE,
    neden               TEXT        NOT NULL,
    detay               TEXT,
    durum               TEXT        NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor', 'incelendi')),
    olusturulma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rapor_hedef_tutarli CHECK (
        (tip = 'kullanici' AND hedef_kullanici_id IS NOT NULL) OR
        (tip = 'oda'       AND hedef_oda_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_rapor_durum ON public.raporlar (durum, id DESC);

ALTER TABLE public.raporlar ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.raporlar FROM anon, authenticated;
GRANT SELECT ON public.raporlar TO authenticated;
GRANT INSERT (tip, raporlayan_id, hedef_kullanici_id, hedef_oda_id, neden, detay) ON public.raporlar TO authenticated;
GRANT UPDATE (durum) ON public.raporlar TO authenticated;

-- Kendi raporların + yöneticiler hepsini görür
DROP POLICY IF EXISTS rapor_select ON public.raporlar;
CREATE POLICY rapor_select ON public.raporlar
    FOR SELECT TO authenticated
    USING (raporlayan_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

-- Yalnızca kendi adına rapor aç
DROP POLICY IF EXISTS rapor_insert ON public.raporlar;
CREATE POLICY rapor_insert ON public.raporlar
    FOR INSERT TO authenticated
    WITH CHECK (raporlayan_id = public.benim_kullanici_id());

-- Durumu yalnızca yönetici günceller
DROP POLICY IF EXISTS rapor_update ON public.raporlar;
CREATE POLICY rapor_update ON public.raporlar
    FOR UPDATE TO authenticated
    USING (public.ben_platform_yoneticisi())
    WITH CHECK (public.ben_platform_yoneticisi());

-- ═══════════════════════════ [024_platform_rol.sql] ═══════════════════════════

-- ============================================================================
-- 024_platform_rol.sql — Platform rolü atama (yalnızca super_admin)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • platform_rol_ata: super_admin başka bir kullanıcıya 'user' |
--     'developer' | 'super_admin' rolü verir. Kendi rolünü değiştiremez
--     (yanlışlıkla kendini kilitlemesin). service_role client'a gerekmez.
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.platform_rol_ata(p_hedef BIGINT, p_rol TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_benim TEXT;
BEGIN
    -- ekonomi_rolu bir ENUM: değeri katalogdan doğrula (025 ile eklenmiş olmalı)
    IF p_rol NOT IN ('user', 'developer', 'super_admin')
       OR NOT EXISTS (
           SELECT 1 FROM pg_enum e
             JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'ekonomi_rolu' AND e.enumlabel = p_rol
       ) THEN
        RAISE EXCEPTION 'Geçersiz rol: % (025_rol_enum_degerleri.sql çalıştırıldı mı?)', p_rol;
    END IF;
    SELECT ekonomi_rolu::text INTO v_benim FROM public.kullanicilar
     WHERE id = public.benim_kullanici_id();
    IF v_benim IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Rol atamak için süper yönetici olmalısın.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendi rolünü değiştiremezsin.';
    END IF;
    UPDATE public.kullanicilar SET ekonomi_rolu = p_rol::public.ekonomi_rolu WHERE id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.platform_rol_ata(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.platform_rol_ata(BIGINT, TEXT) TO authenticated;

-- ═══════════════════════════ [026_xp.sql] ═══════════════════════════

-- ============================================================================
-- 026_xp.sql — Seviye/XP sistemi (deneyim kazanma + seviye güncelleme)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • xp_gunluk: kaynak başına günlük tavan takibi (client erişimi YOK).
--   • xp_ekle(kaynak): puan yazar, tavanı uygular, seviyeler tablosundan
--     seviye_id'yi günceller. Dönen değer: gerçekten kazanılan puan.
--       gunluk_giris → 20 puan (günde 1 kez)
--       oda_katilim  → 10 puan (günde 1 kez)
--       oda_mesaj    →  2 puan (günde en çok 40 = 20 mesaj)
--   • seviyeler tablosu client'a okunur yapılır (referans verisi) ve boşsa
--     basit eğriyle seed edilir (LV n eşiği = 100·(n−1)², n=1..30).
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.xp_gunluk (
    kullanici_id BIGINT NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    gun          DATE   NOT NULL DEFAULT CURRENT_DATE,
    kaynak       TEXT   NOT NULL,
    miktar       INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (kullanici_id, gun, kaynak)
);
ALTER TABLE public.xp_gunluk ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_gunluk FROM anon, authenticated; -- yalnızca RPC içi

-- ---- seviyeler: okunabilir referans verisi + boşsa seed ---------------------
DO $$
BEGIN
    IF to_regclass('public.seviyeler') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT ON public.seviyeler TO authenticated';
        EXECUTE 'ALTER TABLE public.seviyeler ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS seviyeler_select ON public.seviyeler';
        EXECUTE 'CREATE POLICY seviyeler_select ON public.seviyeler FOR SELECT TO authenticated USING (TRUE)';
        -- Boşsa basit eğriyle doldur (kolonlar uymazsa sessizce geç)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM public.seviyeler) THEN
                INSERT INTO public.seviyeler (id, ad, minimum_deneyim_puani)
                SELECT n, 'LV ' || n, 100 * (n - 1) * (n - 1)
                  FROM generate_series(1, 30) AS n;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'seviyeler seed atlandı: %', SQLERRM;
        END;
    END IF;
END $$;

-- ---- RPC: xp_ekle -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.xp_ekle(p_kaynak TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_uid    BIGINT := public.benim_kullanici_id();
    v_puan   INT;
    v_tavan  INT;
    v_onceki INT;
    v_delta  INT;
    v_xp     BIGINT;
BEGIN
    IF v_uid IS NULL THEN RETURN 0; END IF;

    CASE p_kaynak
        WHEN 'gunluk_giris' THEN v_puan := 20; v_tavan := 20;
        WHEN 'oda_katilim'  THEN v_puan := 10; v_tavan := 10;
        WHEN 'oda_mesaj'    THEN v_puan := 2;  v_tavan := 40;
        ELSE RETURN 0;
    END CASE;

    -- Günlük tavan: upsert edip gerçek artışı (delta) hesapla
    INSERT INTO public.xp_gunluk (kullanici_id, gun, kaynak, miktar)
    VALUES (v_uid, CURRENT_DATE, p_kaynak, 0)
    ON CONFLICT (kullanici_id, gun, kaynak) DO NOTHING;

    SELECT miktar INTO v_onceki FROM public.xp_gunluk
     WHERE kullanici_id = v_uid AND gun = CURRENT_DATE AND kaynak = p_kaynak
     FOR UPDATE;

    v_delta := LEAST(v_tavan, v_onceki + v_puan) - v_onceki;
    IF v_delta <= 0 THEN RETURN 0; END IF;

    UPDATE public.xp_gunluk SET miktar = v_onceki + v_delta
     WHERE kullanici_id = v_uid AND gun = CURRENT_DATE AND kaynak = p_kaynak;

    UPDATE public.kullanicilar
       SET deneyim_puani = COALESCE(deneyim_puani, 0) + v_delta
     WHERE id = v_uid
     RETURNING deneyim_puani INTO v_xp;

    -- Seviyeyi eşik tablosundan güncelle (satır yoksa dokunma — FK-güvenli)
    IF to_regclass('public.seviyeler') IS NOT NULL THEN
        UPDATE public.kullanicilar k
           SET seviye_id = s.id
          FROM (
                SELECT id FROM public.seviyeler
                 WHERE minimum_deneyim_puani <= v_xp
                 ORDER BY minimum_deneyim_puani DESC
                 LIMIT 1
               ) s
         WHERE k.id = v_uid;
    END IF;

    RETURN v_delta;
END; $$;
REVOKE ALL ON FUNCTION public.xp_ekle(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.xp_ekle(TEXT) TO authenticated;
