-- ============================================================================
-- 051_rozet_kusanma_kurallari.sql — Seviye rütbeleri kuşanılamaz
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 050'den SONRA.
--
-- Seviye rütbeleri (Bronze…Legendary) kullanıcının seçimi değil, SİSTEMİN
-- belirlediği bir sonuçtur — seviyen neyse rütben odur. Bu yüzden kuşanılıp
-- çıkarılabilir olmamalı. Arayüzde buton gizlendi; burada sunucu tarafında
-- da kapatılıyor (istemci atlatılsa bile geçmesin).
--
-- Ayrıca: zaten kuşanılan rozet tekrar kuşanılmaya çalışılırsa sessizce
-- geçilir (aynı değer yazılır, hata verilmez) — mükerrer kayıt zaten
-- kullanici_rozetleri'ndeki benzersiz index ile engelli.
--
-- Idempotent (CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rozet_kusan(p_kod TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_ben   BIGINT;
    v_rozet BIGINT;
    v_kat   TEXT;
BEGIN
    v_ben := public.benim_kullanici_id();
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum yok.'; END IF;

    SELECT id, kategori INTO v_rozet, v_kat
      FROM public.rozetler WHERE kod = p_kod AND aktif;
    IF v_rozet IS NULL THEN RAISE EXCEPTION 'Rozet bulunamadı: %', p_kod; END IF;

    -- Rol rozetleri yetkiden gelir, seviye rütbelerini sistem belirler:
    -- ikisi de kuşanma/çıkarma dışında.
    IF v_kat = 'role'  THEN RAISE EXCEPTION 'Rol rozeti kuşanılamaz.'; END IF;
    IF v_kat = 'level' THEN RAISE EXCEPTION 'Seviye rütbesi kuşanılamaz — seviyeni sistem belirler.'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.kullanici_rozetleri
         WHERE kullanici_id = v_ben AND rozet_id = v_rozet
    ) THEN
        RAISE EXCEPTION 'Bu rozeti henüz kazanmadın.';
    END IF;

    UPDATE public.kullanicilar SET kusanilan_rozet = p_kod WHERE id = v_ben;
END; $$;
REVOKE ALL ON FUNCTION public.rozet_kusan(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rozet_kusan(TEXT) TO authenticated;

-- Seviye rütbesi kuşanmış kullanıcı varsa temizle (kural öncesi kalmış olabilir).
UPDATE public.kullanicilar k
   SET kusanilan_rozet = NULL
  FROM public.rozetler r
 WHERE r.kod = k.kusanilan_rozet
   AND r.kategori IN ('level', 'role');
