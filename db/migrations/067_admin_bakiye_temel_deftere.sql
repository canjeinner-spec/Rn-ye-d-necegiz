-- ============================================================================
-- 067_admin_bakiye_temel_deftere.sql
-- "Yönetimden bakiye veriyorum cüzdana gelmiyor" — 062'nin yarım kalan yarısı
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 062 ve 063'ten SONRA. (053 hâlâ bekliyorsa o da çalıştırılmalı.)
-- İdempotent: tekrar çalıştırmak zarar vermez.
--
-- SORUN (kullanıcı bildirdi, 30 Ağustos):
--   Yönetim panelinden bakiye veriliyor, panelde sayı ARTIYOR, ama
--   kullanıcının cüzdanında hiçbir şey değişmiyor.
--
-- KÖK SEBEP — 062 taşımayı yarım bıraktı. 062 altını temel deftere taşırken
-- OKUMA (`benim_bakiyem`) ve HARCAMA (`esya_satin_al`) yollarını taşıdı; ama
-- YÖNETİCİ YAZMA yolunu ve YÖNETİM PANELİNİN OKUMA yolunu taşımadı:
--
--   yazma   : bakiye_ekle -> _bakiye_uygula -> public.cuzdan      <- ÖLÜ TABLO
--   panel   : admin_kullanici_getir -> LEFT JOIN public.cuzdan    <- ÖLÜ TABLO
--   cüzdan  : benim_bakiyem()  -> kullanicilar.cached_*           <- GERÇEK (062)
--
-- İkisi de aynı ölü tabloya baktığı için işlem YÖNETİCİYE BAŞARILI GÖRÜNÜYOR.
-- Kullanıcının cüzdanı ise temel defteri okuduğundan hiç haberi olmuyor.
-- Yani hata "bakiye kaydolmuyor" değil, "iki ekran iki ayrı tabloya bakıyor".
--
-- ÇÖZÜM: yönetici yazma + panel okuma da temel deftere bağlanıyor.
--   yatırma : lot_yatir(..., 'admin_grant'::bakiye_kaynagi,
--                            'admin_ekleme'::islem_tipi)   <- 063'ün deseni
--   düşme   : lot_harca(..., 'duzeltme'::islem_tipi)
--   panel   : kullanicilar.cached_total_balance / cached_altin_balance
--
-- Enum etiketleri 063'te canlı veritabanından SABİTLENDİ, tahmin değil:
--   varlik_tipi    : elmas, altin, kazanc, fiat
--   bakiye_kaynagi : earned, purchased, campaign, admin_grant, bonus, gift, refund
--   islem_tipi     : ... admin_ekleme, kampanya_odulu, duzeltme ...
--
-- `cuzdan` tablosu YİNE SİLİNMİYOR (062 kararı): dondurma bayrakları hâlâ
-- orada duruyor (034) ve eski test bakiyeleri geri dönmek gerekirse kalsın.
-- Bayraklar bakiye değil, bu yüzden panel onları oradan okumaya devam ediyor.
--
-- KAPSAM DIŞI, bilerek: `bakiye_transfer` (027) de aynı ölü tabloda çalışıyor.
-- Şu an hiçbir ekran onu çağırmıyor (`walletRepo.transfer` dışa açık ama
-- çağrılmıyor) ve transfer için doğru `islem_tipi` etiketi bir ürün kararı
-- (elmas_transfer_gonderim/alim yalnız elmas adına). Ekrana bağlanmadan
-- taşınmayacak — bkz. PROJE_DURUMU.md, Sıradakiler.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Yönetici bakiye ver/al — artık temel deftere
--
-- İmza 027/033'teki ile AYNI: istemcide (adminRepo.grantBalance) tek satır
-- değişmiyor. Yönetici kontrolü ve denetim izi (033) aynen korunuyor.
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
        -- Düşerken bakiye yetmeyebilir; mesaj ekranda anlaşılır olsun diye
        -- normalleştiriliyor, BAŞKA bir hata ise olduğu gibi yukarı gidiyor
        -- (062'deki `_altin_harca` dersi: yanlış enum de "yetersiz" görünürdü).
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
-- 2) Yönetim paneli de gerçek bakiyeyi göstersin
--
-- İmza ve dönen kolonlar 038'deki ile AYNI (adminRepo.getUserDetail dokunulmuyor).
-- Değişen tek şey: elmas/altın artık `cuzdan`dan değil `cached_*`tan geliyor.
-- Dondurma bayrakları bakiye değil, `cuzdan`dan okunmaya devam ediyor (034).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_kullanici_getir(p_hedef BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, kullanici_adi TEXT, profil_resmi TEXT,
    email TEXT, rol TEXT, seviye_id INT, deneyim_puani BIGINT,
    elmas BIGINT, altin BIGINT, elmas_dondu BOOLEAN, altin_dondu BOOLEAN,
    mic_yasakli BOOLEAN, mic_sebep TEXT, mic_bitis TIMESTAMPTZ,
    hesap_yasakli BOOLEAN, hesap_sebep TEXT, hesap_bitis TIMESTAMPTZ,
    rapor_sayisi BIGINT, kayit_tarihi TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    RETURN QUERY
    SELECT
        k.id::bigint, k.public_id::text, k.kullanici_adi::text, k.profil_resmi::text,
        k.email::text,
        k.ekonomi_rolu::text, k.seviye_id::int, COALESCE(k.deneyim_puani, 0)::bigint,
        -- 067: ölü `cuzdan` yerine temel defterin cache'i (062 ile aynı kaynak)
        COALESCE(k.cached_total_balance, 0)::bigint,
        COALESCE(k.cached_altin_balance, 0)::bigint,
        COALESCE(c.elmas_dondu, FALSE)::boolean, COALESCE(c.altin_dondu, FALSE)::boolean,
        (m.kullanici_id IS NOT NULL AND (m.bitis IS NULL OR m.bitis > now()))::boolean,
        m.sebep::text, m.bitis::timestamptz,
        (h.kullanici_id IS NOT NULL AND (h.bitis IS NULL OR h.bitis > now()))::boolean,
        h.sebep::text, h.bitis::timestamptz,
        (SELECT count(*) FROM public.sikayetler s WHERE s.hedef_kullanici_id = k.id)::bigint,
        au.created_at::timestamptz
    FROM public.kullanicilar k
    LEFT JOIN public.cuzdan c ON c.kullanici_id = k.id
    LEFT JOIN public.mic_yasaklari m ON m.kullanici_id = k.id
    LEFT JOIN public.hesap_yasaklari h ON h.kullanici_id = k.id
    LEFT JOIN auth.users au ON au.id = k.auth_uid
    WHERE k.id = p_hedef;
END; $fn$;
REVOKE ALL ON FUNCTION public.admin_kullanici_getir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kullanici_getir(BIGINT) TO authenticated;

-- ============================================================================
-- İSTEĞE BAĞLI — eski `cuzdan` bakiyelerini temel deftere aktar
--
-- ÇALIŞTIRMAK ŞART DEĞİL. Yukarısı YENİ verilen bakiyeleri düzeltir; bu blok
-- ise `cuzdan`da kalmış ESKİ test bakiyelerini taşır. Kendini bir kez
-- çalıştırır: aktardığı her kullanıcı için `wallet_ledger`a 'cuzdan_devir'
-- açıklamalı bir satır düşer ve ikinci çalıştırmada o kullanıcıyı atlar —
-- yani yanlışlıkla iki kez çalıştırmak bakiyeyi ŞİŞİRMEZ.
--
-- Emin değilsen ÇALIŞTIRMA: eski sayılar test amaçlıydı, sıfırdan vermek daha
-- temiz. Çalıştırmak için aşağıdaki bloğun yorum işaretlerini kaldır.
-- ============================================================================
-- DO $devir$
-- DECLARE r RECORD;
-- BEGIN
--     FOR r IN
--         SELECT c.kullanici_id, c.elmas, c.altin
--           FROM public.cuzdan c
--          WHERE (COALESCE(c.elmas, 0) > 0 OR COALESCE(c.altin, 0) > 0)
--            AND NOT EXISTS (
--                SELECT 1 FROM public.wallet_ledger w
--                 WHERE w.kullanici_id = c.kullanici_id
--                   AND w.aciklama = 'cuzdan_devir')
--     LOOP
--         IF COALESCE(r.elmas, 0) > 0 THEN
--             PERFORM public.lot_yatir(r.kullanici_id, 'elmas'::varlik_tipi,
--                 'admin_grant'::bakiye_kaynagi, r.elmas,
--                 'duzeltme'::islem_tipi, 'cuzdan_devir');
--         END IF;
--         IF COALESCE(r.altin, 0) > 0 THEN
--             PERFORM public.lot_yatir(r.kullanici_id, 'altin'::varlik_tipi,
--                 'admin_grant'::bakiye_kaynagi, r.altin,
--                 'duzeltme'::islem_tipi, 'cuzdan_devir');
--         END IF;
--     END LOOP;
-- END $devir$;
