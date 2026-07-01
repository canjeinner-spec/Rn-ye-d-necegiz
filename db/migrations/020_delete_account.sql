-- ============================================================================
-- 020_delete_account.sql — Hesabı kalıcı olarak silme (self-service)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 001-003'ten SONRA (Supabase SQL Editor).
--
--   • hesabimi_sil(): oturum sahibinin kendi kullanicilar + auth.users
--     satırını siler. SECURITY DEFINER olduğu için client'ın service_role
--     anahtarına ihtiyacı yok; fonksiyon Postgres içinde auth şemasına da
--     erişebiliyor (Supabase Auth REST katmanı devre dışı, düz SQL).
--   • kullanicilar(id) referans veren tabloların büyük çoğunluğu (gönderiler,
--     yorumlar, beğeniler, arkadaşlıklar, engel, görev/kupon/özel-id vb.)
--     ON DELETE CASCADE ile tanımlı → kullanicilar satırı silinince otomatik
--     temizlenir. Bilinmeyen/cascade'siz bir FK varsa fonksiyon
--     foreign_key_violation'ı yakalayıp anlaşılır bir Türkçe hata döner
--     (tüm işlem tek transaction'da — yarım silme olmaz).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hesabimi_sil()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Oturum bulunamadı.';
    END IF;

    DELETE FROM public.kullanicilar WHERE auth_uid = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'Hesap silinemedi: bazı ilişkili veriler engel oluşturuyor. Lütfen destek ile iletişime geç.';
END; $$;

REVOKE ALL ON FUNCTION public.hesabimi_sil() FROM public;
GRANT EXECUTE ON FUNCTION public.hesabimi_sil() TO authenticated;
