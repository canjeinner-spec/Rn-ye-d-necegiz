-- ============================================================================
-- ARON CHAT — SCHEMA v7 EKLENTİLERİ (additive migration)
-- Mevcut schema_v7.sql'i DEĞİŞTİRMEZ; üstüne eklenir.
-- Mockup'ta olup v7'de karşılığı olmayan özellikler için tablolar:
--   Sosyal Akış (Feed) · Etkinlikler · Görevler/Günlük Ödül · Kuponlar ·
--   Özel ID · Arkadaşlık
-- Kurallar v7 ile aynı: Türkçe snake_case, public_id, soft-delete, audit,
-- varlik_tipi ödüller, kısmi index, ENUM, TIMESTAMPTZ.
-- ============================================================================

-- ── Yeni ENUM tipleri ──────────────────────────────────────────────────────
CREATE TYPE gonderi_kapsami     AS ENUM ('herkes', 'arkadaslar', 'takipciler');
CREATE TYPE etkinlik_durumu     AS ENUM ('taslak', 'yakinda', 'yayinda', 'bitti', 'iptal');
CREATE TYPE gorev_tipi          AS ENUM ('gunluk', 'haftalik', 'basarim');
CREATE TYPE ozel_id_tier        AS ENUM ('normal', 'super', 'altin', 'elmas', 'kral');
CREATE TYPE ozel_id_durumu      AS ENUM ('musait', 'rezerve', 'satildi');
CREATE TYPE arkadaslik_durumu   AS ENUM ('beklemede', 'kabul', 'reddedildi');

-- Bildirim tipine yeni değerler (feed/etkinlik/arkadaşlık/görev)
ALTER TYPE bildirim_tipi ADD VALUE IF NOT EXISTS 'begeni';
ALTER TYPE bildirim_tipi ADD VALUE IF NOT EXISTS 'yorum';
ALTER TYPE bildirim_tipi ADD VALUE IF NOT EXISTS 'etkinlik';
ALTER TYPE bildirim_tipi ADD VALUE IF NOT EXISTS 'arkadaslik';
ALTER TYPE bildirim_tipi ADD VALUE IF NOT EXISTS 'gorev';

-- ============================================================================
-- BÖLÜM M — SOSYAL AKIŞ (FEED)
-- ============================================================================
CREATE TABLE gonderiler (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           VARCHAR(12)     NOT NULL UNIQUE,
    kullanici_id        BIGINT          NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    icerik              TEXT            CHECK (icerik IS NULL OR char_length(icerik) <= 2000),
    kapsam              gonderi_kapsami NOT NULL DEFAULT 'herkes',
    begeni_sayisi       INTEGER         NOT NULL DEFAULT 0 CHECK (begeni_sayisi >= 0),
    yorum_sayisi        INTEGER         NOT NULL DEFAULT 0 CHECK (yorum_sayisi >= 0),
    paylasim_sayisi     INTEGER         NOT NULL DEFAULT 0 CHECK (paylasim_sayisi >= 0),
    duzenlendi          BOOLEAN         NOT NULL DEFAULT FALSE,
    guncelleyen_id      BIGINT,
    silen_id            BIGINT,
    silinmis            BOOLEAN         NOT NULL DEFAULT FALSE,
    silinme_tarihi      TIMESTAMPTZ,
    olusturulma_tarihi  TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP,
    guncellenme_tarihi  TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP,
    CHECK (icerik IS NOT NULL OR begeni_sayisi >= 0)  -- içerik ya da medya zorunlu (medya tabloda)
);
CREATE INDEX idx_gonderiler_kullanici ON gonderiler (kullanici_id, id DESC) WHERE silinmis = FALSE;
CREATE INDEX idx_gonderiler_akis      ON gonderiler (id DESC) WHERE silinmis = FALSE;

CREATE TABLE gonderi_medya (
    id              BIGSERIAL PRIMARY KEY,
    gonderi_id      BIGINT      NOT NULL REFERENCES gonderiler(id) ON DELETE CASCADE,
    medya_url       TEXT        NOT NULL,
    tip             VARCHAR(10) NOT NULL DEFAULT 'foto' CHECK (tip IN ('foto', 'video')),
    sira            SMALLINT    NOT NULL DEFAULT 0
);
CREATE INDEX idx_gonderi_medya ON gonderi_medya (gonderi_id, sira);

