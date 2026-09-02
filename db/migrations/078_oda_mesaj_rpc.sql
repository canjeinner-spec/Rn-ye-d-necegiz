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
