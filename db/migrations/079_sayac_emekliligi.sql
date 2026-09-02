-- ============================================================================
-- 079_sayac_emekliligi.sql — İstemci yazmalı kişi sayacı emekliye ayrılıyor
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 078'den SONRA. İdempotent.
--
-- NEDEN (çift kaynak): kişi sayısı İKİ yerden geliyordu —
--   1. `odalar.aktif_katilimci_sayisi` (057): İSTEMCİ yazıyor. Oturumlu
--      HERKES HERHANGİ odaya 0-5000 arası değer yazabiliyordu; uygulama
--      öldürülünce son değer donuyor ("hayalet oda").
--   2. `oda_katilimcilar` (070): sunucu tarafı kalp atışı, 2 dk eşik —
--      güvenilir kaynak. Oda listesi görünürlüğü zaten buna geçti.
-- İki kaynak birbiriyle yarışıyordu; okurlar hangisine denk gelirse onu
-- gösteriyordu. Bu dosya 057 yolunu kapatır, kalan okurları 070'e bağlar.
--
-- `oda_katilimci_yaz` SİLİNMİYOR, no-op oluyor: sahada eski istemci sürümü
-- kalırsa çağrı patlamasın (ucuz sigorta). Kolon da kalıyor (003'ün SELECT
-- kolon listeleri bozulmasın) ama artık HEP 0.
-- ============================================================================

-- 1) Yazma yolu kapanıyor — gövde no-op.
CREATE OR REPLACE FUNCTION public.oda_katilimci_yaz(p_oda_id BIGINT, p_sayi INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 079: emekli. Kişi sayısının tek kaynağı `oda_katilimcilar` (070).
    -- İstemcinin yazdığı sayı hem güvensizdi (herkes her odaya yazabiliyordu)
    -- hem donuyordu (uygulama öldürülünce son değer kalıyordu).
    RETURN;
END; $$;
REVOKE ALL ON FUNCTION public.oda_katilimci_yaz(BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_katilimci_yaz(BIGINT, INTEGER) TO authenticated;

-- 2) Donmuş bayat değerler tek seferde temizleniyor.
UPDATE public.odalar SET aktif_katilimci_sayisi = 0 WHERE aktif_katilimci_sayisi <> 0;

-- 3) siralama_odalar: online artık canlı sayımdan. İmza/kolonlar AYNI
--    (istemci siralamaRepo değişmiyor). Sıralama PUANI hediye değerinden
--    geliyor (t.p) — online yalnız gösterim kolonu, sıra DEĞİŞMEZ.
CREATE OR REPLACE FUNCTION public.siralama_odalar(p_periyot TEXT DEFAULT 'hafta', p_limit INTEGER DEFAULT 50)
RETURNS TABLE (sira INTEGER, oda_id BIGINT, public_id TEXT, ad TEXT,
               kapak TEXT, sahip TEXT, online INTEGER, puan BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH t AS (
        SELECT h.oda_id AS oid, SUM(h.toplam_deger)::BIGINT AS p
          FROM public.hediye_gecmisi h
         WHERE h.oda_id IS NOT NULL
           AND h.gonderilme_tarihi >= public._siralama_baslangic(p_periyot)
         GROUP BY h.oda_id
    )
    SELECT (ROW_NUMBER() OVER (ORDER BY t.p DESC, o.id))::INTEGER,
           o.id, o.public_id::TEXT, o.ad::TEXT, o.kapak_url,
           COALESCE(k.kullanici_adi, '')::TEXT,
           -- 079: canlı sayım (070'in 2 dk eşiğiyle birebir)
           COALESCE((SELECT count(*)::INTEGER FROM public.oda_katilimcilar ok
                      WHERE ok.oda_id = o.id
                        AND ok.last_heartbeat > now() - INTERVAL '2 minutes'), 0),
           t.p
      FROM t
      JOIN public.odalar o ON o.id = t.oid
      LEFT JOIN public.kullanicilar k ON k.id = o.olusturan_id
     WHERE NOT o.silinmis AND NOT o.islem_gordu AND t.p > 0
     ORDER BY t.p DESC, o.id
     LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;
REVOKE ALL ON FUNCTION public.siralama_odalar(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siralama_odalar(TEXT, INTEGER) TO authenticated;

-- 4) admin_oda_getir: aynı geçiş. İmza/kolonlar AYNI (adminRepo değişmiyor).
CREATE OR REPLACE FUNCTION public.admin_oda_getir(p_oda BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, ad TEXT, aciklama TEXT, kategori TEXT, kapak_url TEXT,
    herkese_acik BOOLEAN, olusturan_id BIGINT, sahip_ad TEXT, sahip_public_id TEXT,
    uye_sayisi BIGINT, aktif_katilimci INT,
    islem_gordu BOOLEAN, islem_sebep TEXT, islem_tarihi TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT o.id::bigint, o.public_id::text, o.ad::text, o.aciklama::text, o.kategori::text, o.kapak_url::text,
           o.herkese_acik::boolean, o.olusturan_id::bigint, k.kullanici_adi::text, k.public_id::text,
           (SELECT count(*) FROM public.oda_uyeleri u WHERE u.oda_id = o.id)::bigint,
           -- 079: canlı sayım (070'in 2 dk eşiğiyle birebir)
           COALESCE((SELECT count(*)::int FROM public.oda_katilimcilar ok
                      WHERE ok.oda_id = o.id
                        AND ok.last_heartbeat > now() - INTERVAL '2 minutes'), 0),
           o.islem_gordu::boolean, o.islem_sebep::text, o.islem_tarihi
      FROM public.odalar o
      LEFT JOIN public.kullanicilar k ON k.id = o.olusturan_id
     WHERE o.id = p_oda;
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_getir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_oda_getir(BIGINT) TO authenticated;
