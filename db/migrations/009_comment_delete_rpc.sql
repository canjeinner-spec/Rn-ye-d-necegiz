-- ============================================================================
-- 009_comment_delete_rpc.sql — Yorum/yanıt silme (garantili soft-delete)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 006'dan SONRA (Supabase SQL Editor).
--
-- Yorum/yanıt silme yereldeydi; DB'ye yazmadığı için yenileyince geri geliyordu.
-- SECURITY DEFINER RPC: yalnızca kendi yorumunu/yanıtını siler; üst yorum
-- silinirse altındaki yanıtlar da gizlenir (thread temizliği).
-- benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.yorum_sil(p_yorum_id BIGINT)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Yalnızca kendi yorumun/yanıtın
    UPDATE public.gonderi_yorumlari
       SET silinmis = TRUE
     WHERE id = p_yorum_id
       AND kullanici_id = public.benim_kullanici_id()
       AND silinmis = FALSE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
        RETURN FALSE; -- senin değil / bulunamadı
    END IF;

    -- Üst yorumsa altındaki yanıtları da gizle
    UPDATE public.gonderi_yorumlari
       SET silinmis = TRUE
     WHERE ust_yorum_id = p_yorum_id
       AND silinmis = FALSE;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.yorum_sil(BIGINT) TO authenticated;
