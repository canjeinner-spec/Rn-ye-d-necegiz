-- ============================================================================
-- 014_reply_notif.sql — Yanıt bildirimi (yorum trigger güncellemesi)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 013'ten SONRA (Supabase SQL Editor).
--
-- Önceki bildirim_yorum hep gönderi sahibine bildiriyordu; yanıt (ust_yorum_id)
-- durumunda YANITLANAN YORUMUN sahibine bildirim gitmeliydi (Twitter gibi).
-- Trigger zaten gonderi_yorumlari INSERT'inde tetikleniyor; sadece fonksiyonu
-- güncelliyoruz.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bildirim_yorum()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_owner BIGINT; v_pub TEXT; v_actor TEXT; v_target BIGINT;
BEGIN
    SELECT kullanici_id, public_id INTO v_owner, v_pub FROM public.gonderiler WHERE id = NEW.gonderi_id;
    SELECT kullanici_adi INTO v_actor FROM public.kullanicilar WHERE id = NEW.kullanici_id;

    IF NEW.ust_yorum_id IS NULL THEN
        -- Üst-seviye yorum → gönderi sahibine
        v_target := v_owner;
        IF v_target IS NULL OR v_target = NEW.kullanici_id THEN RETURN NULL; END IF;
        INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
        VALUES (v_target, 'yorum', 'Yeni yorum', COALESCE(v_actor, 'Biri') || ' gönderine yorum yaptı.',
                jsonb_build_object('gonderi', v_pub, 'actor', NEW.kullanici_id));
    ELSE
        -- Yanıt → yanıtlanan yorumun sahibine
        SELECT kullanici_id INTO v_target FROM public.gonderi_yorumlari WHERE id = NEW.ust_yorum_id;
        IF v_target IS NULL OR v_target = NEW.kullanici_id THEN RETURN NULL; END IF;
        INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
        VALUES (v_target, 'yorum', 'Yeni yanıt', COALESCE(v_actor, 'Biri') || ' yorumunu yanıtladı.',
                jsonb_build_object('gonderi', v_pub, 'actor', NEW.kullanici_id));
    END IF;
    RETURN NULL;
END; $$;
