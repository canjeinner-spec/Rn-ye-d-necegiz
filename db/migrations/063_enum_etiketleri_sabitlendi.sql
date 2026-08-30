-- ============================================================================
-- 063 — Enum etiketleri sabitlendi + anon'dan EXECUTE geri alındı
--
-- 059-062 çalıştırıldıktan sonra `_enum_liste` ile GERÇEK etiketler okundu.
-- Artık tahmin yok, hepsi `db/SEMA_DOKUMU.md` → "Enum tipleri" bölümünde.
--
--   bakiye_kaynagi : earned, purchased, campaign, admin_grant, bonus, gift, refund
--   islem_tipi     : hediye_gonderim, hediye_kazanc, elmas_satin_alma,
--                    elmas_transfer_gonderim, elmas_transfer_alim,
--                    elmas_altin_donusum, cuzdan_elmas_donusum, kota_donusum,
--                    kota_odeme, ajans_komisyonu, platform_geliri,
--                    magaza_satin_alma, vip_satin_alma, cekim, cekim_iade,
--                    admin_ekleme, kampanya_odulu, referans_odulu, iade, duzeltme
--   hareket_yonu   : giris, cikis
--
-- DÜZELTİLEN İKİ ŞEY:
--
-- 1) `_altin_harca` KIRIKTI. Aday listesinde 'magaza', 'satin_alma',
--    'harcama' vardı; gerçeği **magaza_satin_alma**. Hiçbir aday tutmadığı
--    için her mağaza satın alması "islem_tipi icinde uygun etiket yok"
--    hatasıyla düşerdi.
--
-- 2) `_odul_ver` çalışıyordu ama yanlış kovaya yazıyordu: aday listesinden
--    'bonus' + 'admin_ekleme' seçilirdi, yani görev ödülü yönetici eklemesi
--    gibi görünürdü. Doğrusu **campaign** kaynağı + **kampanya_odulu** işlemi.
--
-- AYRICA: Supabase, public şemada yeni açılan fonksiyonlara varsayılan olarak
-- anon EXECUTE veriyor. `REVOKE ... FROM PUBLIC` bu açık grant'ı kaldırmıyor.
-- Ölçtük: giriş yapmamış biri publishable anahtarla `siralama_zenginlik`i
-- çağırabiliyordu (veri henüz boş olduğu için bir şey sızmadı). Aşağıda
-- 059-062'nin bütün fonksiyonlarından anon EXECUTE açıkça geri alınıyor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Mağaza harcaması — doğru etiketle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._altin_harca(p_kullanici BIGINT, p_miktar BIGINT, p_ref TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bakiye BIGINT;
BEGIN
    IF p_miktar > 0 THEN
        BEGIN
            PERFORM public.lot_harca(p_kullanici, 'altin'::varlik_tipi, p_miktar,
                                     'magaza_satin_alma'::islem_tipi, p_ref);
        EXCEPTION WHEN OTHERS THEN
            -- Yetersiz bakiye ekranda tek ve anlaşılır görünsün; başka bir
            -- hata olduğu gibi yukarı gitsin, yoksa gerçek arıza gizlenir.
            IF SQLERRM ILIKE '%bakiye%' OR SQLERRM ILIKE '%yetersiz%' OR SQLSTATE = '23514' THEN
                RAISE EXCEPTION 'Yetersiz altın.';
            END IF;
            RAISE;
        END;
    END IF;

    SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
    RETURN COALESCE(v_bakiye, 0);
