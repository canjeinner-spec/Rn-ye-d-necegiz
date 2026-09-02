-- ============================================================================
-- SON_072_079.sql — Faz 0 seti tek yapistirmada (hepsi idempotent)
-- 025 dersi gecerli DEGIL: bu sette enum ADD VALUE yok, birlikte kosabilir.
-- Tek tek kosmak istersen sira: 072 -> 079.
-- ============================================================================


-- ############################ 072_oda_moderatoru_sozluk.sql ############################

-- ============================================================================
-- 072_oda_moderatoru_sozluk.sql — Yardımcının yetkileri sunucuda ÇALIŞMIYORDU
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 071'den SONRA. İdempotent (CREATE OR REPLACE, imza aynı).
--
-- NEDEN (069'daki mantık hatası):
--   `_oda_moderatoru` şu sözlüğe bakıyordu: ('sahip','yonetici','moderator').
--   Ama `oda_uyeleri.rol` kolonunun CHECK kısıtı (021) yalnız şunlara izin
--   veriyor: 'sahip', 'yardimci', 'uye'. Yani 'yonetici' ve 'moderator' o
--   tabloya HİÇ YAZILAMAZ — sorgu yardımcı için her zaman FALSE dönüyordu.
--
--   Sonuç: "Yardımcı Yap" ile atanan kişi arayüzde bütün yetkili butonlarını
--   görüyor ama sunucu 069/071'in TÜM mikrofon aksiyonlarında reddediyordu
--   (mikrofondan indirme, sıra onayı, sıradan düşürme). "Mantık hatası var
--   gibi hissettiriyor" şikâyetinin birincil kaynağı buydu.
--
-- YANLIŞ SÖZLÜK NEREDEN GELDİ:
--   'yonetici'/'moderator' değerleri ÖLÜ `oda_yetkileri` tablosunun
--   `oda_rolu` enum'una ait. O tablo ve enum HİÇBİR yerde kullanılmıyor ve
--   CANLANDIRILMAYACAK. Oda içi rol sözlüğünün TEK kaynağı
--   `oda_uyeleri.rol` kolonunun CHECK kısıtıdır: 'sahip','yardimci','uye'.
--
-- ETKİLENEN OKUYUCULAR (davranış yalnız GENİŞLER, daralmaz):
--   koltuktan_indir (069), mic_sirasindan_cik (069), mic_sirasi_onayla (071).
--   İstemci (room.tsx canModerate) butonları yardımcıya zaten gösteriyordu;
--   sunucu artık istemciyle uyumlu.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._oda_moderatoru(p_oda BIGINT)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_ben BIGINT := public.benim_kullanici_id();
BEGIN
    IF v_ben IS NULL THEN RETURN FALSE; END IF;
    IF public.ben_platform_yoneticisi() THEN RETURN TRUE; END IF;
    IF EXISTS (SELECT 1 FROM public.odalar o
                WHERE o.id = p_oda AND o.olusturan_id = v_ben) THEN
        RETURN TRUE;
    END IF;
    -- 'uye' bilinçli olarak DAHİL DEĞİL. 'sahip' üstteki olusturan_id
    -- dalıyla zaten yakalanıyor; sağlamlık için sözlükte tutuluyor.
    RETURN EXISTS (
        SELECT 1 FROM public.oda_uyeleri u
         WHERE u.oda_id = p_oda AND u.kullanici_id = v_ben
           AND u.rol::TEXT IN ('sahip', 'yardimci'));
END; $fn$;
REVOKE ALL ON FUNCTION public._oda_moderatoru(BIGINT) FROM PUBLIC, anon, authenticated;

-- ############################ 073_koltuk_yarislari.sql ############################

-- ============================================================================
-- 073_koltuk_yarislari.sql — Eşzamanlı oturma/onay aynı koltuğu ezebiliyordu
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 072'den SONRA. İdempotent (CREATE OR REPLACE, imzalar aynı).
--
-- NEDEN (yarış koşulları):
--   • `koltuga_otur`: ön kontrol (SELECT "dolu mu?") ile yazma (INSERT ... ON
--     CONFLICT DO UPDATE) arasında pencere vardı. İki kişi aynı boş koltuğa
--     aynı anda basarsa ikisi de kontrolü geçiyor, SON YAZAN kazanıyor ve
--     ilk oturan SESSİZCE düşüyordu.
--   • `mic_sirasi_onayla`: koltuk verilen dalda UPDATE koşulsuzdu → onay,
--     araya oturan birini ezebiliyordu. Koltuk verilmeyen dalda iki eşzamanlı
--     onay aynı MIN(koltuk_no)'yu seçebiliyordu.
--
-- ÇÖZÜM: yazma anında koşul + ROW_COUNT kontrolü. Başarı yolu DEĞİŞMİYOR;
-- yalnız yarış anında sessiz kayıp yerine görünür 'Koltuk dolu.' hatası
-- üretiliyor (istemci bu mesajı zaten işliyor). Hata fonksiyonun tamamını
-- geri aldığı için eski koltuktan kalkma da iptal olur — kullanıcı yerinde
-- kalır, hiçbir şey kaybetmez.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) koltuga_otur — yazma koşullu, kaybeden 'Koltuk dolu.' görür
--    (069'daki sürümün üstüne; tek değişen blok en sondaki INSERT.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.koltuga_otur(p_oda BIGINT, p_koltuk SMALLINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben     BIGINT := public.benim_kullanici_id();
    v_sahip   BIGINT;
    v_kilitli BOOLEAN;
    v_dolu    BIGINT;
    v_yazildi INT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_koltuk < 1 OR p_koltuk > 20 THEN RAISE EXCEPTION 'Geçersiz koltuk.'; END IF;

    SELECT o.olusturan_id INTO v_sahip
      FROM public.odalar o WHERE o.id = p_oda AND NOT o.silinmis;
    IF v_sahip IS NULL THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

    IF p_koltuk = 20 AND v_sahip <> v_ben THEN
        RAISE EXCEPTION 'Bu koltuk oda sahibine ait.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.oda_yasaklari y
                WHERE y.oda_id = p_oda AND y.kullanici_id = v_ben) THEN
        RAISE EXCEPTION 'Bu odada yasaklısın.';
    END IF;

    -- 069: platform mikrofon yasağı (028). Eskiden yalnız istemci bakıyordu.
    IF EXISTS (SELECT 1 FROM public.mic_yasaklari m
                WHERE m.kullanici_id = v_ben
                  AND (m.bitis IS NULL OR m.bitis > now())) THEN
        RAISE EXCEPTION 'Mikrofon yasağın var.';
    END IF;

    SELECT k.kilitli, k.kullanici_id INTO v_kilitli, v_dolu
      FROM public.oda_koltuklari k
     WHERE k.oda_id = p_oda AND k.koltuk_no = p_koltuk;

    IF COALESCE(v_kilitli, FALSE) AND v_sahip <> v_ben
       AND NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Bu koltuk kilitli.';
    END IF;

    IF v_dolu IS NOT NULL AND v_dolu <> v_ben THEN
        RAISE EXCEPTION 'Koltuk dolu.';
    END IF;

    UPDATE public.oda_koltuklari
       SET kullanici_id = NULL, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND kullanici_id = v_ben AND koltuk_no <> p_koltuk;

    -- 073: yazma KOŞULLU. Yukarıdaki "dolu mu?" kontrolüyle bu yazma arasında
    -- başka biri oturmuş olabilir; DO UPDATE'in WHERE'i o durumda 0 satır
    -- günceller ve kaybeden görünür bir hata alır (sessiz ezme yok).
    INSERT INTO public.oda_koltuklari (oda_id, koltuk_no, kullanici_id, susturulmus, guncellenme_tarihi)
    VALUES (p_oda, p_koltuk, v_ben, FALSE, now())
    ON CONFLICT (oda_id, koltuk_no) DO UPDATE
        SET kullanici_id       = EXCLUDED.kullanici_id,
            susturulmus        = FALSE,
            guncellenme_tarihi = now()
      WHERE oda_koltuklari.kullanici_id IS NULL
         OR oda_koltuklari.kullanici_id = EXCLUDED.kullanici_id;
    GET DIAGNOSTICS v_yazildi = ROW_COUNT;
    IF v_yazildi = 0 THEN RAISE EXCEPTION 'Koltuk dolu.'; END IF;

    -- Koltuğa oturan sırada bekliyorsa sıradan düşer. (Tablo bu fonksiyondan
    -- önce kuruluyor — EXCEPTION yakalayıcı koyma; PL/pgSQL'de yakalanan hata
    -- bloğun tamamını geri alır, oturma da iptal olurdu.)
    DELETE FROM public.oda_mic_sirasi
     WHERE oda_id = p_oda AND kullanici_id = v_ben;
