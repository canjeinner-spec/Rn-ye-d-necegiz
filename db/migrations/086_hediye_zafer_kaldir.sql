-- ============================================================================
-- 086_hediye_zafer_kaldir.sql — "Zafer Gecesi" katalogdan çıkıyor
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 085'ten SONRA. İdempotent.
--
-- NEDEN: dosya bu yığında düzgün çizilemiyor. 4.6 MB, 1440x1024, 334 katman
-- ve lottie-android'in yok saydığı 55 efekt + 30 blend mode içeriyordu;
-- kale ağları ve top renkleri bembeyaz çıkıyordu. Merge path desteği açıldı
-- (Anim.tsx) ama efekt ve blend mode'lar hâlâ çizilmiyor — sorun dosyanın
-- kendisinde, kodda değil. Ayrıca tek başına JS bundle'ı ~6.6 MB'dan
-- ~10 MB'a çıkarıyordu.
--
-- SİLMİYORUZ, PASİFE ALIYORUZ — `hediye_gecmisi.hediye_id` bu satıra bakıyor;
-- silmek birinin geçmişini kırar. Pasif satır istemciye gelmez
-- (`katalog()` `.eq("aktif", true)` filtreliyor) ve `hediye_gonder_fn`
-- trigger'ı pasif hediyeyi reddediyor.
--
-- İstemci tarafı: `src/anim/gifts/zafer.json` silindi, GIFT_SCENES'teki
-- kaydı kaldırıldı. Katalog 6 aktif hediyeye iniyor.
-- ============================================================================

UPDATE public.hediyeler SET aktif = FALSE WHERE kod = 'zafer';

-- ---------------------------------------------------------------------------
-- DOĞRULAMA (6 satır dönmeli, zafer YOK):
--   SELECT kod, ad, birim_fiyat, kademe FROM public.hediyeler
--    WHERE aktif ORDER BY sira;
-- ---------------------------------------------------------------------------
