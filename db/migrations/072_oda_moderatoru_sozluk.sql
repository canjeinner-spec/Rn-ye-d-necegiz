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