END; $fn$;
REVOKE ALL ON FUNCTION public.koltuga_otur(BIGINT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuga_otur(BIGINT, SMALLINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) mic_sirasi_onayla — onay oturanı ezemez; iki onay aynı koltuğu seçemez
--    (071'deki sürümün üstüne; değişen yerler işaretli.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mic_sirasi_onayla(
    p_oda    BIGINT,
    p_hedef  BIGINT,
    p_koltuk SMALLINT DEFAULT NULL)
RETURNS SMALLINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_koltuk  SMALLINT;
    v_kilitli BOOLEAN;
    v_dolu    BIGINT;
    v_yazildi INT;
BEGIN
    IF public.benim_kullanici_id() IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF NOT public._oda_moderatoru(p_oda) THEN
        RAISE EXCEPTION 'Bu işlem için oda yetkilisi olmalısın.';
    END IF;

    -- Hedef zaten koltuktaysa yalnız sıradan düşür.
    IF EXISTS (SELECT 1 FROM public.oda_koltuklari k
                WHERE k.oda_id = p_oda AND k.kullanici_id = p_hedef) THEN
        DELETE FROM public.oda_mic_sirasi WHERE oda_id = p_oda AND kullanici_id = p_hedef;
        RETURN NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM public.mic_yasaklari m
                WHERE m.kullanici_id = p_hedef
                  AND (m.bitis IS NULL OR m.bitis > now())) THEN
        RAISE EXCEPTION 'Bu kullanıcının mikrofon yasağı var.';
    END IF;

    IF p_koltuk IS NULL THEN
        -- 073: MIN yerine kilitli satır atlayan seçim — iki eşzamanlı onay
        -- aynı koltuğu SEÇEMEZ (kaybeden bir sonraki boş koltuğu alır).
        SELECT k.koltuk_no INTO v_koltuk
          FROM public.oda_koltuklari k
         WHERE k.oda_id = p_oda
           AND k.kullanici_id IS NULL
           AND NOT k.kilitli
           AND k.koltuk_no BETWEEN 1 AND 19
         ORDER BY k.koltuk_no
           FOR UPDATE SKIP LOCKED
         LIMIT 1;
        IF v_koltuk IS NULL THEN RAISE EXCEPTION 'Boş koltuk yok.'; END IF;
    ELSE
        IF p_koltuk < 1 OR p_koltuk > 19 THEN RAISE EXCEPTION 'Geçersiz koltuk.'; END IF;
        SELECT k.kilitli, k.kullanici_id INTO v_kilitli, v_dolu
          FROM public.oda_koltuklari k
         WHERE k.oda_id = p_oda AND k.koltuk_no = p_koltuk;
        IF NOT FOUND THEN RAISE EXCEPTION 'Koltuk bulunamadı.'; END IF;
        IF COALESCE(v_kilitli, FALSE) THEN RAISE EXCEPTION 'Bu koltuk kilitli.'; END IF;
        IF v_dolu IS NOT NULL THEN RAISE EXCEPTION 'Koltuk dolu.'; END IF;
        v_koltuk := p_koltuk;
    END IF;

    -- 073: yazma KOŞULLU — ön kontrolle bu satır arasında koltuğa biri
    -- oturduysa/kilitlendiyse 0 satır güncellenir, onay ezmek yerine
    -- görünür hata verir.
    UPDATE public.oda_koltuklari
       SET kullanici_id = p_hedef, susturulmus = FALSE, guncellenme_tarihi = now()
     WHERE oda_id = p_oda AND koltuk_no = v_koltuk
       AND kullanici_id IS NULL AND NOT kilitli;
    GET DIAGNOSTICS v_yazildi = ROW_COUNT;
    IF v_yazildi = 0 THEN RAISE EXCEPTION 'Koltuk dolu.'; END IF;

    DELETE FROM public.oda_mic_sirasi WHERE oda_id = p_oda AND kullanici_id = p_hedef;
    RETURN v_koltuk;
