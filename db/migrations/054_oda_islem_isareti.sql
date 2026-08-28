-- ═══════════════════════════════════════════════════════════════════════════
-- 054_oda_islem_isareti.sql — "Bu odaya işlem yapıldı" işareti
--
-- NEDEN:
--   Yönetici bir odaya işlem yaptığında (uygunsuz içerik, kural ihlali) bu
--   yalnızca yönetici loguna yazılıyordu; odanın kendisinde kalıcı bir durum
--   yoktu. Bu yüzden:
--     • oda sahibi işlem görmüş odanın bilgilerini serbestçe düzenlemeye
--       devam edebiliyordu (adı değiştirip izi kaybettirmek dahil),
--     • odaya giren kullanıcı hiçbir uyarı görmüyordu.
--
-- NE EKLİYOR:
--   • odalar.islem_gordu   — işaretli mi
--   • odalar.islem_sebep   — kullanıcıya ve sahibe gösterilecek sebep
--   • odalar.islem_tarihi  — ne zaman işaretlendi
--   • admin_oda_islem_isaretle(oda, isaretli, sebep) — yalnız yönetici, loglu
--
-- Idempotent: tekrar çalıştırmak güvenlidir.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.odalar ADD COLUMN IF NOT EXISTS islem_gordu BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.odalar ADD COLUMN IF NOT EXISTS islem_sebep TEXT;
ALTER TABLE public.odalar ADD COLUMN IF NOT EXISTS islem_tarihi TIMESTAMPTZ;

-- Herkes görebilmeli: odaya girenin uyarılabilmesi için gerekli.
GRANT SELECT (islem_gordu, islem_sebep, islem_tarihi) ON public.odalar TO anon, authenticated;

-- ── İşaretle / kaldır — yalnız yönetici ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_oda_islem_isaretle(
    p_oda      BIGINT,
    p_isaretli BOOLEAN,
    p_sebep    TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;

    UPDATE public.odalar
       SET islem_gordu  = COALESCE(p_isaretli, FALSE),
           islem_sebep  = CASE WHEN p_isaretli THEN NULLIF(trim(COALESCE(p_sebep, '')), '') ELSE NULL END,
           islem_tarihi = CASE WHEN p_isaretli THEN now() ELSE NULL END
     WHERE id = p_oda;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Oda bulunamadı.';
    END IF;

    PERFORM public._yonetici_log(
        'oda', p_oda,
        CASE WHEN p_isaretli THEN 'oda_islem_isaretle' ELSE 'oda_islem_kaldir' END,
        CASE WHEN p_isaretli THEN COALESCE(NULLIF(trim(COALESCE(p_sebep, '')), ''), 'Sebep belirtilmedi')
             ELSE 'İşlem işareti kaldırıldı' END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_oda_islem_isaretle(BIGINT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_oda_islem_isaretle(BIGINT, BOOLEAN, TEXT) TO authenticated;

-- ── Oda sahibi işlem görmüş odayı düzenleyemesin ────────────────────────────
-- 003'teki odalar_update politikası yalnız sahipliğe bakıyordu; işaretli odada
-- sahip adı/kapağı değiştirip izi kaybettirebiliyordu. Politika, işaretli
-- odalarda sahibin UPDATE'ini engelleyecek şekilde yeniden tanımlanıyor.
-- Yönetici SECURITY DEFINER fonksiyonlarla düzenlemeye devam eder (RLS onları
-- bağlamaz), yani işareti kaldırmak da mümkün kalır.
DROP POLICY IF EXISTS odalar_update ON public.odalar;
CREATE POLICY odalar_update ON public.odalar
    FOR UPDATE TO authenticated
    USING (olusturan_id = public.benim_kullanici_id() AND islem_gordu = FALSE)
    WITH CHECK (olusturan_id = public.benim_kullanici_id() AND islem_gordu = FALSE);

-- ── Yönetici oda getir: yeni alanları da döndür ─────────────────────────────
-- Dönüş imzası değiştiği için DROP + yeniden tanım gerekiyor.
DROP FUNCTION IF EXISTS public.admin_oda_getir(BIGINT);
CREATE FUNCTION public.admin_oda_getir(p_oda BIGINT)
RETURNS TABLE (
    id BIGINT, public_id TEXT, ad TEXT, aciklama TEXT, kategori TEXT, kapak_url TEXT,
    herkese_acik BOOLEAN, olusturan_id BIGINT, sahip_ad TEXT, sahip_public_id TEXT,
    uye_sayisi BIGINT, aktif_katilimci INT,
    islem_gordu BOOLEAN, islem_sebep TEXT, islem_tarihi TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Yetkin yok.';
    END IF;
    RETURN QUERY
    SELECT o.id::bigint, o.public_id::text, o.ad::text, o.aciklama::text, o.kategori::text, o.kapak_url::text,
           o.herkese_acik::boolean, o.olusturan_id::bigint, k.kullanici_adi::text, k.public_id::text,
           (SELECT count(*) FROM public.oda_uyeleri u WHERE u.oda_id = o.id)::bigint,
           o.aktif_katilimci_sayisi::int,
           o.islem_gordu::boolean, o.islem_sebep::text, o.islem_tarihi
      FROM public.odalar o
      LEFT JOIN public.kullanicilar k ON k.id = o.olusturan_id
     WHERE o.id = p_oda;
END; $$;

REVOKE ALL ON FUNCTION public.admin_oda_getir(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_oda_getir(BIGINT) TO authenticated;
