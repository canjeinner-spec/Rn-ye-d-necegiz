-- ============================================================================
-- 015_owner_comment_delete.sql — Gönderi sahibi de yorum/yanıt silebilsin
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 009'dan SONRA (Supabase SQL Editor).
--
-- Önceki yorum_sil yalnızca yorumun SAHİBİNE izin veriyordu. Artık GÖNDERİ
-- SAHİBİ de kendi gönderisindeki her yorum/yanıtı silebilir (mantıklı yetki).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.yorum_sil(p_yorum_id BIGINT)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_me      BIGINT := public.benim_kullanici_id();
    v_gonderi BIGINT;
    v_author  BIGINT;
    v_owner   BIGINT;
    v_count   INTEGER;
BEGIN
    SELECT gonderi_id, kullanici_id INTO v_gonderi, v_author
    FROM public.gonderi_yorumlari WHERE id = p_yorum_id AND silinmis = FALSE;
    IF v_gonderi IS NULL THEN RETURN FALSE; END IF;

    SELECT kullanici_id INTO v_owner FROM public.gonderiler WHERE id = v_gonderi;

    -- Yetki: yorumun sahibi VEYA gönderinin sahibi
    IF v_author IS DISTINCT FROM v_me AND v_owner IS DISTINCT FROM v_me THEN
        RETURN FALSE;
    END IF;

    UPDATE public.gonderi_yorumlari SET silinmis = TRUE WHERE id = p_yorum_id AND silinmis = FALSE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN RETURN FALSE; END IF;

    -- Üst yorumsa altındaki yanıtları da gizle
    UPDATE public.gonderi_yorumlari SET silinmis = TRUE WHERE ust_yorum_id = p_yorum_id AND silinmis = FALSE;
    RETURN TRUE;
END;
$$;
