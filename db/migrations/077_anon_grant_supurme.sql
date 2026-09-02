-- ============================================================================
-- 077_anon_grant_supurme.sql — 021-024 döneminin fonksiyonlarında anon süpürmesi
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 076'dan SONRA. İdempotent (yetki zaten yoksa REVOKE zararsız).
--
-- NEDEN: 021-024 yalnız `REVOKE ... FROM public` yazmıştı. 063/064'te
-- öğrenilen ders: PUBLIC'ten almak, role verilmiş DOĞRUDAN grant'i
-- (ya da eski bir kurulumdan kalanı) SİLMEZ — iki yön birbirinden bağımsız.
-- Sonraki migration'ların hepsi `FROM PUBLIC, anon` deseninde; bu dosya aynı
-- disiplini geriye uyguluyor. Oturumsuz (anon) istemcinin bu fonksiyonları
-- çağırabilmesi için hiçbir sebep yok.
--
-- Not: fonksiyonların hepsi gövdede zaten oturum + yetki kontrolü yapıyor;
-- bu süpürme savunma katmanı. `ben_platform_yoneticisi()` ve
-- `oda_sahibi_ekle()` (trigger) çağrılabilir yüzey değil, yine de listede.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.oda_rol_ata(BIGINT, BIGINT, TEXT)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.oda_uye_cikar(BIGINT, BIGINT)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.oda_yasakla(BIGINT, BIGINT)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.oda_yasak_kaldir(BIGINT, BIGINT)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.platform_rol_ata(BIGINT, TEXT)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ben_platform_yoneticisi()            FROM anon;
REVOKE EXECUTE ON FUNCTION public.oda_sahibi_ekle()                    FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA (çalıştırdıktan sonra SQL Editor'da; anon satırı KALMAMALI):
--
-- SELECT p.proname,
--        pg_get_function_identity_arguments(p.oid) AS args,
--        a.grantee::regrole::text AS kim
--   FROM pg_proc p
--   CROSS JOIN LATERAL aclexplode(p.proacl) a
--  WHERE p.pronamespace = 'public'::regnamespace
--    AND p.proname IN ('oda_rol_ata','oda_uye_cikar','oda_yasakla',
--                      'oda_yasak_kaldir','platform_rol_ata',
--                      'ben_platform_yoneticisi','oda_sahibi_ekle')
--  ORDER BY p.proname, kim;
-- ---------------------------------------------------------------------------
