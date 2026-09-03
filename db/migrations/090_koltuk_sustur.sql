-- ============================================================================
-- 090_koltuk_sustur.sql — Başkasını susturmak SUNUCUYA taşındı (Faz 2.1)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 089'dan SONRA. İdempotent.
--
-- NOT — NUMARA: plan bu dosyaya 086 diyordu ama 086-089 araya giren hediye
-- işine gitti. Yeni dosya açmadan önce `ls db/migrations` ile son numaraya
-- bakmak kural (yol haritası, "Migration düzeni").
--
-- SORUN: "Sustur" tamamen YERELDİ. `room.tsx`teki `onMute` yalnız kendi
-- ekranındaki diziyi değiştiriyordu:
--     onMute: () => setSeats((p) => p.map((t) => ... { ...t, muted: !t.muted }))
-- Yani yönetici birini susturduğunu sanıyor, karşı taraf konuşmaya devam
-- ediyor ve odadaki kimse de değişikliği görmüyordu. Mikrofondan indirme ve
-- sıra onayı 069-073'te sunucuya taşınmıştı; sustur atlanmış.
--
-- KAPI: `_oda_moderatoru` (072'de düzeltilen sözlük — sahip + yardimci +
-- platform yöneticisi).
--
-- SAHİP KOLTUĞU (20): yalnız platform yöneticisi susturabilir. Oda sahibini
-- kendi odasında yardımcısının susturabilmesi anlamsız olurdu.
--
-- HEDEF KOLTUKTA DEĞİLSE SESSİZ ÇIKIŞ: yarış hâlinde (kişi tam o anda
-- kalktı) hata fırlatmak kullanıcıya yanlış bir başarısızlık gösterir;
-- istenen durum zaten sağlanmış oluyor.
--
-- BİLİNÇLİ SINIR: hedef `koltuk_mic` ile kendi mikrofonunu geri açabilir.
-- Sustur SOSYAL bir uyarı; kalıcı yaptırım `mic_yasak_ver` (028).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.koltuk_sustur(p_oda BIGINT, p_hedef BIGINT, p_sustur BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
    v_ben     BIGINT := public.benim_kullanici_id();
    v_koltuk  INTEGER;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF NOT public._oda_moderatoru(p_oda) THEN
        RAISE EXCEPTION 'Bu işlem için yetkin yok.';
    END IF;

    SELECT koltuk_no INTO v_koltuk
      FROM public.oda_koltuklari
     WHERE oda_id = p_oda AND kullanici_id = p_hedef
     LIMIT 1;

    -- Hedef koltukta değil: sessiz çık (yukarıdaki gerekçe).
    IF v_koltuk IS NULL THEN RETURN; END IF;

    IF v_koltuk = 20 AND NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Oda sahibinin mikrofonunu kapatamazsın.';
    END IF;

    -- Koşullu UPDATE: durum zaten istenen hâldeyse satıra dokunulmuyor,
    -- gereksiz realtime olayı üretilmiyor.
    UPDATE public.oda_koltuklari
       SET susturulmus = p_sustur
     WHERE oda_id = p_oda
       AND kullanici_id = p_hedef
       AND susturulmus IS DISTINCT FROM p_sustur;
END; $fn$;

REVOKE ALL ON FUNCTION public.koltuk_sustur(BIGINT, BIGINT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.koltuk_sustur(BIGINT, BIGINT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA:
--   -- yetkili hesapla (oda 9, hedef 12):
--   SELECT public.koltuk_sustur(9, 12, TRUE);
--   SELECT koltuk_no, kullanici_id, susturulmus
--     FROM public.oda_koltuklari WHERE oda_id = 9 ORDER BY koltuk_no;
--   -- sıradan üye hesabıyla aynı çağrı 'Bu işlem için yetkin yok.' vermeli.
-- ---------------------------------------------------------------------------