CREATE TABLE gonderi_begeniler (
    gonderi_id      BIGINT      NOT NULL REFERENCES gonderiler(id) ON DELETE CASCADE,
    kullanici_id    BIGINT      NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    begeni_tarihi   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (gonderi_id, kullanici_id)
);
CREATE INDEX idx_gonderi_begeni_kullanici ON gonderi_begeniler (kullanici_id);

CREATE TABLE gonderi_yorumlari (
    id                  BIGSERIAL PRIMARY KEY,
    gonderi_id          BIGINT      NOT NULL REFERENCES gonderiler(id) ON DELETE CASCADE,
    kullanici_id        BIGINT      NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    ust_yorum_id        BIGINT      REFERENCES gonderi_yorumlari(id) ON DELETE CASCADE,  -- yanıt zinciri
    icerik              TEXT        NOT NULL CHECK (char_length(icerik) BETWEEN 1 AND 1000),
    begeni_sayisi       INTEGER     NOT NULL DEFAULT 0 CHECK (begeni_sayisi >= 0),
    silinmis            BOOLEAN     NOT NULL DEFAULT FALSE,
    olusturulma_tarihi  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_yorumlar_gonderi ON gonderi_yorumlari (gonderi_id, id DESC) WHERE silinmis = FALSE;

CREATE TABLE gonderi_yorum_begeniler (
    yorum_id        BIGINT      NOT NULL REFERENCES gonderi_yorumlari(id) ON DELETE CASCADE,
    kullanici_id    BIGINT      NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    begeni_tarihi   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (yorum_id, kullanici_id)
);

-- ============================================================================
-- BÖLÜM N — ETKİNLİKLER (EVENTS)
-- ============================================================================
CREATE TABLE etkinlikler (
    id                  BIGSERIAL PRIMARY KEY,
    public_id           VARCHAR(12)     NOT NULL UNIQUE,
    ad                  VARCHAR(150)    NOT NULL,
    aciklama            TEXT,
    kapak_url           TEXT,
    tip                 VARCHAR(40),                    -- yarisma / cekilis / parti / ...
    durum               etkinlik_durumu NOT NULL DEFAULT 'taslak',
    oda_id              BIGINT          REFERENCES odalar(id) ON DELETE SET NULL,
    baslangic_tarihi    TIMESTAMPTZ,
    bitis_tarihi        TIMESTAMPTZ,
    odul_aciklama       TEXT,
    odul_meta           JSONB,                          -- sıralama → ödül tablosu vb.
    katilimci_sayisi    INTEGER         NOT NULL DEFAULT 0 CHECK (katilimci_sayisi >= 0),
    aktif               BOOLEAN         NOT NULL DEFAULT TRUE,
    olusturan_id        BIGINT          REFERENCES kullanicilar(id) ON DELETE SET NULL,
    olusturulma_tarihi  TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP,
    guncellenme_tarihi  TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP,
    CHECK (bitis_tarihi IS NULL OR baslangic_tarihi IS NULL OR bitis_tarihi >= baslangic_tarihi)
);
CREATE INDEX idx_etkinlikler_durum ON etkinlikler (durum, baslangic_tarihi DESC) WHERE aktif = TRUE;

CREATE TABLE etkinlik_katilimlari (
    id              BIGSERIAL PRIMARY KEY,
    etkinlik_id     BIGINT      NOT NULL REFERENCES etkinlikler(id) ON DELETE CASCADE,
    kullanici_id    BIGINT      NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    katilim_tarihi  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (etkinlik_id, kullanici_id)
);
CREATE INDEX idx_etkinlik_katilim ON etkinlik_katilimlari (etkinlik_id);

-- ============================================================================
-- BÖLÜM O — GÖREVLER & GÜNLÜK ÖDÜLLER
-- ============================================================================
CREATE TABLE gorevler (
    id                  SERIAL PRIMARY KEY,
    kod                 VARCHAR(50)     NOT NULL UNIQUE,
    ad                  VARCHAR(100)    NOT NULL,
    aciklama            TEXT,
    tip                 gorev_tipi      NOT NULL DEFAULT 'gunluk',
    hedef_sayi          INTEGER         NOT NULL DEFAULT 1 CHECK (hedef_sayi > 0),
    odul_varlik         varlik_tipi     NOT NULL DEFAULT 'altin',
    odul_miktar         BIGINT          NOT NULL DEFAULT 0 CHECK (odul_miktar >= 0),
    ikon_url            TEXT,
    sira                INTEGER         NOT NULL DEFAULT 0,
    aktif               BOOLEAN         NOT NULL DEFAULT TRUE,
    olusturulma_tarihi  TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kullanici_gorev_ilerlemesi (
    id                  BIGSERIAL PRIMARY KEY,
    kullanici_id        BIGINT      NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    gorev_id            INTEGER     NOT NULL REFERENCES gorevler(id) ON DELETE CASCADE,
    donem_anahtari      VARCHAR(20) NOT NULL,            -- 'YYYY-MM-DD' (günlük) / 'YYYY-WW' (haftalık)
    ilerleme            INTEGER     NOT NULL DEFAULT 0 CHECK (ilerleme >= 0),
    tamamlandi          BOOLEAN     NOT NULL DEFAULT FALSE,
    odul_alindi         BOOLEAN     NOT NULL DEFAULT FALSE,
    guncellenme_tarihi  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kullanici_id, gorev_id, donem_anahtari)
);
CREATE INDEX idx_gorev_ilerleme_kullanici ON kullanici_gorev_ilerlemesi (kullanici_id, donem_anahtari);

CREATE TABLE gunluk_giris_odulleri (
    gun_no      SMALLINT    PRIMARY KEY CHECK (gun_no BETWEEN 1 AND 30),
    varlik      varlik_tipi NOT NULL DEFAULT 'altin',
    miktar      BIGINT      NOT NULL CHECK (miktar > 0),
    ikon_url    TEXT
);

CREATE TABLE kullanici_gunluk_giris (
    kullanici_id        BIGINT      PRIMARY KEY REFERENCES kullanicilar(id) ON DELETE CASCADE,
    mevcut_seri         INTEGER     NOT NULL DEFAULT 0 CHECK (mevcut_seri >= 0),  -- streak
    son_alinan_gun      SMALLINT    NOT NULL DEFAULT 0,
    son_giris_tarihi    DATE,
    guncellenme_tarihi  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BÖLÜM P — KUPONLAR
-- ============================================================================
CREATE TABLE kuponlar (
    id                      BIGSERIAL PRIMARY KEY,
    kod                     VARCHAR(40)  NOT NULL UNIQUE,
    varlik                  varlik_tipi  NOT NULL DEFAULT 'elmas',
    miktar                  BIGINT       NOT NULL CHECK (miktar > 0),
    toplam_limit            INTEGER      CHECK (toplam_limit IS NULL OR toplam_limit > 0),  -- NULL = sınırsız
    kullanim_sayisi         INTEGER      NOT NULL DEFAULT 0 CHECK (kullanim_sayisi >= 0),
    kullanici_basina_limit  INTEGER      NOT NULL DEFAULT 1 CHECK (kullanici_basina_limit > 0),
    baslangic_tarihi        TIMESTAMPTZ,
    bitis_tarihi            TIMESTAMPTZ,
    aktif                   BOOLEAN      NOT NULL DEFAULT TRUE,
    olusturan_id            BIGINT       REFERENCES kullanicilar(id) ON DELETE SET NULL,
    olusturulma_tarihi      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    CHECK (bitis_tarihi IS NULL OR baslangic_tarihi IS NULL OR bitis_tarihi >= baslangic_tarihi)
);

CREATE TABLE kupon_kullanimlari (
    id              BIGSERIAL PRIMARY KEY,
    kupon_id        BIGINT          NOT NULL REFERENCES kuponlar(id) ON DELETE CASCADE,
    kullanici_id    BIGINT          NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    varlik          varlik_tipi     NOT NULL,
    miktar          BIGINT          NOT NULL CHECK (miktar > 0),
    idempotency_key VARCHAR(80),
    kullanim_tarihi TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_kupon_kullanim ON kupon_kullanimlari (kupon_id);
CREATE INDEX idx_kupon_kullanim_user ON kupon_kullanimlari (kullanici_id);
CREATE UNIQUE INDEX uq_kupon_idem ON kupon_kullanimlari (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- BÖLÜM Q — ÖZEL ID (vanity ID pazarı)
-- ============================================================================
CREATE TABLE ozel_idler (
    id                  BIGSERIAL PRIMARY KEY,
    deger               VARCHAR(12)     NOT NULL UNIQUE,   -- "11111", "88888" gibi
    tier                ozel_id_tier    NOT NULL DEFAULT 'normal',
    fiyat_elmas         BIGINT          NOT NULL DEFAULT 0 CHECK (fiyat_elmas >= 0),
    sure_gun            INTEGER         CHECK (sure_gun IS NULL OR sure_gun > 0),  -- NULL = kalıcı
    durum               ozel_id_durumu  NOT NULL DEFAULT 'musait',
    sahip_id            BIGINT          REFERENCES kullanicilar(id) ON DELETE SET NULL,
    edinme_tarihi       TIMESTAMPTZ,
    bitis_tarihi        TIMESTAMPTZ,
    olusturulma_tarihi  TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP,
    CHECK ((durum = 'satildi') = (sahip_id IS NOT NULL))
);
CREATE INDEX idx_ozel_idler_durum ON ozel_idler (durum, tier);
CREATE INDEX idx_ozel_idler_sahip ON ozel_idler (sahip_id) WHERE sahip_id IS NOT NULL;

CREATE TABLE ozel_id_satislari (
    id                  BIGSERIAL PRIMARY KEY,
    ozel_id             BIGINT          NOT NULL REFERENCES ozel_idler(id) ON DELETE CASCADE,
    kullanici_id        BIGINT          NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    fiyat_elmas         BIGINT          NOT NULL CHECK (fiyat_elmas >= 0),
    idempotency_key     VARCHAR(80),
    satin_alma_tarihi   TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ozel_id_satis ON ozel_id_satislari (kullanici_id, id DESC);
CREATE UNIQUE INDEX uq_ozel_id_satis_idem ON ozel_id_satislari (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- BÖLÜM R — ARKADAŞLIK (takip'ten ayrı; karşılıklı istek modeli)
--   takip = tek yönlü (kullanicilar_takip, v7'de var)
--   arkadaslik = istek + kabul (mockup "Arkadaşlar / İstekler" ekranı)
-- ============================================================================
CREATE TABLE arkadasliklar (
    id              BIGSERIAL PRIMARY KEY,
    isteyen_id      BIGINT              NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    istenen_id      BIGINT              NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    durum           arkadaslik_durumu   NOT NULL DEFAULT 'beklemede',
    istek_tarihi    TIMESTAMPTZ         DEFAULT CURRENT_TIMESTAMP,
    yanit_tarihi    TIMESTAMPTZ,
    CHECK (isteyen_id <> istenen_id),
    UNIQUE (isteyen_id, istenen_id)
);
CREATE INDEX idx_arkadaslik_istenen ON arkadasliklar (istenen_id, durum);
CREATE INDEX idx_arkadaslik_isteyen ON arkadasliklar (isteyen_id, durum);
-- Çift yönlü tekillik (A-B ile B-A aynı sayılır): uygulama katmanında min(id),max(id) ile kontrol edilir.

-- ============================================================================
-- BÖLÜM S — ÖRNEK SEED (feature flag + günlük ödül)
-- ============================================================================
INSERT INTO feature_flags (anahtar, aktif, aciklama) VALUES
    ('feed_enabled',     TRUE,  'Sosyal akış (gönderiler)'),
    ('events_enabled',   TRUE,  'Etkinlikler'),
    ('tasks_enabled',    TRUE,  'Görevler & günlük ödül'),
    ('coupons_enabled',  TRUE,  'Kupon kullanımı'),
    ('special_id_enabled', TRUE, 'Özel ID pazarı')
ON CONFLICT (anahtar) DO NOTHING;

INSERT INTO gunluk_giris_odulleri (gun_no, varlik, miktar) VALUES
    (1, 'altin', 100),
    (2, 'altin', 150),
    (3, 'altin', 200),
    (4, 'altin', 300),
    (5, 'altin', 400),
    (6, 'altin', 600),
    (7, 'elmas', 50)
ON CONFLICT (gun_no) DO NOTHING;
