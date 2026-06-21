-- ============================================================================
-- 008_post_delete_rpc.sql — Gönderi silme (garantili soft-delete)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 003-007'den SONRA (Supabase SQL Editor).
--
-- Neden RPC: kolon-yetkisi (silinmis UPDATE) veya RLS RETURNING kenar
-- durumları yüzünden client update bazen 0 satır etkiliyordu → gönderi geri
-- geliyordu. SECURITY DEFINER fonksiyon bunları bypass eder; WHERE ile yalnızca
-- kendi gönderini siler. benim_kullanici_id() 003'te tanımlı.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.gonderi_sil(p_gonderi_id BIGINT)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.gonderiler
       SET silinmis = TRUE,
           silinme_tarihi = now()
     WHERE id = p_gonderi_id
       AND kullanici_id = public.benim_kullanici_id()
       AND silinmis = FALSE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0; -- true: silindi, false: senin değil / bulunamadı
END;
$$;

GRANT EXECUTE ON FUNCTION public.gonderi_sil(BIGINT) TO authenticated;