END; $fn$;
REVOKE ALL ON FUNCTION public.mic_sirasi_onayla(BIGINT, BIGINT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mic_sirasi_onayla(BIGINT, BIGINT, SMALLINT) TO authenticated;

-- ############################ 074_odul_ve_satinalma_yarislari.sql ############################

-- ============================================================================
-- 074_odul_ve_satinalma_yarislari.sql — Çift dokunuş çift ücret/ödül verebiliyordu
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 073'ten SONRA. İdempotent (CREATE OR REPLACE, imzalar aynı).
--
-- NEDEN:
--   • `esya_satin_al` (062): "zaten sende mi?" kontrolü kilitsizdi. Aynı
--     kullanıcının iki eşzamanlı çağrısı (çift dokunuş) ikisi de kontrolü
--     geçip İKİ KEZ ücret düşebiliyordu.
--   • `gunluk_giris_al` (061): satır varken FOR UPDATE zaten kilitliyor;
--     açık kalan yarış İLK GÜN — satır yokken iki eşzamanlı çağrıda kaybeden
--     INSERT, ON CONFLICT'in KOŞULSUZ DO UPDATE'ine düşüp yine de _odul_ver
--     çağırıyordu → çift ödül.
--
-- TERCİH NOTU: şemada `idempotency_keys` + `idem_kaydet()` hazır ama o yol
-- istemcinin her çağrıya anahtar üretmesini gerektirir (imza değişirdi).
-- Kullanıcı satırı kilidi imzaya dokunmadan aynı sonucu veriyor: aynı
-- kullanıcının eşzamanlı istekleri serileşir, ikincisi ilkinin sonucunu
-- görür. Süreli eşyada bilinçli aralıklı iki satın alma yine mümkündür
-- (bu bir özellik: süre üste eklenir); çift DOKUNUŞUN kendisi istemcide
-- ayrıca in-flight kilidiyle engelleniyor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) esya_satin_al — kullanıcı satırı kilidi (062'deki sürümün üstüne;
--    eklenen tek şey PERFORM ... FOR UPDATE satırı)
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

    -- 074: aynı kullanıcının eşzamanlı satın almaları SERİLEŞSİN. İkinci
    -- çağrı ilki commit'leninceye kadar burada bekler ve aşağıdaki "zaten
    -- sende mi?" kontrolünü ilkinin SONUCUNA bakarak yapar.
    PERFORM 1 FROM public.kullanicilar WHERE id = v_ben FOR UPDATE;

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
REVOKE ALL ON FUNCTION public.esya_satin_al(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.esya_satin_al(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) gunluk_giris_al — ilk gün yarışında çift ödül kapanıyor (061'deki
--    sürümün üstüne; değişen tek şey ON CONFLICT'in koşullanması)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gunluk_giris_al()
RETURNS TABLE (gun_no SMALLINT, odul BIGINT, altin BIGINT, seri INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben     BIGINT := public.benim_kullanici_id();
    v_kayit   public.kullanici_gunluk_giris%ROWTYPE;
    v_bugun   DATE := public._bugun_tr();
    v_gun     SMALLINT;
    v_seri    INTEGER;
    v_odul    BIGINT;
    v_bakiye  BIGINT;
    v_yazildi INT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;

    SELECT * INTO v_kayit FROM public.kullanici_gunluk_giris
     WHERE kullanici_id = v_ben FOR UPDATE;

    IF FOUND AND v_kayit.son_giris_tarihi = v_bugun THEN
        RAISE EXCEPTION 'Bugünün ödülü zaten alındı.';
    END IF;

    IF FOUND AND v_kayit.son_giris_tarihi = v_bugun - 1 THEN
        v_gun  := (v_kayit.son_alinan_gun % 7) + 1;
        v_seri := v_kayit.mevcut_seri + 1;
    ELSE
        v_gun  := 1;
        v_seri := 1;
    END IF;

    SELECT o.miktar INTO v_odul FROM public.gunluk_giris_odulleri o WHERE o.gun_no = v_gun;
    IF v_odul IS NULL THEN RAISE EXCEPTION 'Gün ödülü tanımlı değil.'; END IF;

    -- 074: satır YOKKEN iki eşzamanlı çağrıda FOR UPDATE hiçbir şey
    -- kilitlemiyor; kaybedenin INSERT'i buradaki DO UPDATE'e düşer. Koşul
    -- sayesinde bugünü zaten yazmış satırı GÜNCELLEMEZ (0 satır) ve çift
    -- _odul_ver imkânsızlaşır. (gorev_odul_al'daki kanıtlanmış desen.)
    INSERT INTO public.kullanici_gunluk_giris
        (kullanici_id, mevcut_seri, son_alinan_gun, son_giris_tarihi)
    VALUES (v_ben, v_seri, v_gun, v_bugun)
    ON CONFLICT (kullanici_id) DO UPDATE
        SET mevcut_seri = EXCLUDED.mevcut_seri,
            son_alinan_gun = EXCLUDED.son_alinan_gun,
            son_giris_tarihi = EXCLUDED.son_giris_tarihi
      WHERE kullanici_gunluk_giris.son_giris_tarihi IS DISTINCT FROM EXCLUDED.son_giris_tarihi;
    GET DIAGNOSTICS v_yazildi = ROW_COUNT;
    IF v_yazildi = 0 THEN RAISE EXCEPTION 'Bugünün ödülü zaten alındı.'; END IF;

    v_bakiye := public._odul_ver(v_ben, v_odul, 'gunluk_giris');
    RETURN QUERY SELECT v_gun, v_odul, COALESCE(v_bakiye, 0), v_seri;
END; $$;
REVOKE ALL ON FUNCTION public.gunluk_giris_al() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gunluk_giris_al() TO authenticated;

-- ############################ 075_admin_eposta_kisiti.sql ############################

-- ============================================================================
-- 075_admin_eposta_kisiti.sql — E-posta yine yalnız developer'a görünsün
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 074'ten SONRA. İdempotent (CREATE OR REPLACE, imza aynı).
--
-- NEDEN (regresyon): 029'da e-posta yalnız `ben_developer()` iken dolu
-- dönüyordu. 038 fonksiyonu yeniden yazarken bu kısıtı DÜŞÜRDÜ, 067 de
-- düşmüş halini taşıdı — her super_admin e-posta görüyordu. Bu dosya 029'un
-- asıl davranışını geri getiriyor; değişen tek satır e-posta CASE'i.
--
-- İSTEMCİ DEĞİŞİKLİĞİ SIFIR: adminRepo `email: r.email ?? null` ve
-- admin-user-edit `d.email || "—"` null'u zaten işliyor (tip yorumu da
-- "yalnızca developer'a dolu gelir" diyor — kod artık yoruma uyuyor).
-- ============================================================================

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
        -- 075: e-posta yalnız developer'a (029'un asıl davranışı; 038'de düşmüştü)
        CASE WHEN public.ben_developer() THEN k.email::text ELSE NULL END,
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

-- ############################ 076_search_path_pg_temp.sql ############################

-- ============================================================================
-- 076_search_path_pg_temp.sql — Tek eksik pg_temp tamamlanıyor
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 075'ten SONRA. İdempotent (CREATE OR REPLACE, imza aynı).
--
-- NEDEN: projedeki bütün SECURITY DEFINER fonksiyonlar
-- `SET search_path = public, pg_temp` kullanıyor; 055'teki
-- `oda_ziyaret_kaydet` TEK istisnaydı (`public` yalnız). pg_temp sona
-- eklenmezse çağıranın geçici şeması araya girip aynı adlı nesneyle
-- fonksiyonu gölgeleyebilir. Gövde birebir aynı; değişen yalnız SET satırı.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.oda_ziyaret_kaydet(p_oda_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ben BIGINT;
BEGIN
    v_ben := public.benim_kullanici_id();
    IF v_ben IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.oda_ziyaretleri (kullanici_id, oda_id)
    VALUES (v_ben, p_oda_id)
    ON CONFLICT (kullanici_id, oda_id) DO UPDATE
        SET son_giris    = now(),
            giris_sayisi = public.oda_ziyaretleri.giris_sayisi + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.oda_ziyaret_kaydet(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_ziyaret_kaydet(BIGINT) TO authenticated;

-- ############################ 077_anon_grant_supurme.sql ############################

-- ============================================================================
-- 077_anon_grant_supurme.sql — 021-024 döneminin fonksiyonlarında anon süpürmesi
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 076'dan SONRA. İdempotent (yetki zaten yoksa REVOKE zararsız).
--
-- NEDEN: 021-024 yalnız `REVOKE ... FROM public` yazmıştı. 063/064'te
-- öğrenilen ders: PUBLIC'ten almak, role verilmiş DOĞRUDAN grant'i
-- (ya da eski bir kurulumdan kalanı) SİLMEZ — iki yön birbirinden bağımsız.
-- Sonraki migration'ların hepsi `FROM PUBLIC, anon` deseninde; bu dosya aynı
-- disiplini geriye uyguluyor. Oturumsuz (anon) istemcinin bu fonksiyonları
-- çağırabilmesi için hiçbir sebep yok.
--
-- Not: fonksiyonların hepsi gövdede zaten oturum + yetki kontrolü yapıyor;
-- bu süpürme savunma katmanı. `ben_platform_yoneticisi()` ve
-- `oda_sahibi_ekle()` (trigger) çağrılabilir yüzey değil, yine de listede.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.oda_rol_ata(BIGINT, BIGINT, TEXT)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.oda_uye_cikar(BIGINT, BIGINT)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.oda_yasakla(BIGINT, BIGINT)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.oda_yasak_kaldir(BIGINT, BIGINT)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.platform_rol_ata(BIGINT, TEXT)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ben_platform_yoneticisi()            FROM anon;
REVOKE EXECUTE ON FUNCTION public.oda_sahibi_ekle()                    FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA (çalıştırdıktan sonra SQL Editor'da; anon satırı KALMAMALI):
--
-- SELECT p.proname,
--        pg_get_function_identity_arguments(p.oid) AS args,
--        a.grantee::regrole::text AS kim
--   FROM pg_proc p
--   CROSS JOIN LATERAL aclexplode(p.proacl) a
--  WHERE p.pronamespace = 'public'::regnamespace
--    AND p.proname IN ('oda_rol_ata','oda_uye_cikar','oda_yasakla',
--                      'oda_yasak_kaldir','platform_rol_ata',
--                      'ben_platform_yoneticisi','oda_sahibi_ekle')
--  ORDER BY p.proname, kim;
-- ---------------------------------------------------------------------------

-- ############################ 078_oda_mesaj_rpc.sql ############################

-- ============================================================================
-- 078_oda_mesaj_rpc.sql — Oda mesajı yazma RPC'ye taşınıyor
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 077'den SONRA. İdempotent.
--
-- NEDEN: Oda sohbeti bugüne dek YALNIZ broadcast'ti — `oda_mesajlari`na tek
-- satır bile yazılmıyordu. Sonuçları: geçmiş yok (sonradan giren boş sohbet
-- görüyor), mikrofon yasağının YAZMA tarafı yalnız istemcide (sunucudan hiç
-- geçmiyordu), sohbet rozetleri (066) ve görev sayaçları (061) hiç
-- tetiklenmiyor, moderasyon mesajlara erişemiyor.
--
-- TASARIM: broadcast AYNEN KALIYOR (anlık yol, ~30-80 ms). Bu RPC üstüne
-- KALICILIK katmanı: istemci mesajı broadcast'le yollarken buraya da
-- fire-and-forget yazar. `oda_mesajlari` için postgres_changes aboneliği
-- AÇILMAYACAK — çift gösterim (echo) riski yok, tablo yalnız geçmiş için
-- okunur.
--
-- Yazma tek yola iniyor: 011'in doğrudan INSERT grant'i kapanıyor. SELECT
-- grant'i ve select policy'si (011) aynen kalıyor — geçmiş oradan okunur.
-- Realtime publication'da tablo zaten var (011) — DOKUNULMUYOR.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.oda_mesaj_yaz(p_oda BIGINT, p_icerik TEXT)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben    BIGINT := public.benim_kullanici_id();
    v_metin  TEXT   := btrim(COALESCE(p_icerik, ''));
    v_id     BIGINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF v_metin = '' THEN RAISE EXCEPTION 'Mesaj boş olamaz.'; END IF;
    IF length(v_metin) > 500 THEN RAISE EXCEPTION 'Mesaj çok uzun.'; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.odalar o
                    WHERE o.id = p_oda AND NOT o.silinmis) THEN
        RAISE EXCEPTION 'Oda bulunamadı.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.oda_yasaklari y
                WHERE y.oda_id = p_oda AND y.kullanici_id = v_ben) THEN
        RAISE EXCEPTION 'Bu odada yasaklısın.';
    END IF;

    -- Yazma tarafı ilk kez sunucudan geçiyor (069'daki koltuk kontrolüyle
    -- aynı pencere kuralı). İstemci kontrolü hız için kalıyor; bu, aşılamaz
    -- olan katman.
    IF EXISTS (SELECT 1 FROM public.mic_yasaklari m
                WHERE m.kullanici_id = v_ben
                  AND (m.bitis IS NULL OR m.bitis > now())) THEN
        RAISE EXCEPTION 'Mikrofon yasağın var.';
    END IF;

    INSERT INTO public.oda_mesajlari (oda_id, kullanici_id, icerik)
    VALUES (p_oda, v_ben, v_metin)
    RETURNING id INTO v_id;

    RETURN v_id;
END; $fn$;
REVOKE ALL ON FUNCTION public.oda_mesaj_yaz(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_mesaj_yaz(BIGINT, TEXT) TO authenticated;

-- 011'in doğrudan yazma yolu kapanıyor (kolon bazlı grant ayrı nesnedir,
-- ikisi de süpürülüyor). insert policy'si (011) grant'sız etkisiz kalır,
-- durmasında sakınca yok.
REVOKE INSERT ON public.oda_mesajlari FROM authenticated;
REVOKE INSERT (oda_id, kullanici_id, icerik) ON public.oda_mesajlari FROM authenticated;

-- ############################ 079_sayac_emekliligi.sql ############################

-- ============================================================================
-- 079_sayac_emekliligi.sql — İstemci yazmalı kişi sayacı emekliye ayrılıyor
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 078'den SONRA. İdempotent.
--
-- NEDEN (çift kaynak): kişi sayısı İKİ yerden geliyordu —
--   1. `odalar.aktif_katilimci_sayisi` (057): İSTEMCİ yazıyor. Oturumlu
--      HERKES HERHANGİ odaya 0-5000 arası değer yazabiliyordu; uygulama
--      öldürülünce son değer donuyor ("hayalet oda").
--   2. `oda_katilimcilar` (070): sunucu tarafı kalp atışı, 2 dk eşik —
--      güvenilir kaynak. Oda listesi görünürlüğü zaten buna geçti.
-- İki kaynak birbiriyle yarışıyordu; okurlar hangisine denk gelirse onu
-- gösteriyordu. Bu dosya 057 yolunu kapatır, kalan okurları 070'e bağlar.
--
-- `oda_katilimci_yaz` SİLİNMİYOR, no-op oluyor: sahada eski istemci sürümü
-- kalırsa çağrı patlamasın (ucuz sigorta). Kolon da kalıyor (003'ün SELECT
-- kolon listeleri bozulmasın) ama artık HEP 0.
-- ============================================================================

-- 1) Yazma yolu kapanıyor — gövde no-op.
CREATE OR REPLACE FUNCTION public.oda_katilimci_yaz(p_oda_id BIGINT, p_sayi INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 079: emekli. Kişi sayısının tek kaynağı `oda_katilimcilar` (070).
    -- İstemcinin yazdığı sayı hem güvensizdi (herkes her odaya yazabiliyordu)
    -- hem donuyordu (uygulama öldürülünce son değer kalıyordu).
    RETURN;
END; $$;
REVOKE ALL ON FUNCTION public.oda_katilimci_yaz(BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oda_katilimci_yaz(BIGINT, INTEGER) TO authenticated;

-- 2) Donmuş bayat değerler tek seferde temizleniyor.
UPDATE public.odalar SET aktif_katilimci_sayisi = 0 WHERE aktif_katilimci_sayisi <> 0;

-- 3) siralama_odalar: online artık canlı sayımdan. İmza/kolonlar AYNI
--    (istemci siralamaRepo değişmiyor). Sıralama PUANI hediye değerinden
--    geliyor (t.p) — online yalnız gösterim kolonu, sıra DEĞİŞMEZ.
CREATE OR REPLACE FUNCTION public.siralama_odalar(p_periyot TEXT DEFAULT 'hafta', p_limit INTEGER DEFAULT 50)
RETURNS TABLE (sira INTEGER, oda_id BIGINT, public_id TEXT, ad TEXT,
               kapak TEXT, sahip TEXT, online INTEGER, puan BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH t AS (
        SELECT h.oda_id AS oid, SUM(h.toplam_deger)::BIGINT AS p
          FROM public.hediye_gecmisi h
         WHERE h.oda_id IS NOT NULL
           AND h.gonderilme_tarihi >= public._siralama_baslangic(p_periyot)
         GROUP BY h.oda_id
    )
    SELECT (ROW_NUMBER() OVER (ORDER BY t.p DESC, o.id))::INTEGER,
           o.id, o.public_id::TEXT, o.ad::TEXT, o.kapak_url,
           COALESCE(k.kullanici_adi, '')::TEXT,
           -- 079: canlı sayım (070'in 2 dk eşiğiyle birebir)
           COALESCE((SELECT count(*)::INTEGER FROM public.oda_katilimcilar ok
                      WHERE ok.oda_id = o.id
                        AND ok.last_heartbeat > now() - INTERVAL '2 minutes'), 0),
           t.p
      FROM t
      JOIN public.odalar o ON o.id = t.oid
      LEFT JOIN public.kullanicilar k ON k.id = o.olusturan_id
     WHERE NOT o.silinmis AND NOT o.islem_gordu AND t.p > 0
     ORDER BY t.p DESC, o.id
     LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;
REVOKE ALL ON FUNCTION public.siralama_odalar(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siralama_odalar(TEXT, INTEGER) TO authenticated;

-- 4) admin_oda_getir: aynı geçiş. İmza/kolonlar AYNI (adminRepo değişmiyor).
CREATE OR REPLACE FUNCTION public.admin_oda_getir(p_oda BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, ad TEXT, aciklama TEXT, kategori TEXT, kapak_url TEXT,
    herkese_acik BOOLEAN, olusturan_id BIGINT, sahip_ad TEXT, sahip_public_id TEXT,
    uye_sayisi BIGINT, aktif_katilimci INT,
    islem_gordu BOOLEAN, islem_sebep TEXT, islem_tarihi TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT o.id::bigint, o.public_id::text, o.ad::text, o.aciklama::text, o.kategori::text, o.kapak_url::text,
           o.herkese_acik::boolean, o.olusturan_id::bigint, k.kullanici_adi::text, k.public_id::text,
           (SELECT count(*) FROM public.oda_uyeleri u WHERE u.oda_id = o.id)::bigint,
           -- 079: canlı sayım (070'in 2 dk eşiğiyle birebir)
           COALESCE((SELECT count(*)::int FROM public.oda_katilimcilar ok
                      WHERE ok.oda_id = o.id
                        AND ok.last_heartbeat > now() - INTERVAL '2 minutes'), 0),
           o.islem_gordu::boolean, o.islem_sebep::text, o.islem_tarihi
      FROM public.odalar o
      LEFT JOIN public.kullanicilar k ON k.id = o.olusturan_id
     WHERE o.id = p_oda;
END; $$;
REVOKE ALL ON FUNCTION public.admin_oda_getir(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_oda_getir(BIGINT) TO authenticated;
