-- ============================================================================
-- TESHIS_bakiye.sql — "altın donuk" + "yönetimden verilen bakiye gelmiyor"
-- ----------------------------------------------------------------------------
-- SADECE OKUR. Hiçbir şeyi değiştirmez, güvenle çalıştırılabilir.
--
-- NEDEN: iki belirti de aynı yere işaret ediyor — kayıt düşüyor ama bakiye
-- güncellenmiyor. Sebebi tahmin etmeden önce canlıda NE OLDUĞUNU görmek
-- gerekiyor: hangi fonksiyon sürümü yüklü, hediye parasını hangi trigger
-- taşıyor, ve o trigger ölü `cuzdan` tablosuna mı bakıyor.
--
-- Kolon adları db/SEMA_DOKUMU.md'den doğrulandı (uydurma yok).
--
-- KULLANIM: aşağıdaki satıra etkilenen kullanıcının public_id'sini yaz,
-- tamamını Supabase SQL Editor'a yapıştır, dönen tek satırı sohbete geri
-- yapıştır.
-- ============================================================================

WITH hedef AS (
    -- ⬇⬇⬇ ETKİLENEN KULLANICININ public_id'si ⬇⬇⬇
    SELECT id FROM public.kullanicilar WHERE public_id = 'BURAYA_PUBLIC_ID' LIMIT 1
)
SELECT jsonb_pretty(jsonb_build_object(

  -- 1) 067 canlıda mı? Yeni sürüm `lot_yatir`, eskisi `_bakiye_uygula` kullanır.
  'bakiye_ekle_surumu', (
    SELECT CASE
      WHEN pg_get_functiondef(p.oid) ILIKE '%lot_yatir%'      THEN '067 YUKLU (temel defter)'
      WHEN pg_get_functiondef(p.oid) ILIKE '%_bakiye_uygula%' THEN 'ESKI SURUM (olu cuzdan tablosu)'
      ELSE 'BILINMEYEN'
    END
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'bakiye_ekle' LIMIT 1),

  -- 2) Hediye parasını hangi trigger taşıyor, neye bakıyor?
  'hediye_triggerlari', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'trigger', t.tgname,
             'fonksiyon', pr.proname,
             'cuzdan_kullaniyor', pg_get_functiondef(pr.oid) ILIKE '%cuzdan%',
             'lot_kullaniyor',    (pg_get_functiondef(pr.oid) ILIKE '%lot_harca%'
                                   OR pg_get_functiondef(pr.oid) ILIKE '%lot_yatir%'),
             'dondu_kontrolu',    pg_get_functiondef(pr.oid) ILIKE '%dondu%')), '[]'::jsonb)
    FROM pg_trigger t
    JOIN pg_proc pr ON pr.oid = t.tgfoid
    WHERE t.tgrelid = 'public.hediye_gecmisi'::regclass AND NOT t.tgisinternal),

  -- 3) İKİ kaynak birbirini tutuyor mu + dondurma bayrağı
  'kullanici', (
    SELECT jsonb_build_object(
             'id', k.id, 'ad', k.kullanici_adi,
             'cached_altin',  COALESCE(k.cached_altin_balance, 0),
             'cached_toplam', COALESCE(k.cached_total_balance, 0),
             'cuzdan_altin',  COALESCE(c.altin, 0),
             'cuzdan_elmas',  COALESCE(c.elmas, 0),
             'ALTIN_DONDU',   COALESCE(c.altin_dondu, FALSE),
             'ELMAS_DONDU',   COALESCE(c.elmas_dondu, FALSE))
    FROM public.kullanicilar k
    LEFT JOIN public.cuzdan c ON c.kullanici_id = k.id
    WHERE k.id = (SELECT id FROM hedef)),

  -- 4) Temel defterde satır var mı? Admin verdiyse BURADA olmalı.
  'son_defter_satirlari', (
    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM (
      SELECT w.olusturulma_tarihi AS tarih, w.varlik::text, w.yon::text,
             w.islem::text, w.miktar, w.bakiye_sonrasi, w.aciklama
      FROM public.wallet_ledger w
      WHERE w.kullanici_id = (SELECT id FROM hedef)
      ORDER BY w.olusturulma_tarihi DESC LIMIT 10) s),

  -- 5) Lot toplamı cache ile tutuyor mu? Tutmuyorsa cache bozuk.
  'lot_toplami_altin', (
    SELECT COALESCE(SUM(b.kalan_miktar), 0)
    FROM public.balance_lots b
    WHERE b.kullanici_id = (SELECT id FROM hedef)
      AND b.varlik = 'altin'::varlik_tipi),

  -- 6) "Eklendi" diyen yönetici kaydı
  'son_yonetici_islemleri', (
    SELECT COALESCE(jsonb_agg(to_jsonb(y)), '[]'::jsonb) FROM (
      SELECT l.tarih, l.islem, l.detay
      FROM public.yonetici_islem_log l
      WHERE l.hedef_id = (SELECT id FROM hedef) AND l.hedef_tip = 'kullanici'
      ORDER BY l.tarih DESC LIMIT 5) y)

)) AS teshis;
