-- ═══════════════════════════════════════════════════════════════════════════
-- 052_oda_vitrin.sql — Oda listesi vitrini: Resmî Oda + Daily Top sırası
--
-- NEDEN:
--   Ana sayfadaki "Resmî Oda" ve "Daily Top1/2/3" kartları yalnızca
--   uygulamadaki sahte (mock) odalarda görünüyordu; odalar tablosunda bu
--   bilgileri tutan bir kolon yoktu, mapRoom da hiç set etmiyordu. Yani
--   gerçek bir oda ne resmî olabiliyor ne de sıralamaya girebiliyordu.
--
-- NE EKLİYOR:
--   • odalar.resmi        — resmî oda rozeti (yalnız yetkili atar)
--   • odalar.gunluk_sira  — Daily Top sırası (1 = Top1). NULL = sıralamada yok
--
-- YETKİ:
--   İkisini de yalnızca developer / super_admin değiştirebilir. Kullanıcıya
--   UPDATE yetkisi VERİLMEZ; atama SECURITY DEFINER fonksiyon üzerinden olur,
--   böylece kimse kendi odasını "Resmî" yapamaz.
--
-- Idempotent: tekrar çalıştırmak güvenlidir.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.odalar ADD COLUMN IF NOT EXISTS resmi BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.odalar ADD COLUMN IF NOT EXISTS gunluk_sira SMALLINT;

-- Sıra numarası pozitif olmalı (0 veya negatif anlamsız)
ALTER TABLE public.odalar DROP CONSTRAINT IF EXISTS odalar_gunluk_sira_pozitif;
ALTER TABLE public.odalar ADD CONSTRAINT odalar_gunluk_sira_pozitif
    CHECK (gunluk_sira IS NULL OR gunluk_sira > 0);

-- Aynı sırada iki oda olamaz (Top1 tek olsun). Kısmi indeks: NULL'lar serbest.
DROP INDEX IF EXISTS idx_oda_gunluk_sira;
CREATE UNIQUE INDEX idx_oda_gunluk_sira
    ON public.odalar (gunluk_sira) WHERE gunluk_sira IS NOT NULL;

-- Liste sorgusu bu kolonlara göre sıralayacak
CREATE INDEX IF NOT EXISTS idx_oda_vitrin ON public.odalar (resmi DESC, gunluk_sira);

-- Okuma: herkes görebilir (rozet/sıra göstermek için)
GRANT SELECT (resmi, gunluk_sira) ON public.odalar TO anon, authenticated;

-- ── Atama: yalnız yetkili ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.oda_vitrin_ayarla(
    p_oda_id     BIGINT,
    p_resmi      BOOLEAN DEFAULT NULL,
    p_gunluk_sira SMALLINT DEFAULT NULL,
    p_sirayi_temizle BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rol TEXT;
BEGIN
    SELECT rol INTO v_rol FROM public.kullanicilar
     WHERE id = public.benim_kullanici_id();

    IF v_rol IS NULL OR v_rol NOT IN ('developer', 'super_admin') THEN
        RAISE EXCEPTION 'Bu işlem için yetkin yok.';
    END IF;

    -- Sıra veriliyorsa aynı sırayı tutan başka odayı boşalt (benzersiz indeks
    -- yoksa çakışır; burada önce yer açıyoruz).
    IF p_gunluk_sira IS NOT NULL THEN
        UPDATE public.odalar SET gunluk_sira = NULL
         WHERE gunluk_sira = p_gunluk_sira AND id <> p_oda_id;
    END IF;

    UPDATE public.odalar
       SET resmi = COALESCE(p_resmi, resmi),
           gunluk_sira = CASE
               WHEN p_sirayi_temizle THEN NULL
               WHEN p_gunluk_sira IS NOT NULL THEN p_gunluk_sira
               ELSE gunluk_sira
           END
     WHERE id = p_oda_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oda bulunamadı.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.oda_vitrin_ayarla(BIGINT, BOOLEAN, SMALLINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oda_vitrin_ayarla(BIGINT, BOOLEAN, SMALLINT, BOOLEAN) TO authenticated;
