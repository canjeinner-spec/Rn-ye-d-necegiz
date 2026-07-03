-- 041_duyuru_sistem.sql — Dinamik duyuru banner'ları + herkese sistem duyurusu
-- (bildirim çanı + DM'deki resmi/sistem hesabı kanalı). Round 1: yalnız "herkes".
-- ÇALIŞTIRMA: 003 + 013 + 021 + 033'ten SONRA.

-- ── A) Sistem duyuruları (DM resmi/sistem thread kaynağı) ───────────────────
CREATE TABLE IF NOT EXISTS public.sistem_duyurulari (
    id          BIGSERIAL   PRIMARY KEY,
    kanal       TEXT        NOT NULL DEFAULT 'aron' CHECK (kanal IN ('aron', 'sistem')),
    baslik      TEXT        NOT NULL,
    icerik      TEXT        NOT NULL,
    foto_url    TEXT,
    gonderen_id BIGINT      REFERENCES public.kullanicilar(id) ON DELETE SET NULL,
    olusturma   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sistem_duyuru_kanal ON public.sistem_duyurulari (kanal, id DESC);
ALTER TABLE public.sistem_duyurulari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sistem_duyurulari FROM anon, authenticated;
GRANT SELECT ON public.sistem_duyurulari TO authenticated;
DROP POLICY IF EXISTS sistem_duyuru_select ON public.sistem_duyurulari;
CREATE POLICY sistem_duyuru_select ON public.sistem_duyurulari
    FOR SELECT TO authenticated USING (TRUE); -- herkes okur; yazma yalnız RPC

-- ── B) Duyuru banner'ları (oda listesi üstü) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.duyuru_bannerlari (
    id         BIGSERIAL   PRIMARY KEY,
    baslik     TEXT        NOT NULL,
    aciklama   TEXT,
    foto_url   TEXT,
    sira       INT         NOT NULL DEFAULT 0,
    aktif      BOOLEAN     NOT NULL DEFAULT TRUE,
    olusturma  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_banner_aktif ON public.duyuru_bannerlari (aktif, sira);
ALTER TABLE public.duyuru_bannerlari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.duyuru_bannerlari FROM anon, authenticated;
GRANT SELECT ON public.duyuru_bannerlari TO authenticated;
DROP POLICY IF EXISTS banner_select ON public.duyuru_bannerlari;
CREATE POLICY banner_select ON public.duyuru_bannerlari
    FOR SELECT TO authenticated USING (aktif = TRUE OR public.ben_platform_yoneticisi());

-- ── C) RPC: herkese sistem duyurusu gönder (bildirim fan-out) ──────────────
CREATE OR REPLACE FUNCTION public.sistem_duyuru_gonder(
    p_kanal TEXT, p_baslik TEXT, p_icerik TEXT, p_foto TEXT DEFAULT NULL, p_bildirim BOOLEAN DEFAULT TRUE)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    IF p_kanal NOT IN ('aron', 'sistem') THEN RAISE EXCEPTION 'Geçersiz kanal.'; END IF;
    IF p_baslik IS NULL OR length(trim(p_baslik)) = 0 OR p_icerik IS NULL OR length(trim(p_icerik)) = 0 THEN
        RAISE EXCEPTION 'Başlık ve içerik gerekli.';
    END IF;
    INSERT INTO public.sistem_duyurulari (kanal, baslik, icerik, foto_url, gonderen_id)
    VALUES (p_kanal, trim(p_baslik), trim(p_icerik), NULLIF(trim(COALESCE(p_foto, '')), ''), public.benim_kullanici_id())
    RETURNING id INTO v_id;

    IF p_bildirim THEN
        -- Tüm kullanıcılara bildirim çanı (tip='sistem'). 20-30 kullanıcı → ucuz.
        INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
        SELECT k.id, 'sistem', trim(p_baslik), trim(p_icerik),
               jsonb_build_object('duyuru', v_id, 'kanal', p_kanal, 'foto', NULLIF(trim(COALESCE(p_foto, '')), ''))
          FROM public.kullanicilar k;
    END IF;

    PERFORM public._yonetici_log('kullanici', public.benim_kullanici_id(), 'duyuru_gonder',
        p_kanal || ' · ' || trim(p_baslik) || CASE WHEN p_bildirim THEN ' (bildirimli)' ELSE '' END);
    RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.sistem_duyuru_gonder(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.sistem_duyuru_gonder(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── D) RPC: banner ekle / güncelle / sil (soft) ────────────────────────────
CREATE OR REPLACE FUNCTION public.banner_ekle(p_baslik TEXT, p_aciklama TEXT DEFAULT NULL, p_foto TEXT DEFAULT NULL, p_sira INT DEFAULT 0)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    IF p_baslik IS NULL OR length(trim(p_baslik)) = 0 THEN RAISE EXCEPTION 'Başlık gerekli.'; END IF;
    INSERT INTO public.duyuru_bannerlari (baslik, aciklama, foto_url, sira)
    VALUES (trim(p_baslik), NULLIF(trim(COALESCE(p_aciklama, '')), ''), NULLIF(trim(COALESCE(p_foto, '')), ''), COALESCE(p_sira, 0))
    RETURNING id INTO v_id;
    PERFORM public._yonetici_log('kullanici', public.benim_kullanici_id(), 'banner_ekle', trim(p_baslik));
    RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.banner_ekle(TEXT, TEXT, TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.banner_ekle(TEXT, TEXT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.banner_guncelle(p_id BIGINT, p_baslik TEXT, p_aciklama TEXT, p_foto TEXT, p_sira INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    UPDATE public.duyuru_bannerlari
       SET baslik = COALESCE(NULLIF(trim(COALESCE(p_baslik, '')), ''), baslik),
           aciklama = NULLIF(trim(COALESCE(p_aciklama, '')), ''),
           foto_url = NULLIF(trim(COALESCE(p_foto, '')), ''),
           sira = COALESCE(p_sira, sira)
     WHERE id = p_id;
    PERFORM public._yonetici_log('kullanici', public.benim_kullanici_id(), 'banner_guncelle', p_id::text);
END; $$;
REVOKE ALL ON FUNCTION public.banner_guncelle(BIGINT, TEXT, TEXT, TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.banner_guncelle(BIGINT, TEXT, TEXT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.banner_sil(p_id BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    UPDATE public.duyuru_bannerlari SET aktif = FALSE WHERE id = p_id;
    PERFORM public._yonetici_log('kullanici', public.benim_kullanici_id(), 'banner_sil', p_id::text);
END; $$;
REVOKE ALL ON FUNCTION public.banner_sil(BIGINT) FROM public;
GRANT EXECUTE ON FUNCTION public.banner_sil(BIGINT) TO authenticated;

-- ── E) Realtime yayını (canlı banner + duyuru) ─────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN RETURN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sistem_duyurulari') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sistem_duyurulari;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='duyuru_bannerlari') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.duyuru_bannerlari;
    END IF;
END $$;
