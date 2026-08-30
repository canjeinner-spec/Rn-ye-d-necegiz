-- ============================================================================
-- 064 — Yardımcı fonksiyonlarda kalan anon erişimi
--
-- 063'ten sonra ölçüldü: dört yardımcı hâlâ giriş yapmamış birine açıktı.
--
-- SEBEP: PostgreSQL yeni fonksiyona **PUBLIC**'e EXECUTE verir. `anon` da
-- PUBLIC'in içinde olduğu için `REVOKE ... FROM anon` tek başına kapatmıyor —
-- rolün kendi grant'ını siliyor, PUBLIC'ten geleni değil. 063'teki diğer
-- fonksiyonlar kapandı çünkü onların kendi migration'ında zaten
-- `REVOKE ALL ... FROM PUBLIC` vardı; bu dördünde yoktu.
--
-- Kural: yeni bir fonksiyon açarken önce PUBLIC'ten REVOKE, sonra hedef role
-- GRANT. Yalnız anon'dan revoke etmek yetmiyor.
--
-- İçerikleri kritik değil (enum etiketleri, dönem başlangıcı, bugünün tarihi)
-- ama şema bilgisi dışarı açık durmasın.
-- ============================================================================

REVOKE ALL ON FUNCTION public._enum_etiket(TEXT, TEXT[])    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._enum_liste(TEXT)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._siralama_baslangic(TEXT)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._bugun_tr()                   FROM PUBLIC, anon;

-- `_siralama_baslangic` ve `_bugun_tr` SECURITY DEFINER fonksiyonların
-- İÇİNDEN çağrılıyor (orada sahip yetkisiyle çalışılır), bu yüzden istemciye
-- hiç GRANT gerekmiyor.
