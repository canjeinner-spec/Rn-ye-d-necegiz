-- ============================================================================
-- 088_hediye_gecmisim.sql — "Hediye Geçmişi" ekranı gerçek veriye
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 087'den SONRA. İdempotent.
--
-- SORUN: `gift-history.tsx` tamamen UYDURMAYDI. `src/data/giftHistory.ts`
-- içindeki sabit dizi gösteriliyordu: "Mervee'den taht", "Zeno Sv.'den 99 gül",
-- "Dün 22:05"… Her kullanıcı aynı sahte geçmişi görüyordu, kendi gönderdiği
-- hediye hiç görünmüyordu.
--
-- ALINAN taraf için `son_hediyelerim_v2` zaten vardı ve ekran onu
-- kullanmıyordu. GÖNDERİLEN taraf için hiçbir yol yoktu — bu dosya onu
-- ekliyor. Özet kartlarındaki iki toplam da (alınan/gönderilen) buradan.
--
-- Kullanıcı kimliği PARAMETRE olarak alınıyor (`hediye_vitrini` ile aynı
-- desen): temel şemadaki auth yardımcısının adına bağımlı kalmayalım.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hediye_gonderdiklerim(p_kullanici BIGINT, p_limit INTEGER DEFAULT 30)
RETURNS TABLE (
    id        BIGINT,
    alici     TEXT,
    alici_pid TEXT,
    kod       TEXT,
    ad        TEXT,
    emoji     TEXT,
    adet      INTEGER,
    tutar     BIGINT,
    tarih     TIMESTAMPTZ)
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
      LEFT JOIN public.kullanicilar k ON k.id = h.alici_id
      LEFT JOIN public.hediyeler   g ON g.id = h.hediye_id
     WHERE h.gonderen_id = p_kullanici
     ORDER BY h.gonderilme_tarihi DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
$fn$;

-- Özet kartları: listeden değil TABLONUN TAMAMINDAN. Listede son 30 satır var;
-- toplamı oradan hesaplamak "toplam" olmaz.
CREATE OR REPLACE FUNCTION public.hediye_ozetim(p_kullanici BIGINT)
RETURNS TABLE (alinan BIGINT, gonderilen BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    SELECT
      COALESCE((SELECT SUM(toplam_deger) FROM public.hediye_gecmisi WHERE alici_id    = p_kullanici), 0)::BIGINT,
      COALESCE((SELECT SUM(toplam_deger) FROM public.hediye_gecmisi WHERE gonderen_id = p_kullanici), 0)::BIGINT;
$fn$;

REVOKE ALL ON FUNCTION public.hediye_gonderdiklerim(BIGINT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hediye_ozetim(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hediye_gonderdiklerim(BIGINT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hediye_ozetim(BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA (kendi id'ni yaz):
--   SELECT * FROM public.hediye_gonderdiklerim(9, 30);
--   SELECT * FROM public.hediye_ozetim(9);
-- Hiç hediye alıp göndermediysen BOŞ/sıfır döner — doğru davranış.
-- ---------------------------------------------------------------------------
