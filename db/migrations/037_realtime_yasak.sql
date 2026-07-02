-- ============================================================================
-- 037_realtime_yasak.sql — Yasak tablolarını Realtime yayınına ekle
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 028 (mic_yasaklari) + 035 (hesap_yasaklari)'ten SONRA.
--
-- Yönetici bir hesabı/mikrofonu YASAKLADIĞI ANDA, kullanıcının cihazı bunu
-- canlı görüp tepki verebilsin diye bu tabloları `supabase_realtime`
-- publication'ına ekleriz. RLS SELECT politikaları (kişi kendi satırını görür)
-- realtime teslimini de kısıtlar → kullanıcı yalnızca KENDİ yasak satırını alır.
-- İstemci `kullanici_id=eq.<benim_id>` filtresiyle dinler; olay gelince
-- hesap yasağında oturumu kapatıp tam ekran engel gösterir, mic yasağında
-- oda içi durumu tazeler.
--
-- Idempotent: zaten ekliyse dokunmaz; publication yoksa (beklenmez) atlar.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        RAISE NOTICE 'supabase_realtime publication yok — atlanıyor.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hesap_yasaklari'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hesap_yasaklari;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mic_yasaklari'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.mic_yasaklari;
    END IF;
END $$;

-- Silme (yasak kaldırma) olaylarının da kullanici_id ile teslim edilebilmesi
-- için PK yeterli; yine de güvenli tarafta kalmak için FULL replica identity.
ALTER TABLE public.hesap_yasaklari REPLICA IDENTITY FULL;
ALTER TABLE public.mic_yasaklari REPLICA IDENTITY FULL;
