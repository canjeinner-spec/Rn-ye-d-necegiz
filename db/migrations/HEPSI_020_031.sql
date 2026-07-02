-- ============================================================================
-- HEPSI_020_031.sql — 020..024 + 026..031 tek dosyada (BİRLEŞİK, idempotent)
-- ----------------------------------------------------------------------------
-- KULLANIM (Supabase SQL Editor):
--   1) ÖNCE 025_rol_enum_degerleri.sql'i TEK BAŞINA çalıştır (enum değerleri).
--   2) SONRA bu dosyayı komple yapıştırıp çalıştır.
-- İçerik: hesap silme, oda üyeliği/rolleri, kalıcı oda yasağı, şikayet
-- (sikayetler), platform rol atama, XP/seviye, cüzdan (elmas+altın), mic
-- yasağı, admin kullanıcı işlemleri (bakiye/mic/ID/şifre), şikayet katılımcı
-- snapshot'ı, yönetici gönderi silme. Her parça idempotent (IF NOT EXISTS /
-- OR REPLACE / DROP POLICY IF EXISTS); tüm ekonomi_rolu karşılaştırmaları
-- ::text (22P02 imkânsız). Şikayet tablosu "sikayetler" (v7 "raporlar" ile
-- çakışmaz).
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
-- 023_raporlar.sql — Kullanıcı / oda şikayet kayıtları (tablo: sikayetler)
-- NOT: v7 şemasında "raporlar" adında farklı yapıda bir tablo zaten var —
-- çakışmamak için bizim tablo "sikayetler" adını kullanır.
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
--   • sikayetler: kim, neyi (kullanıcı|oda), neden, opsiyonel detayla raporladı.
--   • Herkes kendi adına rapor açar; kendi raporlarını görür.
--   • Platform yöneticileri (developer/super_admin) tüm raporları görür ve
--     durumunu günceller (bekliyor → incelendi) — in-app yönetim ekranı için.
-- benim_kullanici_id() 003'te, ben_platform_yoneticisi() 021'de tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sikayetler (
    id                  BIGSERIAL   PRIMARY KEY,
    tip                 TEXT        NOT NULL CHECK (tip IN ('kullanici', 'oda')),
    raporlayan_id       BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    hedef_kullanici_id  BIGINT      REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    hedef_oda_id        BIGINT      REFERENCES public.odalar(id) ON DELETE CASCADE,
    neden               TEXT        NOT NULL,
    detay               TEXT,
    durum               TEXT        NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor', 'incelendi')),
    olusturulma_tarihi  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sikayet_hedef_tutarli CHECK (
        (tip = 'kullanici' AND hedef_kullanici_id IS NOT NULL) OR
        (tip = 'oda'       AND hedef_oda_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_sikayet_durum ON public.sikayetler (durum, id DESC);

ALTER TABLE public.sikayetler ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sikayetler FROM anon, authenticated;
GRANT SELECT ON public.sikayetler TO authenticated;
GRANT INSERT (tip, raporlayan_id, hedef_kullanici_id, hedef_oda_id, neden, detay) ON public.sikayetler TO authenticated;
GRANT UPDATE (durum) ON public.sikayetler TO authenticated;

-- Kendi raporların + yöneticiler hepsini görür
DROP POLICY IF EXISTS sikayet_select ON public.sikayetler;
CREATE POLICY sikayet_select ON public.sikayetler
    FOR SELECT TO authenticated
    USING (raporlayan_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

-- Yalnızca kendi adına rapor aç
DROP POLICY IF EXISTS sikayet_insert ON public.sikayetler;
CREATE POLICY sikayet_insert ON public.sikayetler
    FOR INSERT TO authenticated
    WITH CHECK (raporlayan_id = public.benim_kullanici_id());

-- Durumu yalnızca yönetici günceller
DROP POLICY IF EXISTS sikayet_update ON public.sikayetler;
CREATE POLICY sikayet_update ON public.sikayetler
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

-- ═══════════════════════════ [027_cuzdan.sql] ═══════════════════════════

-- ============================================================================
-- 027_cuzdan.sql — Cüzdan (elmas + altın) gerçek bakiye + işlem defteri
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
-- Kendi temiz cüzdanımız (schema_v7'nin cuzdanlar/wallet_ledger tabloları
-- repo'da tanımsız → dokunmuyoruz, dormant kalır). Bundan sonra bakiye
-- kaynağı BURASI.
--   • cuzdan: kullanıcı başına elmas + altın bakiyesi (herkes kendi okur).
--   • cuzdan_hareketleri: işlem defteri (kendi geçmişini okur).
--   • bakiye_ekle: YÖNETİCİ (developer/super_admin) ver/al.
--   • bakiye_transfer: KULLANICI → kullanıcı gönderim (tam ekonomi).
--   • benim_bakiyem: kendi bakiyeni döndürür.
-- Gerçek parayla elmas SATIN ALMA (IAP) bu dosyada YOK — mağaza gerektirir.
-- benim_kullanici_id() 003'te, ben_platform_yoneticisi() 021'de tanımlı.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cuzdan (
    kullanici_id BIGINT      PRIMARY KEY REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    elmas        BIGINT      NOT NULL DEFAULT 0 CHECK (elmas >= 0),
    altin        BIGINT      NOT NULL DEFAULT 0 CHECK (altin >= 0),
    guncelleme   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cuzdan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cuzdan FROM anon, authenticated;
GRANT SELECT (kullanici_id, elmas, altin, guncelleme) ON public.cuzdan TO authenticated;

DROP POLICY IF EXISTS cuzdan_select ON public.cuzdan;
CREATE POLICY cuzdan_select ON public.cuzdan
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

CREATE TABLE IF NOT EXISTS public.cuzdan_hareketleri (
    id           BIGSERIAL   PRIMARY KEY,
    kullanici_id BIGINT      NOT NULL REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    varlik       TEXT        NOT NULL CHECK (varlik IN ('elmas', 'altin')),
    miktar       BIGINT      NOT NULL, -- +/-
    sebep        TEXT,
    yapan_id     BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    tarih        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cuzdan_hareket_kul ON public.cuzdan_hareketleri (kullanici_id, id DESC);
ALTER TABLE public.cuzdan_hareketleri ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cuzdan_hareketleri FROM anon, authenticated;
GRANT SELECT ON public.cuzdan_hareketleri TO authenticated;

DROP POLICY IF EXISTS cuzdan_hareket_select ON public.cuzdan_hareketleri;
CREATE POLICY cuzdan_hareket_select ON public.cuzdan_hareketleri
    FOR SELECT TO authenticated
    USING (kullanici_id = public.benim_kullanici_id() OR public.ben_platform_yoneticisi());

-- ---- Dahili: bakiye uygula (varlık kolonu dinamik, negatife düşmez) --------
CREATE OR REPLACE FUNCTION public._bakiye_uygula(p_kul BIGINT, p_varlik TEXT, p_delta BIGINT, p_sebep TEXT, p_yapan BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    INSERT INTO public.cuzdan (kullanici_id) VALUES (p_kul)
    ON CONFLICT (kullanici_id) DO NOTHING;

    IF p_varlik = 'elmas' THEN
        UPDATE public.cuzdan SET elmas = elmas + p_delta, guncelleme = now() WHERE kullanici_id = p_kul;
    ELSE
        UPDATE public.cuzdan SET altin = altin + p_delta, guncelleme = now() WHERE kullanici_id = p_kul;
    END IF;

    INSERT INTO public.cuzdan_hareketleri (kullanici_id, varlik, miktar, sebep, yapan_id)
    VALUES (p_kul, p_varlik, p_delta, p_sebep, p_yapan);
END; $$;

-- ---- RPC: yönetici ver/al ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.bakiye_ekle(p_hedef BIGINT, p_varlik TEXT, p_miktar BIGINT, p_sebep TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bakiye işlemi için yönetici olmalısın.';
    END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN
        RAISE EXCEPTION 'Geçersiz varlık.';
    END IF;
    IF p_miktar = 0 THEN RETURN; END IF;
    PERFORM public._bakiye_uygula(
        p_hedef, p_varlik, p_miktar,
        COALESCE(p_sebep, CASE WHEN p_miktar > 0 THEN 'Yönetici yükledi' ELSE 'Yönetici düştü' END),
        public.benim_kullanici_id());
EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'Bakiye negatife düşemez.';
END; $$;
REVOKE ALL ON FUNCTION public.bakiye_ekle(BIGINT, TEXT, BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.bakiye_ekle(BIGINT, TEXT, BIGINT, TEXT) TO authenticated;

-- ---- RPC: kullanıcı → kullanıcı transfer ------------------------------------
CREATE OR REPLACE FUNCTION public.bakiye_transfer(p_hedef BIGINT, p_varlik TEXT, p_miktar BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_hedef = v_ben THEN RAISE EXCEPTION 'Kendine transfer yapamazsın.'; END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN RAISE EXCEPTION 'Geçersiz varlık.'; END IF;
    IF p_miktar <= 0 THEN RAISE EXCEPTION 'Miktar pozitif olmalı.'; END IF;

    -- Önce kendinden düş (negatife düşerse check_violation → yetersiz bakiye)
    BEGIN
        PERFORM public._bakiye_uygula(v_ben, p_varlik, -p_miktar, 'Transfer (gönderildi)', v_ben);
    EXCEPTION WHEN check_violation THEN
        RAISE EXCEPTION 'Yetersiz bakiye.';
    END;
    PERFORM public._bakiye_uygula(p_hedef, p_varlik, p_miktar, 'Transfer (alındı)', v_ben);
END; $$;
REVOKE ALL ON FUNCTION public.bakiye_transfer(BIGINT, TEXT, BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.bakiye_transfer(BIGINT, TEXT, BIGINT) TO authenticated;

-- ---- RPC: kendi bakiyem -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.benim_bakiyem()
RETURNS TABLE (elmas BIGINT, altin BIGINT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE(c.elmas, 0), COALESCE(c.altin, 0)
      FROM (SELECT public.benim_kullanici_id() AS id) me
      LEFT JOIN public.cuzdan c ON c.kullanici_id = me.id;
$$;
REVOKE ALL ON FUNCTION public.benim_bakiyem() FROM public;
GRANT EXECUTE ON FUNCTION public.benim_bakiyem() TO authenticated;

-- ═══════════════════════════ [028_mic_yasak.sql] ═══════════════════════════

-- ============================================================================
-- 028_mic_yasak.sql — Platform geneli mikrofon yasağı (yönetici cezası)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021'den SONRA (Supabase SQL Editor).
--
-- Oda içi sustur/at (host/yardımcı) ayrı ve o odayla sınırlı (021/022).
-- BU yasak platform genelidir: yasaklı kullanıcı HER odaya girip dinler ama
-- HİÇBİR odada yazamaz / mikrofona çıkamaz. Yalnızca developer/super_admin.
--   • mic_yasaklari: kişi başına tek aktif kayıt; bitis NULL = kalıcı.
--   • mic_yasak_ver(hedef, sebep, dakika): dakika NULL → kalıcı.
--   • mic_yasak_kaldir(hedef).
--   • benim_mic_yasagim(): aktif yasağı (sebep, bitis) döndürür.
-- benim_kullanici_id() 003, ben_platform_yoneticisi() 021.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mic_yasaklari (
    kullanici_id  BIGINT      PRIMARY KEY REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    sebep         TEXT,
    yasaklayan_id BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    bitis         TIMESTAMPTZ, -- NULL = kalıcı
    olusturma     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mic_yasaklari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mic_yasaklari FROM anon, authenticated;
GRANT SELECT ON public.mic_yasaklari TO authenticated;

-- Herkes okuyabilir (kişi kendi yasağını görebilsin; yönetim listeleyebilsin)
DROP POLICY IF EXISTS mic_yasak_select ON public.mic_yasaklari;
CREATE POLICY mic_yasak_select ON public.mic_yasaklari
    FOR SELECT TO authenticated USING (TRUE);

-- ---- RPC: yasak ver ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_yasak_ver(p_hedef BIGINT, p_sebep TEXT DEFAULT NULL, p_dakika INT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bitis TIMESTAMPTZ;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Mic yasağı için yönetici olmalısın.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendine mic yasağı veremezsin.';
    END IF;
    IF p_dakika IS NOT NULL THEN
        IF p_dakika <= 0 THEN RAISE EXCEPTION 'Süre pozitif olmalı (ya da kalıcı için boş bırak).'; END IF;
        v_bitis := now() + make_interval(mins => p_dakika);
    END IF;
    INSERT INTO public.mic_yasaklari (kullanici_id, sebep, yasaklayan_id, bitis)
    VALUES (p_hedef, p_sebep, public.benim_kullanici_id(), v_bitis)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET sebep = EXCLUDED.sebep, yasaklayan_id = EXCLUDED.yasaklayan_id,
            bitis = EXCLUDED.bitis, olusturma = now();
END; $$;
REVOKE ALL ON FUNCTION public.mic_yasak_ver(BIGINT, TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.mic_yasak_ver(BIGINT, TEXT, INT) TO authenticated;

-- ---- RPC: yasak kaldır ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_yasak_kaldir(p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yasak kaldırma için yönetici olmalısın.';
    END IF;
    DELETE FROM public.mic_yasaklari WHERE kullanici_id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.mic_yasak_kaldir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.mic_yasak_kaldir(BIGINT) TO authenticated;

-- ---- RPC: kendi aktif yasağım (bitmişse yok sayılır) ------------------------
CREATE OR REPLACE FUNCTION public.benim_mic_yasagim()
RETURNS TABLE (sebep TEXT, bitis TIMESTAMPTZ, kalici BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT m.sebep, m.bitis, (m.bitis IS NULL)
      FROM public.mic_yasaklari m
     WHERE m.kullanici_id = public.benim_kullanici_id()
       AND (m.bitis IS NULL OR m.bitis > now());
$$;
REVOKE ALL ON FUNCTION public.benim_mic_yasagim() FROM public;
GRANT EXECUTE ON FUNCTION public.benim_mic_yasagim() TO authenticated;

-- ═══════════════════════════ [029_admin_kullanici.sql] ═══════════════════════════

-- ============================================================================
-- 029_admin_kullanici.sql — Admin kullanıcı detayı + developer-özel işlemler
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 021 + 027 + 028'den SONRA (Supabase SQL Editor).
--
--   • ben_developer(): yalnızca 'developer' rolü.
--   • admin_kullanici_getir(hedef): yönetici; profil + bakiye + rol + seviye/xp
--     + aktif mic-yasağı + rapor sayısı. E-POSTA YALNIZCA developer'a döner
--     (super_admin'e NULL).
--   • admin_public_id_degistir(hedef, yeni): DEVELOPER (benzersizlik kontrolü).
--   • admin_sifre_sifirla(hedef, yeni): DEVELOPER; auth.users şifresini
--     pgcrypto ile yeniden yazar (düz metin kimseye gösterilmez).
-- benim_kullanici_id() 003, ben_platform_yoneticisi() 021.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---- developer-özel yetki kontrolü -----------------------------------------
CREATE OR REPLACE FUNCTION public.ben_developer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.kullanicilar
         WHERE id = public.benim_kullanici_id()
           AND ekonomi_rolu::text = 'developer'
    );
$$;

-- ---- Admin kullanıcı detayı -------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_kullanici_getir(p_hedef BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, kullanici_adi TEXT, profil_resmi TEXT,
    email TEXT, rol TEXT, seviye_id INT, deneyim_puani BIGINT,
    elmas BIGINT, altin BIGINT,
    mic_yasakli BOOLEAN, mic_sebep TEXT, mic_bitis TIMESTAMPTZ,
    rapor_sayisi BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT
        k.id, k.public_id, k.kullanici_adi, k.profil_resmi,
        CASE WHEN public.ben_developer() THEN k.email ELSE NULL END,   -- e-posta yalnızca developer
        k.ekonomi_rolu::text, k.seviye_id, COALESCE(k.deneyim_puani, 0),
        COALESCE(c.elmas, 0), COALESCE(c.altin, 0),
        (m.kullanici_id IS NOT NULL AND (m.bitis IS NULL OR m.bitis > now())),
        m.sebep, m.bitis,
        (SELECT count(*) FROM public.sikayetler s WHERE s.hedef_kullanici_id = k.id)
    FROM public.kullanicilar k
    LEFT JOIN public.cuzdan c ON c.kullanici_id = k.id
    LEFT JOIN public.mic_yasaklari m ON m.kullanici_id = k.id
    WHERE k.id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.admin_kullanici_getir(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_getir(BIGINT) TO authenticated;

-- ---- ID (public_id) düzenle — DEVELOPER ------------------------------------
CREATE OR REPLACE FUNCTION public.admin_public_id_degistir(p_hedef BIGINT, p_yeni TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Bu işlem yalnızca developer yetkisiyle yapılır.';
    END IF;
    IF p_yeni IS NULL OR length(trim(p_yeni)) = 0 THEN
        RAISE EXCEPTION 'Geçersiz ID.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.kullanicilar WHERE public_id = p_yeni AND id <> p_hedef) THEN
        RAISE EXCEPTION 'Bu ID zaten kullanımda.';
    END IF;
    UPDATE public.kullanicilar SET public_id = p_yeni WHERE id = p_hedef;
END; $$;
REVOKE ALL ON FUNCTION public.admin_public_id_degistir(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_public_id_degistir(BIGINT, TEXT) TO authenticated;

-- ---- Şifre sıfırla — DEVELOPER ---------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_sifre_sifirla(p_hedef BIGINT, p_yeni TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp, auth AS $$
DECLARE v_uid uuid;
BEGIN
    IF NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Bu işlem yalnızca developer yetkisiyle yapılır.';
    END IF;
    IF p_yeni IS NULL OR length(p_yeni) < 6 THEN
        RAISE EXCEPTION 'Şifre en az 6 karakter olmalı.';
    END IF;
    SELECT auth_uid INTO v_uid FROM public.kullanicilar WHERE id = p_hedef;
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Kullanıcının auth kaydı yok.'; END IF;
    UPDATE auth.users
       SET encrypted_password = extensions.crypt(p_yeni, extensions.gen_salt('bf'))
     WHERE id = v_uid;
END; $$;
REVOKE ALL ON FUNCTION public.admin_sifre_sifirla(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_sifre_sifirla(BIGINT, TEXT) TO authenticated;

-- ═══════════════════════════ [030_sikayet_katilimci.sql] ═══════════════════════════

-- ============================================================================
-- 030_sikayet_katilimci.sql — Oda raporuna "o an odadaki katılımcılar" snapshot'ı
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 023'ten SONRA (Supabase SQL Editor).
--
-- Bir oda raporlandığında, raporlayan client o anki presence listesini
-- ([{uid,name,publicId}]) bu kolona yazar. Yönetici rapor detayında kimin
-- o an odada olduğunu (avatar+ID) görüp işlem yapabilir.
-- INSERT grant'ine yeni kolon eklenir.
-- ============================================================================

ALTER TABLE public.sikayetler ADD COLUMN IF NOT EXISTS oda_katilimcilar JSONB;

GRANT INSERT (tip, raporlayan_id, hedef_kullanici_id, hedef_oda_id, neden, detay, oda_katilimcilar)
    ON public.sikayetler TO authenticated;

-- ═══════════════════════════ [031_admin_icerik.sql] ═══════════════════════════

-- ============================================================================
-- 031_admin_icerik.sql — Yönetici içerik kontrolü (akışta gönderi silme)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 008 (gonderi_sil) + 021'den SONRA (Supabase SQL Editor).
--
-- Mevcut gonderi_sil (008) sahiplik kontrollüdür (kendi gönderini silersin).
-- Bu RPC yöneticiye (developer/super_admin) BAŞKASININ gönderisini de
-- silme yetkisi verir (soft-delete). benim_kullanici_id() 003,
-- ben_platform_yoneticisi() 021.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_gonderi_sil(p_gonderi_id BIGINT)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count INTEGER;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    UPDATE public.gonderiler
       SET silinmis = TRUE, silinme_tarihi = now()
     WHERE id = p_gonderi_id AND silinmis = FALSE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
END; $$;
REVOKE ALL ON FUNCTION public.admin_gonderi_sil(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_gonderi_sil(BIGINT) TO authenticated;
