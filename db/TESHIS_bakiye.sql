-- ============================================================================
-- TESHIS_bakiye.sql — para sisteminin TAM DOKUMU (salt okunur)
-- ----------------------------------------------------------------------------
-- Hicbir seyi DEGISTIRMEZ. Supabase SQL Editor'a yapistir, calistir,
-- donen tek hucreyi kopyalayip sohbete yapistir.
--
-- public_id yazmana GEREK YOK — sorgu tutarsiz kullanicilari kendisi buluyor.
-- ============================================================================

SELECT jsonb_pretty(jsonb_build_object(

  ----------------------------------------------------------------- 1. FONKSIYONLAR
  -- Para yolundaki her fonksiyonun TAM kaynagi. Hangi surumun yuklu oldugunu
  -- ve neyin olu `cuzdan` tablosuna baktigini buradan gorecegim.
  'fonksiyonlar', (
    SELECT COALESCE(jsonb_object_agg(ad, kaynak), '{}'::jsonb) FROM (
      SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS ad,
             pg_get_functiondef(p.oid) AS kaynak
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
        AND p.proname IN (
          'bakiye_ekle','admin_bakiye_ekle','_bakiye_uygula','bakiye_transfer',
          'lot_yatir','lot_harca','_altin_harca','_odul_ver',
          'benim_bakiyem','benim_bakiyem_v2','hediye_gonder_v2','esya_satin_al',
          'admin_kullanici_getir','admin_varlik_dondur','elmas_altin_donustur')
    ) f),

  ----------------------------------------------------------------- 2. TRIGGERLAR
  -- EN KRITIK PARCA: hediye parasini tasiyan trigger repoda YOK (temel sema
  -- Supabase'te elle kurulmus). Tam kaynagi burada gelecek.
  'triggerlar', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'tablo', c.relname,
             'trigger', t.tgname,
             'ne_zaman', CASE WHEN (t.tgtype & 2) > 0 THEN 'BEFORE' ELSE 'AFTER' END,
             'olay', CASE WHEN (t.tgtype & 4) > 0 THEN 'INSERT'
                          WHEN (t.tgtype & 8) > 0 THEN 'DELETE'
                          WHEN (t.tgtype & 16) > 0 THEN 'UPDATE' ELSE '?' END,
             'fonksiyon', pr.proname,
             'kaynak', pg_get_functiondef(pr.oid))), '[]'::jsonb)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc pr ON pr.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND c.relname IN ('hediye_gecmisi','balance_lots','wallet_ledger',
                        'cuzdan','kullanicilar','cuzdan_hareketleri')),

  ----------------------------------------------------------------- 3. KOLONLAR
  'kolonlar', (
    SELECT COALESCE(jsonb_object_agg(tablo, kols), '{}'::jsonb) FROM (
      SELECT table_name AS tablo,
             jsonb_agg(column_name || ' ' || data_type ORDER BY ordinal_position) AS kols
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('kullanicilar','cuzdan','balance_lots','wallet_ledger',
                           'hediye_gecmisi','hediyeler','cuzdan_hareketleri')
      GROUP BY table_name) k),

  ----------------------------------------------------------------- 4. ENUMLAR
  'enumlar', (
    SELECT COALESCE(jsonb_object_agg(tip, etiketler), '{}'::jsonb) FROM (
      SELECT t.typname AS tip, jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS etiketler
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('varlik_tipi','islem_tipi','bakiye_kaynagi','yon','ekonomi_rolu')
      GROUP BY t.typname) en),

  ----------------------------------------------------------------- 5. TUTARSIZLIK
  -- cached_altin_balance ile balance_lots toplami TUTMALI. Tutmuyorsa cache
  -- bozuk demektir ve asil ariza budur.
  'cache_vs_lot_tutarsizlik', (
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM (
      SELECT k.id, k.kullanici_adi, k.public_id,
             COALESCE(k.cached_altin_balance, 0) AS cache_altin,
             COALESCE(l.lot_altin, 0)            AS lot_altin,
             COALESCE(k.cached_altin_balance, 0) - COALESCE(l.lot_altin, 0) AS fark,
             COALESCE(c.altin, 0)      AS olu_cuzdan_altin,
             COALESCE(c.altin_dondu, FALSE) AS altin_dondu,
             COALESCE(c.elmas_dondu, FALSE) AS elmas_dondu
      FROM public.kullanicilar k
      LEFT JOIN public.cuzdan c ON c.kullanici_id = k.id
      LEFT JOIN (SELECT kullanici_id, SUM(kalan_miktar) AS lot_altin
                   FROM public.balance_lots
                  WHERE varlik = 'altin'::varlik_tipi
                  GROUP BY kullanici_id) l ON l.kullanici_id = k.id
      WHERE COALESCE(k.cached_altin_balance,0) <> COALESCE(l.lot_altin,0)
         OR COALESCE(c.altin,0) > 0
         OR COALESCE(c.altin_dondu,FALSE) OR COALESCE(c.elmas_dondu,FALSE)
      ORDER BY abs(COALESCE(k.cached_altin_balance,0) - COALESCE(l.lot_altin,0)) DESC
      LIMIT 25) x),

  ----------------------------------------------------------------- 6. SON HAREKETLER
  'son_defter_satirlari', (
    SELECT COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb) FROM (
      SELECT l.olusturulma_tarihi AS tarih, l.kullanici_id, l.varlik::text,
             l.yon::text, l.islem::text, l.miktar, l.bakiye_sonrasi, l.aciklama
      FROM public.wallet_ledger l
      ORDER BY l.olusturulma_tarihi DESC LIMIT 20) w),

  'son_yonetici_islemleri', (
    SELECT COALESCE(jsonb_agg(to_jsonb(y)), '[]'::jsonb) FROM (
      SELECT g.tarih, g.hedef_id, g.islem, g.detay
      FROM public.yonetici_islem_log g
      WHERE g.islem LIKE 'bakiye%' OR g.islem LIKE 'varlik%'
      ORDER BY g.tarih DESC LIMIT 15) y),

  'son_hediyeler', (
    SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb) FROM (
      SELECT g.gonderilme_tarihi AS tarih, g.gonderen_id, g.alici_id, g.hediye_id,
             g.miktar, g.birim_fiyat, g.toplam_deger, g.kazanc_miktari
      FROM public.hediye_gecmisi g
      ORDER BY g.id DESC LIMIT 10) h)

)) AS teshis;
