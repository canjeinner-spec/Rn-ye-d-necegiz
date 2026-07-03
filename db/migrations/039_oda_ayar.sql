-- 039_oda_ayar.sql — Oda parolası (gerçek, hash'li) + odalar Realtime yayını.
-- Tema/kapak/isim/duyuru güncellemesi zaten 003'teki sahip UPDATE grant'ıyla
-- (ad, aciklama, kategori, kapak_url) client'tan yapılır — burada yalnız parola
-- (sifre_hash client'a kapalı) ve canlı yayın var.
-- ÇALIŞTIRMA: 003'ten SONRA. pgcrypto extensions şemasında (029 ile kurulu).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Parola belirle/kaldır — yalnız oda sahibi. Dolu → kilitli + hash; boş → açık.
CREATE OR REPLACE FUNCTION public.oda_parola_belirle(p_oda BIGINT, p_parola TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.odalar WHERE id = p_oda AND olusturan_id = public.benim_kullanici_id()) THEN
        RAISE EXCEPTION 'Bu odayı düzenleme yetkin yok.';
    END IF;
    IF p_parola IS NULL OR length(trim(p_parola)) = 0 THEN
        UPDATE public.odalar SET sifre_hash = NULL, herkese_acik = TRUE WHERE id = p_oda;
    ELSE
        UPDATE public.odalar
           SET sifre_hash = extensions.crypt(trim(p_parola), extensions.gen_salt('bf')),
               herkese_acik = FALSE
         WHERE id = p_oda;
    END IF;
END; $$;
REVOKE ALL ON FUNCTION public.oda_parola_belirle(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_parola_belirle(BIGINT, TEXT) TO authenticated;

-- Parola doğrula — herkes çağırabilir (giriş kapısı). sifre_hash gizli kalır.
CREATE OR REPLACE FUNCTION public.oda_parola_dogrula(p_oda BIGINT, p_parola TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE(
        (SELECT sifre_hash IS NULL OR sifre_hash = extensions.crypt(COALESCE(p_parola, ''), sifre_hash)
           FROM public.odalar WHERE id = p_oda),
        FALSE);
$$;
REVOKE ALL ON FUNCTION public.oda_parola_dogrula(BIGINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.oda_parola_dogrula(BIGINT, TEXT) TO authenticated;

-- odalar'ı Realtime yayınına ekle → tema/kapak/duyuru değişince odadakiler canlı görsün.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN RETURN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='odalar') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.odalar;
    END IF;
END $$;
