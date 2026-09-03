-- ============================================================================
-- 089_hediye_aldiklarim.sql — "Alınan" sekmesi de kendi fonksiyonumuzdan
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 088'den SONRA. İdempotent.
--
-- SORUN: "Alınan" listesi temel şemadaki `son_hediyelerim_v2`den geliyordu ve
-- oradaki `kazanc` alanı SIFIR dönüyordu — bütün satırlarda "+0" yazıyordu.
-- Özet kartı ise 088'deki `hediye_ozetim`den, o da `toplam_deger` topluyor.
-- Yani satırlar ile toplam FARKLI SÜTUNDAN besleniyordu: toplam doğru,
-- satırlar sıfır.
--
-- ÇÖZÜM: "Gönderilen" için yazdığımız `hediye_gonderdiklerim`in simetriği.
-- İkisi de `hediye_gecmisi.toplam_deger` kullanıyor, yani satırların toplamı
-- ile özet kartı artık aynı şeyi söylüyor.
--
-- NOT — HANGİ TUTAR GÖSTERİLİYOR: hediyenin YÜZ DEĞERİ (`toplam_deger`),
-- alıcının komisyon sonrası net kazancı değil. Özet kartı da öyle
-- hesaplandığı için tutarlı. Net kazanç istenirse bu fonksiyonda tek sütun
-- değişir; ama o zaman özet kartı da değişmeli, yoksa yine tutmaz.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hediye_aldiklarim(p_kullanici BIGINT, p_limit INTEGER DEFAULT 30)
RETURNS TABLE (
    id           BIGINT,
    gonderen     TEXT,
    gonderen_pid TEXT,
    kod          TEXT,
    ad           TEXT,
    emoji        TEXT,
    adet         INTEGER,
    tutar        BIGINT,
    tarih        TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    SELECT h.id,
           COALESCE(k.kullanici_adi, 'Kullanıcı')::TEXT,
           k.public_id::TEXT,
           g.kod::TEXT,
           COALESCE(g.ad, 'Hediye')::TEXT,
           COALESCE(g.emoji, '🎁')::TEXT,
           h.miktar,
           h.toplam_deger::BIGINT,
           h.gonderilme_tarihi
      FROM public.hediye_gecmisi h
      LEFT JOIN public.kullanicilar k ON k.id = h.gonderen_id
      LEFT JOIN public.hediyeler   g ON g.id = h.hediye_id
     WHERE h.alici_id = p_kullanici
     ORDER BY h.gonderilme_tarihi DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
$fn$;

REVOKE ALL ON FUNCTION public.hediye_aldiklarim(BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hediye_aldiklarim(BIGINT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA (kendi id'ni yaz): satırların `tutar` toplamı, `hediye_ozetim`in
-- `alinan` değeriyle aynı yönde olmalı (liste 30 ile sınırlı olduğu için
-- birebir eşit olmayabilir).
--   SELECT * FROM public.hediye_aldiklarim(9, 30);
-- ---------------------------------------------------------------------------
