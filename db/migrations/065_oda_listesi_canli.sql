-- ============================================================================
-- 065 — Oda listesini canlı yayına al
--
-- SORUN: yeni açılan oda listede 15-20 saniye (bazen daha geç) görünüyordu.
-- Sebep Supabase değil, bizim tasarımımızdı: oda listesi yalnızca ekran
-- ODAKLANDIĞINDA yeniden çekiliyor (useCachedResource → useFocusEffect).
-- Listeye bakarken duruyorsan hiçbir şey sorgu atmıyor; sekme değiştirip
-- döndüğünde "birden" beliriyor. "Oda boşalınca hemen gidiyor" da aynı şey:
-- odadan çıkıp listeye dönmek zaten bir odaklanma olduğu için anında
-- tazeleniyordu.
--
-- ÇÖZÜM: `odalar` tablosunu Realtime yayınına ekliyoruz. Böylece INSERT
-- (yeni oda), UPDATE (katılımcı sayısı, ad, kapak, işlem işareti) ve DELETE
-- istemciye anında düşüyor; liste sorgu atmadan tazeleniyor.
--
-- Realtime, postgres_changes'te RLS'i UYGULAR: kullanıcı yalnızca kendi
-- SELECT politikasının izin verdiği satırların değişimini görür. Yani ek bir
-- veri açığı oluşmuyor.
-- ============================================================================

-- Yayın yoksa (self-host / farklı kurulum) oluştur.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Tabloyu yayına ekle (zaten ekliyse dokunma).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'odalar'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.odalar;
    END IF;
END $$;

-- DELETE olayında eski satırın kimliği gelsin ki liste doğru satırı düşürsün.
-- (Varsayılan REPLICA IDENTITY birincil anahtarı taşır; odalar'da PK var,
-- bu yüzden FULL'e gerek yok — FULL her UPDATE'te tüm satırı WAL'a yazar.)
ALTER TABLE public.odalar REPLICA IDENTITY DEFAULT;
