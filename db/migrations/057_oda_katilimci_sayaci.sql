-- ============================================================================
-- 057_oda_katilimci_sayaci.sql — Odadaki kişi sayısını GERÇEKTEN yaz
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 003 (benim_kullanici_id)'den SONRA.
--
-- SORUN: `odalar.aktif_katilimci_sayisi` her yerde OKUNUYOR ama hiçbir yerde
-- YAZILMIYORDU. Kolon oda kurulduğunda 0 kalıyor, kimse odaya girse bile
-- artmıyordu. Oda listesi ise "boş odaları gösterme" kuralını bu kolona
-- bakarak uyguluyor:
--
--     gorunur = odalar.filter(r => ... && r.online > 0)
--
-- Yani YENİ KURULAN HİÇBİR ODA hiçbir sekmede (Keşfet/Popüler/Yeni/Resmî)
-- görünmüyordu — içinde insan olsa bile. Kişi sayısı yalnızca Realtime
-- presence'ta yaşıyor, presence de veritabanına hiç düşmüyordu.
--
-- ÇÖZÜM: odadaki istemcilerden biri (en küçük kullanıcı id'sine sahip olan)
-- presence'taki gerçek sayıyı buraya yazar; son çıkan 0 yazar.
--
-- NOT: Sunucu tarafında presence doğrulaması yok, yani sayı ADVISORY'dir —
-- kötü niyetli bir istemci kendi odasına şişik sayı yazabilir. Değer yine de
-- makul bir aralığa kırpılıyor. Kalıcı çözüm sunucu taraflı presence (Faz 4).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.oda_katilimci_yaz(p_oda_id BIGINT, p_sayi INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN
        RETURN; -- oturumsuz istemci sayaç yazamaz
    END IF;

    UPDATE public.odalar
       SET aktif_katilimci_sayisi = LEAST(GREATEST(COALESCE(p_sayi, 0), 0), 5000)
     WHERE id = p_oda_id;
END; $$;

REVOKE ALL ON FUNCTION public.oda_katilimci_yaz(BIGINT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oda_katilimci_yaz(BIGINT, INTEGER) TO authenticated;

-- Var olan odalar 0'da takılı kaldı; kimse içeride olmadığı için doğru değer
-- zaten 0. Bir sonraki girişte istemci gerçek sayıyı yazacak.
