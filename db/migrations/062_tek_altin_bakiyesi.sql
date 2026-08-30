-- ============================================================================
-- 062 — Tek altın bakiyesi (mağaza + cüzdan, temel şemaya)
--
-- Önce 060 ve 061 çalıştırılmalı (`_enum_etiket` 061'de tanımlı).
--
-- SORUN:
-- 059 ile hediye gönderimi TEMEL şemanın defterine geçti: altın
-- `balance_lots`tan `lot_harca` ile düşüyor, bakiye
-- `kullanicilar.cached_altin_balance`ta duruyor.
-- Ama mağaza (056) hâlâ bizim eski `cuzdan` tablomuzdan harcıyor ve
-- `benim_bakiyem()` de orayı okuyor. Yani 059'dan sonra kullanıcının İKİ ayrı
-- altını olacaktı: hediye kutusu bir rakam, mağaza/cüzdan/profil başka bir
-- rakam gösterecekti. Altın yüklemesi (admin_altin_yukle) yalnız temel deftere
-- yazdığı için mağaza sürekli "Yetersiz altın" derdi.
--
-- ÇÖZÜM:
-- Tablolar yerinde kalıyor (esyalar / kullanici_esyalari değişmiyor).
-- Yalnızca ALTININ NEREDEN DÜŞTÜĞÜ ve NEREDEN OKUNDUĞU tek yere çekiliyor.
-- Böylece istemcide tek satır değişmeden profil, cüzdan, mağaza ve hediye
-- kutusu aynı sayıyı gösteriyor.
--
-- Eski `cuzdan` tablosu SİLİNMİYOR: içinde test bakiyeleri var ve geri dönmek
-- gerekirse duruyor. Sadece artık kimse okumuyor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Altın harcama yardımcısı — enum etiketleri çalışma anında çözülüyor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._altin_harca(p_kullanici BIGINT, p_miktar BIGINT, p_ref TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_islem  TEXT;
    v_bakiye BIGINT;
BEGIN
    IF p_miktar <= 0 THEN
        SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
        RETURN COALESCE(v_bakiye, 0);
    END IF;

    v_islem := public._enum_etiket('islem_tipi',
        ARRAY['magaza', 'magaza_harcama', 'esya_satin_alma', 'satin_alma',
              'harcama', 'esya', 'hediye_gonderme']);
    IF v_islem IS NULL THEN
        RAISE EXCEPTION 'islem_tipi icinde uygun etiket yok. Mevcut: %',
            public._enum_liste('islem_tipi');
    END IF;

    BEGIN
        EXECUTE format(
            'SELECT public.lot_harca($1, %L::varlik_tipi, $2, %L::islem_tipi, %L)',
            'altin', v_islem, p_ref)
        USING p_kullanici, p_miktar;
    EXCEPTION WHEN OTHERS THEN
        -- Yetersiz bakiye mesajı ekranda tek ve anlaşılır olsun diye
        -- normalleştiriliyor; BAŞKA bir hata ise olduğu gibi yukarı gidiyor
        -- (yoksa yanlış enum etiketi de "Yetersiz altın" diye görünürdü).
        IF SQLERRM ILIKE '%bakiye%' OR SQLERRM ILIKE '%yetersiz%' OR SQLSTATE = '23514' THEN
            RAISE EXCEPTION 'Yetersiz altın.';
        END IF;
        RAISE;
    END;

    SELECT cached_altin_balance INTO v_bakiye FROM public.kullanicilar WHERE id = p_kullanici;
    RETURN COALESCE(v_bakiye, 0);
END; $$;
REVOKE ALL ON FUNCTION public._altin_harca(BIGINT, BIGINT, TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2) Mağaza satın alması artık temel defterden harcıyor
--
-- Gövde 056'daki ile aynı; değişen tek şey bakiye satırı ve dönen değerler.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.esya_satin_al(p_esya_id TEXT)
RETURNS TABLE (elmas BIGINT, altin BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben        BIGINT := public.benim_kullanici_id();
    v_esya       public.esyalar%ROWTYPE;
    v_mevcut     public.kullanici_esyalari%ROWTYPE;
    v_yeni_bitis TIMESTAMPTZ;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    SELECT * INTO v_esya FROM public.esyalar WHERE id = p_esya_id AND aktif;
    IF NOT FOUND THEN RAISE EXCEPTION 'Eşya bulunamadı.'; END IF;

    SELECT * INTO v_mevcut
      FROM public.kullanici_esyalari
     WHERE kullanici_id = v_ben AND esya_id = p_esya_id;

    -- Süresiz eşyayı ikinci kez satmayalım.
    IF FOUND AND v_mevcut.bitis IS NULL THEN
        RAISE EXCEPTION 'Bu eşya zaten sende.';
    END IF;

    PERFORM public._altin_harca(v_ben, v_esya.fiyat_altin, 'esya:' || v_esya.id);

    -- Süreli eşyada: kalan süre varsa üstüne eklenir, yoksa bugünden başlar.
    IF v_esya.sure_gun IS NULL THEN
        v_yeni_bitis := NULL;
    ELSE
        v_yeni_bitis := GREATEST(now(), COALESCE(v_mevcut.bitis, now()))
                        + (v_esya.sure_gun || ' days')::INTERVAL;
    END IF;

    INSERT INTO public.kullanici_esyalari (kullanici_id, esya_id, bitis)
    VALUES (v_ben, p_esya_id, v_yeni_bitis)
    ON CONFLICT (kullanici_id, esya_id) DO UPDATE
        SET bitis = EXCLUDED.bitis;

    RETURN QUERY
        SELECT COALESCE(k.cached_total_balance, 0), COALESCE(k.cached_altin_balance, 0)
          FROM public.kullanicilar k WHERE k.id = v_ben;
END; $$;
REVOKE ALL ON FUNCTION public.esya_satin_al(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esya_satin_al(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) benim_bakiyem() artık temel defteri okuyor
--
-- İmza aynı kaldığı için profil, cüzdan ve mağaza ekranlarında tek satır
-- değişmiyor; sadece okudukları sayı doğru yerden geliyor.
--   elmas = cached_total_balance      (satın alınan ana varlık)
--   altin = cached_altin_balance      (hediye/mağaza parası)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.benim_bakiyem()
RETURNS TABLE (elmas BIGINT, altin BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE(k.cached_total_balance, 0), COALESCE(k.cached_altin_balance, 0)
      FROM public.kullanicilar k
     WHERE k.id = public.benim_kullanici_id();
$$;
REVOKE ALL ON FUNCTION public.benim_bakiyem() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.benim_bakiyem() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Cüzdan hareketleri — gerçek defterden
--
-- Cüzdan ekranı `cuzdan_hareketleri` tablosunu okuyordu; artık hareketler
-- `wallet_ledger`a yazılıyor, o tablo susuyor. Enum sütunları metne
-- çevriliyor ki istemci enum etiketlerini bilmek zorunda kalmasın.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hareketlerim_v2(p_limit INTEGER DEFAULT 40)
RETURNS TABLE (id BIGINT, varlik TEXT, miktar BIGINT, aciklama TEXT, tarih TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT w.id,
           w.varlik::TEXT,
           CASE WHEN w.yon::TEXT ILIKE '%cik%' OR w.yon::TEXT ILIKE '%out%' OR w.yon::TEXT ILIKE '%harca%'
                THEN -w.miktar ELSE w.miktar END,
           COALESCE(NULLIF(w.aciklama, ''), w.islem::TEXT),
           w.olusturulma_tarihi
      FROM public.wallet_ledger w
     WHERE w.kullanici_id = public.benim_kullanici_id()
     ORDER BY w.olusturulma_tarihi DESC, w.id DESC
     LIMIT GREATEST(COALESCE(p_limit, 40), 1);
$$;
REVOKE ALL ON FUNCTION public.hareketlerim_v2(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hareketlerim_v2(INTEGER) TO authenticated;
