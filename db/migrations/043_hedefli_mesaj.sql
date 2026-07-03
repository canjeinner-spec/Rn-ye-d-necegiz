-- 043_hedefli_mesaj.sql — Kişiye & odaya özel sistem/resmi mesaj + uyarı.
-- sistem_duyurulari artık hedeflenebilir (hedef_kullanici_id) ve iki türü var
-- (mesaj | uyari). Herkese duyuru = hedef NULL (mevcut davranış). RLS: kullanıcı
-- yalnız global (NULL) + kendine gelen mesajları görür.
-- Odaya mesaj: sahibe kalıcı kopya + bildirim; "o an içeridekiler" client'tan
-- canlı broadcast ile (room-<id> kanalı) sistem baloncuğu olarak görür.
-- ÇALIŞTIRMA: 041'den SONRA.

-- ── A) Hedef + tür kolonları ───────────────────────────────────────────────
ALTER TABLE public.sistem_duyurulari
    ADD COLUMN IF NOT EXISTS hedef_kullanici_id BIGINT REFERENCES public.kullanicilar(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS tur TEXT NOT NULL DEFAULT 'mesaj' CHECK (tur IN ('mesaj', 'uyari'));
CREATE INDEX IF NOT EXISTS idx_sistem_duyuru_hedef ON public.sistem_duyurulari (hedef_kullanici_id, kanal, id DESC);

-- RLS: global (NULL) VEYA bana gelen
DROP POLICY IF EXISTS sistem_duyuru_select ON public.sistem_duyurulari;
CREATE POLICY sistem_duyuru_select ON public.sistem_duyurulari
    FOR SELECT TO authenticated
    USING (hedef_kullanici_id IS NULL OR hedef_kullanici_id = public.benim_kullanici_id());

-- ── B) RPC: kişiye özel mesaj / uyarı ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kisiye_mesaj_gonder(
    p_hedef BIGINT, p_kanal TEXT, p_baslik TEXT, p_icerik TEXT,
    p_tur TEXT DEFAULT 'mesaj', p_foto TEXT DEFAULT NULL, p_bildirim BOOLEAN DEFAULT TRUE)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    IF p_kanal NOT IN ('aron', 'sistem') THEN RAISE EXCEPTION 'Geçersiz kanal.'; END IF;
    IF COALESCE(p_tur, 'mesaj') NOT IN ('mesaj', 'uyari') THEN RAISE EXCEPTION 'Geçersiz tür.'; END IF;
    IF p_hedef IS NULL OR NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE id = p_hedef) THEN RAISE EXCEPTION 'Hedef kullanıcı yok.'; END IF;
    IF p_baslik IS NULL OR length(trim(p_baslik)) = 0 OR p_icerik IS NULL OR length(trim(p_icerik)) = 0 THEN
        RAISE EXCEPTION 'Başlık ve içerik gerekli.';
    END IF;
    INSERT INTO public.sistem_duyurulari (kanal, baslik, icerik, foto_url, gonderen_id, hedef_kullanici_id, tur)
    VALUES (p_kanal, trim(p_baslik), trim(p_icerik), NULLIF(trim(COALESCE(p_foto, '')), ''),
            public.benim_kullanici_id(), p_hedef, COALESCE(p_tur, 'mesaj'))
    RETURNING id INTO v_id;

    IF p_bildirim THEN
        INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
        VALUES (p_hedef, 'sistem', trim(p_baslik), trim(p_icerik),
                jsonb_build_object('duyuru', v_id, 'kanal', p_kanal, 'tur', COALESCE(p_tur, 'mesaj'),
                                   'foto', NULLIF(trim(COALESCE(p_foto, '')), '')));
    END IF;

    PERFORM public._yonetici_log('kullanici', p_hedef,
        CASE WHEN p_tur = 'uyari' THEN 'uyari_gonder' ELSE 'mesaj_gonder' END,
        p_kanal || ' · ' || trim(p_baslik));
    RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.kisiye_mesaj_gonder(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.kisiye_mesaj_gonder(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── C) RPC: odaya mesaj / uyarı (sahibe kalıcı kopya + bildirim) ────────────
-- "O an içeridekiler" client'tan canlı broadcast ile ulaşır (room-<id> kanalı).
CREATE OR REPLACE FUNCTION public.odaya_mesaj_gonder(
    p_oda BIGINT, p_baslik TEXT, p_icerik TEXT, p_tur TEXT DEFAULT 'mesaj', p_bildirim BOOLEAN DEFAULT TRUE)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_sahip BIGINT; v_id BIGINT;
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN RAISE EXCEPTION 'Yetkin yok.'; END IF;
    IF COALESCE(p_tur, 'mesaj') NOT IN ('mesaj', 'uyari') THEN RAISE EXCEPTION 'Geçersiz tür.'; END IF;
    IF p_baslik IS NULL OR length(trim(p_baslik)) = 0 OR p_icerik IS NULL OR length(trim(p_icerik)) = 0 THEN
        RAISE EXCEPTION 'Başlık ve içerik gerekli.';
    END IF;
    SELECT olusturan_id INTO v_sahip FROM public.odalar WHERE id = p_oda;

    IF v_sahip IS NOT NULL THEN
        INSERT INTO public.sistem_duyurulari (kanal, baslik, icerik, gonderen_id, hedef_kullanici_id, tur)
        VALUES ('sistem', trim(p_baslik), trim(p_icerik), public.benim_kullanici_id(), v_sahip, COALESCE(p_tur, 'mesaj'))
        RETURNING id INTO v_id;
        IF p_bildirim THEN
            INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
            VALUES (v_sahip, 'sistem', trim(p_baslik), trim(p_icerik),
                    jsonb_build_object('duyuru', v_id, 'kanal', 'sistem', 'tur', COALESCE(p_tur, 'mesaj'), 'oda', p_oda));
        END IF;
    END IF;

    PERFORM public._yonetici_log('oda', p_oda,
        CASE WHEN p_tur = 'uyari' THEN 'uyari_gonder' ELSE 'mesaj_gonder' END, trim(p_baslik));
    RETURN COALESCE(v_id, 0);
END; $$;
REVOKE ALL ON FUNCTION public.odaya_mesaj_gonder(BIGINT, TEXT, TEXT, TEXT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.odaya_mesaj_gonder(BIGINT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