END; $$;
REVOKE ALL ON FUNCTION public._altin_harca(BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Görev / günlük giriş ödülü — kampanya kovasına
--
-- `campaign` kaynağı promo tarafına düşer (cached_promo_balance): ödül altını
-- hediyeye harcanır ama çekilemez. Satın alınan `purchased` altınıyla
-- karışmaması ekonominin temel kuralı.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._odul_ver(p_kullanici BIGINT, p_miktar BIGINT, p_ref TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bakiye BIGINT;
BEGIN
    IF p_miktar > 0 THEN
        PERFORM public.lot_yatir(p_kullanici, 'altin'::varlik_tipi,
                                 'campaign'::bakiye_kaynagi, p_miktar,
                                 'kampanya_odulu'::islem_tipi, p_ref);
    END IF;

    SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
    RETURN COALESCE(v_bakiye, 0);
END; $$;
REVOKE ALL ON FUNCTION public._odul_ver(BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Yönetici altın yüklemesi — sabit etiketle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_altin_yukle(p_kullanici BIGINT, p_miktar BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bakiye BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bu işlem için yönetici olmalısın.';
    END IF;
    IF p_miktar <= 0 THEN RAISE EXCEPTION 'Miktar pozitif olmalı.'; END IF;

    PERFORM public.lot_yatir(p_kullanici, 'altin'::varlik_tipi,
                             'admin_grant'::bakiye_kaynagi, p_miktar,
                             'admin_ekleme'::islem_tipi, 'admin');

    SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
    RETURN COALESCE(v_bakiye, 0);
END; $$;
REVOKE ALL ON FUNCTION public.admin_altin_yukle(BIGINT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_altin_yukle(BIGINT, BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Cüzdan hareketleri — yön artık tam eşleşmeyle
--
-- `hareket_yonu` = (giris, cikis). ILIKE '%cik%' tahminiydi; doğru çalışıyordu
-- ama etiket değişirse sessizce yanlış işaret üretirdi.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hareketlerim_v2(p_limit INTEGER DEFAULT 40)
RETURNS TABLE (id BIGINT, varlik TEXT, miktar BIGINT, aciklama TEXT, tarih TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT w.id,
           w.varlik::TEXT,
           CASE WHEN w.yon = 'cikis'::hareket_yonu THEN -w.miktar ELSE w.miktar END,
           COALESCE(NULLIF(w.aciklama, ''), w.islem::TEXT),
           w.olusturulma_tarihi
      FROM public.wallet_ledger w
     WHERE w.kullanici_id = public.benim_kullanici_id()
     ORDER BY w.olusturulma_tarihi DESC, w.id DESC
     LIMIT GREATEST(COALESCE(p_limit, 40), 1);
$$;
REVOKE ALL ON FUNCTION public.hareketlerim_v2(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hareketlerim_v2(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) anon EXECUTE'u geri al
--
-- Supabase yeni fonksiyonlara varsayılan anon grant'i veriyor; PUBLIC'ten
-- REVOKE etmek bunu kaldırmıyor. Giriş yapmamış biri sıralamayı çekebiliyordu.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.hediye_gonder_v2(INTEGER, INTEGER, BIGINT, BIGINT, VARCHAR, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.benim_bakiyem_v2()                FROM anon;
REVOKE EXECUTE ON FUNCTION public.kazanc_ozeti_v2()                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.kazanc_saatlik_v2(INTEGER)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.kazanc_gunluk_v2(INTEGER)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.son_hediyelerim_v2(INTEGER)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.hediye_komisyon()                 FROM anon;
REVOKE EXECUTE ON FUNCTION public._enum_etiket(TEXT, TEXT[])        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._enum_liste(TEXT)                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._siralama_baslangic(TEXT)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.siralama_donem_bitis(TEXT)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.siralama_zenginlik(TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.siralama_cazibe(TEXT, INTEGER)    FROM anon;
REVOKE EXECUTE ON FUNCTION public.siralama_odalar(TEXT, INTEGER)    FROM anon;
REVOKE EXECUTE ON FUNCTION public._bugun_tr()                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.gorevlerim()                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.gorev_odul_al(TEXT)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.gunluk_giris_durum()              FROM anon;
REVOKE EXECUTE ON FUNCTION public.gunluk_giris_al()                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.benim_bakiyem()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.esya_satin_al(TEXT)               FROM anon;

-- `hediyeler` katalogu anon'a SELECT'li duruyordu (politika olmadığı için boş
-- dönüyordu ama grant gereksiz).
REVOKE SELECT ON public.hediyeler FROM anon;
