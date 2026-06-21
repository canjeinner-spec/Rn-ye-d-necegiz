-- ============================================================================
-- 012_room_msg_fix.sql — Oda mesajı gönderme/okuma yetki düzeltmesi
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 011'den SONRA (Supabase SQL Editor).
--
-- oda_mesajlari RLS policy'leri (insert/select) odalar EXISTS'inde
-- `o.silinmis = FALSE` koşulunu kullanıyor; ancak client'ta odalar.silinmis
-- kolonu için SELECT yetkisi yoktu → alt sorgu "permission denied for column
-- silinmis" verip insert/select başarısız oluyordu ("Mesaj gönderilemedi").
-- silinmis hassas değil; SELECT yetkisi veriyoruz.
-- ============================================================================

GRANT SELECT (silinmis) ON public.odalar TO authenticated;
