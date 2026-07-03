-- 042_banner_sablon.sql — Banner'lar artık açılır TAM SAYFA + premium şablon.
-- Her banner bir "sablon" (duyuru | bakim | etkinlik) + düzenlenebilir "icerik"
-- (JSONB: altBaslik, rozet, giris, maddeler[], kapanis) taşır. Banner'a dokununca
-- CenterModal yerine /banner-detay?id= premium sayfası açılır.
-- ÇALIŞTIRMA: 041'den SONRA.

-- ── A) Kolonlar ────────────────────────────────────────────────────────────
ALTER TABLE public.duyuru_bannerlari
    ADD COLUMN IF NOT EXISTS sablon TEXT   NOT NULL DEFAULT 'duyuru'
        CHECK (sablon IN ('duyuru', 'bakim', 'etkinlik')),
    ADD COLUMN IF NOT EXISTS icerik JSONB  NOT NULL DEFAULT '{}'::jsonb;

-- ── B) RPC: banner ekle (şablon + içerik ile) ──────────────────────────────
DROP FUNCTION IF EXISTS public.banner_ekle(TEXT, TEXT, TEXT, INT);
CREATE OR REPLACE FUNCTION public.banner_ekle(
    p_baslik TEXT, p_aciklama TEXT DEFAULT NULL, p_foto TEXT DEFAULT NULL, p_sira INT DEFAULT 0,
    p_sablon TEXT DEFAULT 'duyuru', p_icerik JSONB DEFAULT '{}'::jsonb)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    IF p_baslik IS NULL OR length(trim(p_baslik)) = 0 THEN RAISE EXCEPTION 'Başlık gerekli.'; END IF;
    IF COALESCE(p_sablon, 'duyuru') NOT IN ('duyuru', 'bakim', 'etkinlik') THEN RAISE EXCEPTION 'Geçersiz şablon.'; END IF;
    INSERT INTO public.duyuru_bannerlari (baslik, aciklama, foto_url, sira, sablon, icerik)
    VALUES (trim(p_baslik), NULLIF(trim(COALESCE(p_aciklama, '')), ''), NULLIF(trim(COALESCE(p_foto, '')), ''),
            COALESCE(p_sira, 0), COALESCE(p_sablon, 'duyuru'), COALESCE(p_icerik, '{}'::jsonb))
    RETURNING id INTO v_id;
    PERFORM public._yonetici_log('kullanici', public.benim_kullanici_id(), 'banner_ekle', trim(p_baslik));
    RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.banner_ekle(TEXT, TEXT, TEXT, INT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.banner_ekle(TEXT, TEXT, TEXT, INT, TEXT, JSONB) TO authenticated;

-- ── C) RPC: banner güncelle (şablon + içerik ile) ──────────────────────────
DROP FUNCTION IF EXISTS public.banner_guncelle(BIGINT, TEXT, TEXT, TEXT, INT);
CREATE OR REPLACE FUNCTION public.banner_guncelle(
    p_id BIGINT, p_baslik TEXT, p_aciklama TEXT, p_foto TEXT, p_sira INT,
    p_sablon TEXT DEFAULT NULL, p_icerik JSONB DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    IF p_sablon IS NOT NULL AND p_sablon NOT IN ('duyuru', 'bakim', 'etkinlik') THEN RAISE EXCEPTION 'Geçersiz şablon.'; END IF;
    UPDATE public.duyuru_bannerlari
       SET baslik   = COALESCE(NULLIF(trim(COALESCE(p_baslik, '')), ''), baslik),
           aciklama = NULLIF(trim(COALESCE(p_aciklama, '')), ''),
           foto_url = NULLIF(trim(COALESCE(p_foto, '')), ''),
           sira     = COALESCE(p_sira, sira),
           sablon   = COALESCE(p_sablon, sablon),
           icerik   = COALESCE(p_icerik, icerik)
     WHERE id = p_id;
    PERFORM public._yonetici_log('kullanici', public.benim_kullanici_id(), 'banner_guncelle', p_id::text);
END; $$;
REVOKE ALL ON FUNCTION public.banner_guncelle(BIGINT, TEXT, TEXT, TEXT, INT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.banner_guncelle(BIGINT, TEXT, TEXT, TEXT, INT, TEXT, JSONB) TO authenticated;
