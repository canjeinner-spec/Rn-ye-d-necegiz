-- ============================================================================
-- 081_hediye_herkese.sql — "Herkese" hediye GERÇEKTEN gönderilsin
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 080'den SONRA. İdempotent.
--
-- SORUN (kullanıcı bildirdi): odada hediye gönderince bakiyeden düşmüyor,
-- altın yasağı verilmesine rağmen hediye gidiyor.
--
-- KÖK SEBEP — sunucuya HİÇ GELİNMİYORDU. `GiftSheet`te alıcı seçimi
-- `useState(0)` ile başlıyor ve 0 = "Herkese". O seçenekte alıcı uid'i
-- üretilmediği için `room.tsx` `sendGift` RPC çağrısını atlıyor, yalnız
-- animasyon oynuyordu. Kullanıcı özellikle bir kişi seçmedikçe HER hediye
-- bedavaydı: bakiye düşmüyor, trigger çalışmıyor, dolayısıyla yasak da
-- kontrol edilmiyor ve `hediye_gecmisi` boş kalıyordu (teşhiste tek satır
-- bile yoktu — bu, hediye sisteminin hiç kullanılmadığının kanıtıydı).
--
-- ÇÖZÜM: "Herkese" için gerçek bir RPC. Odadaki herkese TEK İŞLEMDE gönderir;
-- altın yetmezse tamamı geri alınır (yarım gönderim yok).
--
-- ÜCRET: alıcı BAŞINA. 3 kişilik odada 100 altınlık hediye = 300 altın.
-- İstemci de aynı çarpımı gösteriyor, sürpriz olmasın.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hediye_gonder_herkese(
    p_hediye_id INTEGER,
    p_miktar    INTEGER,
    p_oda_id    BIGINT,
    p_mesaj     TEXT DEFAULT NULL)
RETURNS TABLE (alici_sayisi INTEGER, toplam BIGINT, altin BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben    BIGINT := public.benim_kullanici_id();
    v_alici  BIGINT;
    v_sayi   INTEGER := 0;
    v_toplam BIGINT := 0;
    v_bu     BIGINT;
    v_alt    BIGINT;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_miktar IS NULL OR p_miktar <= 0 OR p_miktar > 10000 THEN
        RAISE EXCEPTION 'Geçersiz adet.';
    END IF;
    IF p_oda_id IS NULL THEN RAISE EXCEPTION 'Oda gerekli.'; END IF;

    -- Alıcılar: odada CANLI olanlar (070'in 2 dk kalp atışı eşiği, 079 ile
    -- aynı kural). Kendim hariç.
    FOR v_alici IN
        SELECT ok.kullanici_id
          FROM public.oda_katilimcilar ok
         WHERE ok.oda_id = p_oda_id
           AND ok.kullanici_id <> v_ben
           AND ok.last_heartbeat > now() - INTERVAL '2 minutes'
         ORDER BY ok.kullanici_id
    LOOP
        -- Her alıcı için tek satır: fiyat, komisyon, altın düşümü ve alıcının
        -- kazancı hep `hediye_gonder_fn` trigger'ında. Burada muhasebe YOK.
        INSERT INTO public.hediye_gecmisi (
            gonderen_id, alici_id, hediye_id, miktar,
            birim_fiyat, toplam_deger, komisyon_orani, kazanc_miktari, platform_geliri,
            oda_id, mesaj, idempotency_key)
        VALUES (
            v_ben, v_alici, p_hediye_id, p_miktar,
            0, 0, 0, 0, 0,
            p_oda_id, p_mesaj,
            md5(random()::TEXT || clock_timestamp()::TEXT || v_alici::TEXT))
        RETURNING toplam_deger INTO v_bu;

        v_sayi   := v_sayi + 1;
        v_toplam := v_toplam + COALESCE(v_bu, 0);
    END LOOP;

    IF v_sayi = 0 THEN
        RAISE EXCEPTION 'Odada hediye gönderilecek kimse yok.';
    END IF;

    SELECT cached_altin_balance INTO v_alt FROM public.kullanicilar WHERE id = v_ben;
    RETURN QUERY SELECT v_sayi, v_toplam, COALESCE(v_alt, 0);
END; $fn$;

REVOKE ALL ON FUNCTION public.hediye_gonder_herkese(INTEGER, INTEGER, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hediye_gonder_herkese(INTEGER, INTEGER, BIGINT, TEXT) TO authenticated;
