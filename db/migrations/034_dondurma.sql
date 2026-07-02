-- ============================================================================
-- 034_dondurma.sql — Elmas / altın dondurma (yönetici cezası)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 027 + 033'ten SONRA (Supabase SQL Editor).
--
-- Dondurulan varlık: kullanıcı o varlığı HARCAYAMAZ / TRANSFER EDEMEZ
-- (alabilir, görebilir; sadece gönderim kilitlenir). Yönetici işlemleri
-- (bakiye_ekle) dondurmadan etkilenmez. Yalnızca developer/super_admin.
--   • cuzdan.elmas_dondu / altin_dondu bayrakları.
--   • admin_varlik_dondur(hedef, varlik, dondur): aç/kapat + log.
--   • bakiye_transfer: gönderen tarafın varlığı donduysa reddeder.
-- benim_kullanici_id() 003, ben_platform_yoneticisi() 021, _yonetici_log 033.
-- ============================================================================

ALTER TABLE public.cuzdan ADD COLUMN IF NOT EXISTS elmas_dondu BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.cuzdan ADD COLUMN IF NOT EXISTS altin_dondu BOOLEAN NOT NULL DEFAULT FALSE;
GRANT SELECT (kullanici_id, elmas, altin, elmas_dondu, altin_dondu, guncelleme) ON public.cuzdan TO authenticated;

-- ---- RPC: varlık dondur/çöz (yönetici) -------------------------------------
CREATE OR REPLACE FUNCTION public.admin_varlik_dondur(p_hedef BIGINT, p_varlik TEXT, p_dondur BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.ben_platform_yoneticisi() THEN
        RAISE EXCEPTION 'Dondurma işlemi için yönetici olmalısın.';
    END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN
        RAISE EXCEPTION 'Geçersiz varlık.';
    END IF;
    INSERT INTO public.cuzdan (kullanici_id) VALUES (p_hedef)
    ON CONFLICT (kullanici_id) DO NOTHING;
    IF p_varlik = 'elmas' THEN
        UPDATE public.cuzdan SET elmas_dondu = p_dondur, guncelleme = now() WHERE kullanici_id = p_hedef;
    ELSE
        UPDATE public.cuzdan SET altin_dondu = p_dondur, guncelleme = now() WHERE kullanici_id = p_hedef;
    END IF;
    PERFORM public._yonetici_log('kullanici', p_hedef,
        CASE WHEN p_dondur THEN 'varlik_dondur' ELSE 'varlik_coz' END,
        CASE WHEN p_varlik = 'elmas' THEN 'Elmas' ELSE 'Altın' END);
END; $$;
REVOKE ALL ON FUNCTION public.admin_varlik_dondur(BIGINT, TEXT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_varlik_dondur(BIGINT, TEXT, BOOLEAN) TO authenticated;

-- ---- RPC: transfer — dondurma kontrolüyle (027'yi override eder) ------------
CREATE OR REPLACE FUNCTION public.bakiye_transfer(p_hedef BIGINT, p_varlik TEXT, p_miktar BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_ben BIGINT := public.benim_kullanici_id(); v_dondu BOOLEAN;
BEGIN
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum bulunamadı.'; END IF;
    IF p_hedef = v_ben THEN RAISE EXCEPTION 'Kendine transfer yapamazsın.'; END IF;
    IF p_varlik NOT IN ('elmas', 'altin') THEN RAISE EXCEPTION 'Geçersiz varlık.'; END IF;
    IF p_miktar <= 0 THEN RAISE EXCEPTION 'Miktar pozitif olmalı.'; END IF;

    SELECT CASE WHEN p_varlik = 'elmas' THEN elmas_dondu ELSE altin_dondu END
      INTO v_dondu FROM public.cuzdan WHERE kullanici_id = v_ben;
    IF COALESCE(v_dondu, FALSE) THEN
        RAISE EXCEPTION '% bakiyen donduruldu; harcayamazsın.',
            CASE WHEN p_varlik = 'elmas' THEN 'Elmas' ELSE 'Altın' END;
    END IF;

    BEGIN
        PERFORM public._bakiye_uygula(v_ben, p_varlik, -p_miktar, 'Transfer (gönderildi)', v_ben);
    EXCEPTION WHEN check_violation THEN
        RAISE EXCEPTION 'Yetersiz bakiye.';
    END;
    PERFORM public._bakiye_uygula(p_hedef, p_varlik, p_miktar, 'Transfer (alındı)', v_ben);
END; $$;
