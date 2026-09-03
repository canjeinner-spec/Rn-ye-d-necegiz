-- ============================================================================
-- 085_hediye_katalogu_yeni.sql — katalog 7 Lottie hediyeye çıkıyor
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 082'den SONRA. İdempotent, tekrar çalıştırmak zarar vermez.
--
-- NEDEN: 082 kataloğu üç Lottie hediyesine indirmişti (gül, ayıcık, hazine).
-- Dört animasyon daha eklendi:
--     kedi   — Âşık Kedi        (normal)
--     tavsan — Tavşan Çifti     (epic, çift/sevgili hediyesi)
--     kaplan — Kükreyen Kaplan  (epic, statü)
--     zafer  — Zafer Gecesi     (legendary, 10.7 sn'lik gösteri parçası)
--
-- 082'DEN FARKI: burada katalogun TAMAMI yazılıyor, sadece yeniler değil.
-- Böylece `sira` değerleri tek yerden ve tutarlı geliyor; 082'yi sonradan
-- tekrar çalıştırmak kataloğu 3 hediyeye düşürmüyor (085 son söz).
--
-- SİLMİYORUZ, PASİFE ALIYORUZ — `hediye_gecmisi.hediye_id` bu satırlara
-- bakıyor, silmek geçmişi kırar. Pasif satırlar istemciye gelmez
-- (`katalog()` `.eq("aktif", true)` filtreliyor).
--
-- İSTEMCİ EŞLEMESİ — BURASI KRİTİK: aşağıdaki `kod` değerleri
-- `src/gifts/bigGifts.ts` içindeki GIFT_SCENES anahtarlarıyla BİREBİR aynı
-- olmalı. Eşleşmezse hediye SESSİZCE eski emoji efektine düşer, hata vermez.
-- Şu anki anahtarlar: gul, kedi, tavsan, kaplan, ayicik, hazine, zafer.
-- ============================================================================

-- 1) Katalogun tamamı pasife; aşağıdaki 7 satır yeniden aktif ediliyor.
UPDATE public.hediyeler SET aktif = FALSE WHERE aktif;

-- 2) Aktif katalog. `kod` benzersiz (059'daki uq_hediye_kod) ama bu KISMİ bir
--    indeks (WHERE kod IS NOT NULL), o yüzden ON CONFLICT aynı koşulu
--    tekrarlamak zorunda — yoksa 42P10 verir.
INSERT INTO public.hediyeler (kod, ad, kategori, birim_fiyat, sira, aktif, emoji, renk1, renk2, kademe)
VALUES
    ('gul',    'Gül',              'Hediye',    500, 1, TRUE, '🌹', '#FDA4AF', '#9F1239', 'normal'),
    ('kedi',   'Âşık Kedi',        'Hediye',    800, 2, TRUE, '😻', '#FFA766', '#C44C00', 'normal'),
    ('ayicik', 'Şanslı Ayıcık',    'Hediye',   5000, 3, TRUE, '🧸', '#FCD34D', '#B45309', 'epic'),
    ('tavsan', 'Tavşan Çifti',     'Hediye',   8000, 4, TRUE, '🐰', '#F7C6B0', '#6B4A3E', 'epic'),
    ('kaplan', 'Kükreyen Kaplan',  'Hediye',  15000, 5, TRUE, '🐯', '#FFB980', '#8C2F2B', 'epic'),
    ('hazine', 'Hazine Sandığı',   'Hediye',  50000, 6, TRUE, '💰', '#FDE68A', '#B45309', 'legendary'),
    ('zafer',  'Zafer Gecesi',     'Hediye', 150000, 7, TRUE, '🏆', '#FFE647', '#1D4ED8', 'legendary')
ON CONFLICT (kod) WHERE kod IS NOT NULL DO UPDATE SET
    ad          = EXCLUDED.ad,
    kategori    = EXCLUDED.kategori,
    birim_fiyat = EXCLUDED.birim_fiyat,
    sira        = EXCLUDED.sira,
    aktif       = TRUE,
    emoji       = EXCLUDED.emoji,
    renk1       = EXCLUDED.renk1,
    renk2       = EXCLUDED.renk2,
    kademe      = EXCLUDED.kademe;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA (tam olarak 7 satır dönmeli, sira sırasıyla):
--
-- SELECT kod, ad, birim_fiyat, kademe FROM public.hediyeler
--  WHERE aktif ORDER BY sira;
-- ---------------------------------------------------------------------------
