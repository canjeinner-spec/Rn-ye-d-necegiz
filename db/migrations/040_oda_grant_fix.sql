-- 040_oda_grant_fix.sql — odalar UPDATE grant'ını yeniden assert eder.
-- Tanı: isim/duyuru (updateRoomSettings) kalıcı oluyordu ama tema/kapak
-- (aynı fonksiyon, aynı RLS, farklı kolon) olmuyordu — canlı DB'de GRANT
-- UPDATE kolon listesinin kategori/kapak_url'ü kapsamadığından şüpheleniyoruz
-- (003_rooms_rls.sql metni kapsıyor ama proje başında tek seferlik çalıştı,
-- canlıya o hâliyle yansımamış olabilir). GRANT idempotenttir, zarar vermez.
GRANT UPDATE (ad, aciklama, kategori, kapak_url, herkese_acik) ON public.odalar TO authenticated;

-- Doğrulama (isteğe bağlı, SQL Editor'da ayrı çalıştırılabilir):
-- SELECT has_column_privilege('authenticated','public.odalar','kategori','UPDATE') AS kategori_ok,
--        has_column_privilege('authenticated','public.odalar','kapak_url','UPDATE') AS kapak_ok,
--        has_column_privilege('authenticated','public.odalar','ad','UPDATE') AS ad_ok;
