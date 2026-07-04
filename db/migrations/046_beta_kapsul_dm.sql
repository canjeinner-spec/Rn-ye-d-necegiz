-- ============================================================================
-- 046_beta_kapsul_dm.sql — Beta kapsül hatırlatması → Sistem DM (otomatik, 1 kez)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 041/043 (sistem_duyurulari + hedef_kullanici_id) ve 044'ten SONRA.
--
-- Beta tester olup henüz özel ID almamış kullanıcıya, uygulama açılınca OTOMATİK
-- (client `beta_kapsul_hatirlat()` çağırır) bir kez "Sistem" DM'i düşer:
-- ücretsiz kapsül hakkını Özel ID sayfasından alması için yönlendirme. Mesaj
-- mevcut sistem_duyurulari mekanizmasıyla kullanıcının "Sistem" DM thread'inde
-- görünür (kanal='sistem', hedef_kullanici_id = kendisi → yalnız o görür).
--
-- Idempotent: beta_kapsul_hatirlatildi bayrağı ile bir daha atmaz. Profildeki
-- yönlendirme banner'ı ayrıca FALLBACK olarak durur (DM gitmeme riskine karşı).
-- ============================================================================

ALTER TABLE public.kullanicilar
    ADD COLUMN IF NOT EXISTS beta_kapsul_hatirlatildi BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.beta_kapsul_hatirlat()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid  BIGINT;
    v_beta BOOLEAN;
    v_ozel TEXT;
    v_flag BOOLEAN;
    v_did  BIGINT;
BEGIN
    SELECT id, beta_tester, ozel_id, beta_kapsul_hatirlatildi
        INTO v_uid, v_beta, v_ozel, v_flag
        FROM public.kullanicilar WHERE auth_uid = (SELECT auth.uid());

    -- Koşul: beta + özel ID YOK + daha önce hatırlatılmadı
    IF v_uid IS NULL OR NOT v_beta OR v_ozel IS NOT NULL OR v_flag THEN
        RETURN;
    END IF;

    INSERT INTO public.sistem_duyurulari (kanal, baslik, icerik, gonderen_id, hedef_kullanici_id, tur)
    VALUES (
        'sistem',
        'Kapsül kimlik hakkın hazır 🎖️',
        'Beta Tester olarak ücretsiz bir Kapsül ID hakkın var. Almak için Profil → Özel ID sayfasına gidip kapsülünü seç.',
        NULL,          -- sistem kaynaklı (gönderen yok)
        v_uid,
        'mesaj'
    )
    RETURNING id INTO v_did;

    INSERT INTO public.bildirimler (kullanici_id, tip, baslik, icerik, veri)
    VALUES (
        v_uid, 'sistem', 'Kapsül kimlik hakkın hazır',
        'Ücretsiz kapsül ID için Özel ID sayfasına git.',
        jsonb_build_object('duyuru', v_did, 'kanal', 'sistem', 'tur', 'mesaj', 'beta_kapsul', true)
    );

    UPDATE public.kullanicilar SET beta_kapsul_hatirlatildi = true WHERE id = v_uid;
END;
$$;
REVOKE ALL ON FUNCTION public.beta_kapsul_hatirlat() FROM public;
GRANT EXECUTE ON FUNCTION public.beta_kapsul_hatirlat() TO authenticated;
