-- ============================================================================
-- 080_para_sistemi_birlestirme.sql
-- "Yönetimden verilen bakiye gelmiyor" + "altın hesabın donuk"
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 079'dan SONRA. İdempotent (CREATE OR REPLACE, imzalar aynı).
--
-- CANLI TEŞHİSLE BULUNDU (tahmin değil — pg_get_functiondef + pg_trigger
-- dökümü alındı, 3 Eylül). Üç ayrı kopukluk, hepsi aynı desende:
-- UYGULAMANIN YAZDIĞI YER İLE TEMEL ŞEMANIN OKUDUĞU YER FARKLI.
--
--   1. bakiye_ekle   -> _bakiye_uygula -> `cuzdan`   | cüzdan `cached_*` okur
--   2. hesap yasağı  -> `hesap_yasaklari`            | hediye `kullanicilar.banli` okur
--   3. dondur butonu -> `cuzdan.*_dondu`             | hediye `gift_blocked` okur
--
-- Her üçünde de yönetici işlemi BAŞARILI görünüyor ama hiçbir etkisi yok.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) bakiye_ekle — temel deftere (067 CANLIDA HİÇ YOKMUŞ)
--
-- Canlı gövde `_bakiye_uygula` çağırıyordu, o da ölü `cuzdan` tablosuna
-- yazıyor. Kanıt: İRİS'e verilen 500.000 altın `cuzdan.altin`da duruyor,
-- `cached_altin_balance`ta yok. 067 yazılmış ama çalıştırılmamış; 075
-- `admin_kullanici_getir`i yeniden yazarken 067'nin panel-okuma düzeltmesini
-- taşıdığı için o kısım doğru görünüyordu ve hata gizlenmişti.
--
-- İmza 027/033/067 ile AYNI — istemcide (adminRepo.grantBalance) değişiklik yok.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bakiye_ekle(p_hedef BIGINT, p_varlik TEXT, p_miktar BIGINT, p_sebep TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ref TEXT := COALESCE(NULLIF(p_sebep, ''), 'admin');
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bakiye işlemi için yönetici olmalısın.';
    END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN
        RAISE EXCEPTION 'Geçersiz varlık.';
    END IF;
    IF p_miktar = 0 THEN RETURN; END IF;

    IF p_miktar > 0 THEN
        PERFORM public.lot_yatir(p_hedef, p_varlik::varlik_tipi,
                                 'admin_grant'::bakiye_kaynagi, p_miktar,
                                 'admin_ekleme'::islem_tipi, v_ref);
    ELSE
        BEGIN
            PERFORM public.lot_harca(p_hedef, p_varlik::varlik_tipi, abs(p_miktar),
                                     'duzeltme'::islem_tipi, v_ref);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM ILIKE '%bakiye%' OR SQLERRM ILIKE '%yetersiz%' OR SQLSTATE = '23514' THEN
                RAISE EXCEPTION 'Kullanıcının bakiyesi bu kadar düşmeye yetmiyor.';
            END IF;
            RAISE;
        END;
    END IF;

    PERFORM public._yonetici_log('kullanici', p_hedef,
        CASE WHEN p_miktar > 0 THEN 'bakiye_ekle' ELSE 'bakiye_dus' END,
        (CASE WHEN p_varlik = 'elmas' THEN 'Elmas ' ELSE 'Altın ' END) || abs(p_miktar)::text
        || COALESCE(' · ' || p_sebep, ''));
END; $fn$;
REVOKE ALL ON FUNCTION public.bakiye_ekle(BIGINT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bakiye_ekle(BIGINT, TEXT, BIGINT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Hesap yasağı `kullanicilar.banli` ile SENKRON
--
-- Temel şemanın hediye trigger'ı (`hediye_gonder_fn`) şunu kontrol ediyor:
--     IF EXISTS (... AND (economy_frozen OR gift_blocked OR banli))
--         RAISE EXCEPTION 'Gonderen ekonomisi kisitli veya banli'
-- Ama uygulamanın yasak sistemi `hesap_yasaklari` tablosunda; repoda
-- `kullanicilar.banli` kolonuna yazan TEK BİR SATIR YOK. Judas'ta (id 9) bu
-- bayrak takılı kalmış ve hediye göndermesini engelliyordu — kullanıcının
-- gördüğü "altın hesabın donuk" hatası buydu.
--
-- Artık tek yönetici işlemi ikisini birden yönetiyor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hesap_yasak_ver(p_hedef BIGINT, p_sebep TEXT DEFAULT NULL, p_dakika INT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bitis TIMESTAMPTZ; v_hedef TEXT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Hesap yasağı için yönetici olmalısın.';
    END IF;
    IF p_hedef = public.benim_kullanici_id() THEN
        RAISE EXCEPTION 'Kendini yasaklayamazsın.';
    END IF;
    SELECT ekonomi_rolu::text INTO v_hedef FROM public.kullanicilar WHERE id = p_hedef;
    IF v_hedef IN ('developer', 'super_admin') AND NOT public.ben_developer() THEN
        RAISE EXCEPTION 'Yöneticiyi yalnızca developer yasaklayabilir.';
    END IF;
    IF p_dakika IS NOT NULL THEN
        IF p_dakika <= 0 THEN RAISE EXCEPTION 'Süre pozitif olmalı (ya da kalıcı için boş bırak).'; END IF;
        v_bitis := now() + make_interval(mins => p_dakika);
    END IF;
    INSERT INTO public.hesap_yasaklari (kullanici_id, sebep, yasaklayan_id, bitis)
    VALUES (p_hedef, p_sebep, public.benim_kullanici_id(), v_bitis)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET sebep = EXCLUDED.sebep, yasaklayan_id = EXCLUDED.yasaklayan_id,
            bitis = EXCLUDED.bitis, olusturma = now();

    -- 080: temel şema bu kolonu okuyor, senkron tutuyoruz.
    UPDATE public.kullanicilar SET banli = TRUE WHERE id = p_hedef;

    PERFORM public._yonetici_log('kullanici', p_hedef, 'hesap_yasak_ver',
        (CASE WHEN v_bitis IS NULL THEN 'Kalıcı' ELSE to_char(v_bitis, 'YYYY-MM-DD HH24:MI') END)
        || COALESCE(' · ' || p_sebep, ''));
END; $$;
REVOKE ALL ON FUNCTION public.hesap_yasak_ver(BIGINT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hesap_yasak_ver(BIGINT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.hesap_yasak_kaldir(p_hedef BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yasak kaldırma için yönetici olmalısın.';
    END IF;
    DELETE FROM public.hesap_yasaklari WHERE kullanici_id = p_hedef;
    -- 080: yasak kalkınca ekonomi kilidi de kalkmalı. Eskiden kalkmıyordu.
    UPDATE public.kullanicilar SET banli = FALSE WHERE id = p_hedef;
    PERFORM public._yonetici_log('kullanici', p_hedef, 'hesap_yasak_kaldir', NULL);
END; $$;
REVOKE ALL ON FUNCTION public.hesap_yasak_kaldir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hesap_yasak_kaldir(BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Dondurma butonu artık GERÇEKTEN donduruyor
--
-- `admin_varlik_dondur` yalnız `cuzdan.*_dondu` yazıyordu. O bayrağı okuyan
-- tek yer `bakiye_transfer` (027) ve onu hiçbir ekran çağırmıyor — yani buton
-- görsel olarak çalışıyor, işlevsel olarak HİÇBİR ŞEY yapmıyordu.
--
-- Temel şemanın okuduğu kolonlara da yazıyoruz:
--   altın dondur → gift_blocked            (altının ana harcama yolu hediye)
--   elmas dondur → coin_conversion_blocked (elmasın ana yolu altına dönüşüm)
-- `cuzdan` bayrakları da korunuyor (panel onları gösteriyor, 067/075).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_varlik_dondur(p_hedef BIGINT, p_varlik TEXT, p_dondur BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Dondurma işlemi için yönetici olmalısın.';
    END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN
        RAISE EXCEPTION 'Geçersiz varlık.';
    END IF;
    INSERT INTO public.cuzdan (kullanici_id) VALUES (p_hedef)
    ON CONFLICT (kullanici_id) DO NOTHING;

    IF p_varlik = 'elmas' THEN
        UPDATE public.cuzdan SET elmas_dondu = p_dondur, guncelleme = now() WHERE kullanici_id = p_hedef;
        UPDATE public.kullanicilar SET coin_conversion_blocked = p_dondur WHERE id = p_hedef;
    ELSE
        UPDATE public.cuzdan SET altin_dondu = p_dondur, guncelleme = now() WHERE kullanici_id = p_hedef;
        UPDATE public.kullanicilar SET gift_blocked = p_dondur WHERE id = p_hedef;
    END IF;

    PERFORM public._yonetici_log('kullanici', p_hedef,
        CASE WHEN p_dondur THEN 'varlik_dondur' ELSE 'varlik_coz' END,
        CASE WHEN p_varlik = 'elmas' THEN 'Elmas' ELSE 'Altın' END);
END; $$;
REVOKE ALL ON FUNCTION public.admin_varlik_dondur(BIGINT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_varlik_dondur(BIGINT, TEXT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) TAKILI KALMIŞ BAYRAKLARI TEMİZLE (tek seferlik veri düzeltmesi)
--
-- Yukarıdakiler bundan SONRASINI düzeltir; bu blok GEÇMİŞTE takılı kalanları
-- çözer. `hesap_yasaklari`nda AKTİF kaydı olmayan kimse `banli` kalmamalı.
-- Judas (id 9) tam olarak bu durumdaydı.
-- ---------------------------------------------------------------------------
UPDATE public.kullanicilar k
   SET banli = FALSE
 WHERE k.banli
   AND NOT EXISTS (
        SELECT 1 FROM public.hesap_yasaklari h
         WHERE h.kullanici_id = k.id
           AND (h.bitis IS NULL OR h.bitis > now()));

-- Dondurma bayrakları senkronlansın (cuzdan = panelin gösterdiği kaynak).
UPDATE public.kullanicilar k
   SET gift_blocked = COALESCE(c.altin_dondu, FALSE),
       coin_conversion_blocked = COALESCE(c.elmas_dondu, FALSE)
  FROM public.cuzdan c
 WHERE c.kullanici_id = k.id
   AND (k.gift_blocked IS DISTINCT FROM COALESCE(c.altin_dondu, FALSE)
     OR k.coin_conversion_blocked IS DISTINCT FROM COALESCE(c.elmas_dondu, FALSE));
