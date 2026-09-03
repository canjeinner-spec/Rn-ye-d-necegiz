-- ============================================================================
-- 087_hediye_noel_baba.sql — "Noel Baba" katalogda, aktif katalog 7 hediye
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 086'dan SONRA. İdempotent.
--
-- 085 gibi katalogun TAMAMINI yazıyor, sadece yeniyi değil. Böylece `sira`
-- tek yerden geliyor ve 085/086 yanlışlıkla tekrar çalıştırılsa bile katalog
-- bozulmuyor — 087 son söz. Zafer bu listede YOK, yani 086'nın işini de
-- kapsıyor (pasif kalır).
--
-- İSTEMCİ EŞLEMESİ — KRİTİK: buradaki `kod` değerleri
-- `src/gifts/bigGifts.ts` (animasyon) ve `src/gifts/giftPng.ts` (karo
-- görseli) içindeki anahtarlarla BİREBİR aynı olmalı. Eşleşmezse hediye
-- sessizce emojiye düşer, hata vermez.
--
-- Noel Baba hakkında not: kaynak dosya vektör değil, kare dizisi (24 fps'te
-- 97 gömülü görsel). Özgün hâli 800x800'dü ve çözülmüş bitmap olarak
-- ~237 MB ediyordu; `scripts/lottie-gorsel-kucult.js` ile 256'ya indirildi
-- (~24 MB) ve zemini silindi. Ayrıntı bigGifts.ts'te.
-- ============================================================================

UPDATE public.hediyeler SET aktif = FALSE WHERE aktif;

INSERT INTO public.hediyeler (kod, ad, kategori, birim_fiyat, sira, aktif, emoji, renk1, renk2, kademe)
VALUES
    ('gul',    'Gül',              'Hediye',    500, 1, TRUE, '🌹', '#FDA4AF', '#9F1239', 'normal'),
    ('kedi',   'Âşık Kedi',        'Hediye',    800, 2, TRUE, '😻', '#FFA766', '#C44C00', 'normal'),
    ('ayicik', 'Şanslı Ayıcık',    'Hediye',   5000, 3, TRUE, '🧸', '#FCD34D', '#B45309', 'epic'),
    ('tavsan', 'Tavşan Çifti',     'Hediye',   8000, 4, TRUE, '🐰', '#F7C6B0', '#6B4A3E', 'epic'),
    ('kaplan', 'Kükreyen Kaplan',  'Hediye',  15000, 5, TRUE, '🐯', '#FFB980', '#8C2F2B', 'epic'),
    ('noel',   'Noel Baba',        'Hediye',  30000, 6, TRUE, '🎅', '#F2635A', '#A81C1C', 'legendary'),
    ('hazine', 'Hazine Sandığı',   'Hediye',  50000, 7, TRUE, '💰', '#FDE68A', '#B45309', 'legendary')
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
-- DOĞRULAMA (7 satır, zafer YOK):
--   SELECT kod, ad, birim_fiyat, kademe FROM public.hediyeler
--    WHERE aktif ORDER BY sira;
-- ---------------------------------------------------------------------------
