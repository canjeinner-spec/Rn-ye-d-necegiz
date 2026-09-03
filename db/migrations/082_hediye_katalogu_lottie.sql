-- ============================================================================
-- 082_hediye_katalogu_lottie.sql — katalog üç Lottie hediyeye indi
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 081'den SONRA. İdempotent (tekrar çalıştırmak zarar vermez).
--
-- NEDEN: hediye efektleri artık Lottie ile çiziliyor. Elde üç animasyon var
-- (gül, şanslı ayıcık, hazine sandığı); kataloğun geri kalanı emoji + gradyan
-- ile çiziliyordu ve artık kullanılmayacak.
--
-- SİLMİYORUZ, PASİFE ALIYORUZ. `hediye_gecmisi.hediye_id` bu satırlara
-- bakıyor; silmek geçmişi kırar. `aktif = FALSE` olan satırlar istemciye
-- gelmez (`katalog()` `.eq("aktif", true)` filtreliyor) ve `hediye_gonder_fn`
-- trigger'ı da pasif hediyeyi reddediyor.
--
-- İSTEMCİ TARAFI: animasyon dosyaları `src/anim/gifts/` altında, eşleme
-- `src/gifts/bigGifts.ts` içindeki GIFT_SCENES'te. Buradaki `kod` değerleri
-- oradaki anahtarlarla BİREBİR aynı olmalı — eşleşmezse hediye eski emoji
-- efektine düşer (sessizce, hata vermeden).
-- ============================================================================

-- 1) Mevcut katalogun tamamı pasife
UPDATE public.hediyeler SET aktif = FALSE WHERE aktif;

-- 2) Üç Lottie hediyesi. `kod` benzersiz (059'daki uq_hediye_kod), o yüzden
--    ON CONFLICT ile hem ekliyor hem güncelliyor.
INSERT INTO public.hediyeler (kod, ad, kategori, birim_fiyat, sira, aktif, emoji, renk1, renk2, kademe)
VALUES
    ('gul',    'Gül',             'Hediye',   500, 1, TRUE, '🌹', '#FDA4AF', '#9F1239', 'normal'),
    ('ayicik', 'Şanslı Ayıcık',   'Hediye',  5000, 2, TRUE, '🧸', '#FCD34D', '#B45309', 'epic'),
    ('hazine', 'Hazine Sandığı',  'Hediye', 50000, 3, TRUE, '💰', '#FDE68A', '#B45309', 'legendary')
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
-- DOĞRULAMA (çalıştırdıktan sonra; tam olarak 3 satır dönmeli):
--
-- SELECT id, kod, ad, birim_fiyat, kademe, aktif
--   FROM public.hediyeler WHERE aktif ORDER BY sira;
-- ---------------------------------------------------------------------------
