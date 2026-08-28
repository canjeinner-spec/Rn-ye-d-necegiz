-- ═══════════════════════════════════════════════════════════════════════════
-- 053_admin_oda_kapak.sql — Yönetici oda kapağını değiştirebilsin/kaldırabilsin
--
-- NEDEN:
--   Oda düzenleme ekranında kapak fotoğrafı yalnızca GÖSTERİLİYORDU; değiştiren
--   ya da kaldıran hiçbir kontrol yoktu. Sebebi 036'daki admin_oda_guncelle'nin
--   yalnızca ad ve aciklama alması: kapak_url'e dokunan bir yönetici yolu hiç
--   tanımlanmamış. Oda sahibi kendi odasının kapağını değiştirebiliyor
--   (updateRoomSettings), yönetici uygunsuz bir kapağı kaldıramıyordu.
--
-- NE EKLİYOR:
--   • admin_oda_kapak_ayarla(oda, kapak) — NULL/boş verilirse kapağı kaldırır.
--     Yalnız developer / super_admin; işlem yönetici loguna yazılır.
--
-- Idempotent: tekrar çalıştırmak güvenlidir.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_oda_kapak_ayarla(p_oda BIGINT, p_kapak TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_yeni TEXT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;

    v_yeni := NULLIF(trim(COALESCE(p_kapak, '')), '');

    UPDATE public.odalar SET kapak_url = v_yeni WHERE id = p_oda;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oda bulunamadı.';
    END IF;

    PERFORM public._yonetici_log(
        'oda', p_oda, 'oda_kapak_degistir',
        CASE WHEN v_yeni IS NULL THEN 'Kapak kaldırıldı' ELSE 'Kapak değiştirildi' END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_oda_kapak_ayarla(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_oda_kapak_ayarla(BIGINT, TEXT) TO authenticated;
