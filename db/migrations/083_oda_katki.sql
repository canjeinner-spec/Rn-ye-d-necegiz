-- ============================================================================
-- 083_oda_katki.sql — Oda katkı listesi gerçek veriye bağlanıyor
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 082'den SONRA. İdempotent.
--
-- SORUN: `ContributionView` tamamen uydurmaydı. Odadaki kişilere sabit bir
-- dizi dağıtıyordu:
--     const seed7  = [90, 48, 32, 21, 14, 9, 6, 3];
--     const seed24 = [12, 7, 4, 2, 1];
-- Yani listedeki sıralama da, rakamlar da, "Katkıda Bulundu" değeri de
-- gerçek değildi. Kim ne gönderdiyse hiç etkisi yoktu.
--
-- VERİ ZATEN VAR: `hediye_gecmisi` her hediyede oda_id, gonderen_id ve
-- toplam_deger yazıyor (temel şemanın trigger'ı hesaplıyor). Tek eksik
-- okuma yoluydu.
--
-- PENCERE saat cinsinden: istemcideki iki sekme 24 ve 168 (7 gün) gönderiyor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.oda_katki(p_oda BIGINT, p_saat INTEGER DEFAULT 24)
RETURNS TABLE (
    sira        INTEGER,
    kullanici_id BIGINT,
    ad          TEXT,
    public_id   TEXT,
    foto        TEXT,
    toplam      BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    WITH t AS (
        SELECT h.gonderen_id AS kid, SUM(h.toplam_deger)::BIGINT AS top
          FROM public.hediye_gecmisi h
         WHERE h.oda_id = p_oda
           AND h.gonderen_id IS NOT NULL
           AND h.gonderilme_tarihi > now() - make_interval(hours => GREATEST(COALESCE(p_saat, 24), 1))
         GROUP BY h.gonderen_id
        HAVING SUM(h.toplam_deger) > 0
    )
    SELECT (ROW_NUMBER() OVER (ORDER BY t.top DESC, t.kid))::INTEGER,
           t.kid,
           COALESCE(k.kullanici_adi, 'Kullanıcı')::TEXT,
           k.public_id::TEXT,
           k.profil_resmi::TEXT,
           t.top
      FROM t
      LEFT JOIN public.kullanicilar k ON k.id = t.kid
     ORDER BY t.top DESC, t.kid
     LIMIT 50;
$fn$;

REVOKE ALL ON FUNCTION public.oda_katki(BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_katki(BIGINT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA (oda id'sini kendi odanla değiştir):
--   SELECT * FROM public.oda_katki(9, 24);
-- Hiç hediye gönderilmemişse BOŞ döner — bu doğru davranış, eskiden
-- uydurma sayılar geliyordu.
-- ---------------------------------------------------------------------------
