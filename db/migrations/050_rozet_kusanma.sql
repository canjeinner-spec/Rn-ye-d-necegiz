-- ============================================================================
-- 050_rozet_kusanma.sql — Rozet kuşanma + kategori ayrımı (oda / başarı)
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 044 (profiller view) + 049 (rozet sistemi)'nden SONRA.
--
--   • Kullanıcı kazandığı bir rozeti KUŞANABİLİR; kuşanılan rozet hem kendi
--     profilinde hem BAŞKALARININ gördüğü profilde görünür.
--   • `room` kategorisi ikiye ayrılır: `oda` (oda sahipliği/sıralaması) ve
--     `basari` (kişisel başarılar). Koleksiyon ekranı iki ayrı başlık gösterir.
--
-- Idempotent.
-- ============================================================================

-- ── A) Kuşanılan rozet kolonu ───────────────────────────────────────────────
ALTER TABLE public.kullanicilar
    ADD COLUMN IF NOT EXISTS kusanilan_rozet TEXT;

-- İstemci yalnızca okuyabilir; yazma RPC üzerinden (sahiplik doğrulanır).
GRANT SELECT (kusanilan_rozet) ON public.kullanicilar TO authenticated;

-- ── B) profiller view'ine ekle ──────────────────────────────────────────────
-- NOT: CREATE OR REPLACE VIEW mevcut kolonların sıra/adını DEĞİŞTİREMEZ;
-- yeni kolon yalnızca SONA eklenir. 044'teki 16 kolon aynen korunuyor.
CREATE OR REPLACE VIEW public.profiller WITH (security_invoker = off) AS
SELECT
    id, public_id, kullanici_adi, profil_resmi, biyografi,
    cinsiyet, ulke, sehir, seviye_id, deneyim_puani, durum,
    ekonomi_rolu, olusturulma_tarihi,
    ozel_id, ozel_id_tip, ozel_id_tema,
    kusanilan_rozet
FROM public.kullanicilar
WHERE silinmis = FALSE;
GRANT SELECT ON public.profiller TO authenticated, anon;

-- ── C) Kategori ayrımı: oda / basari ────────────────────────────────────────
-- Oda ile ilgili olanlar (sahiplik, oda sıralaması) → 'oda'
UPDATE public.rozetler SET kategori = 'oda'
 WHERE kod IN (
    'room_owner','co_owner','room_king','room_king_v2','room_queen',
    'room2','room3','room4','room5',
    'weekly_champion','weekly_top1','weekly_top2','weekly_top3',
    'rank_bronze','rank_silver','rank_pusher'
 );

-- Geri kalan tüm 'room' rozetleri kişisel başarı → 'basari'
UPDATE public.rozetler SET kategori = 'basari' WHERE kategori = 'room';

-- ── D) RPC: rozet kuşan ─────────────────────────────────────────────────────
-- Yalnızca KAZANILMIŞ bir rozet kuşanılabilir. Rol rozetleri kuşanılmaz
-- (onlar zaten yetkiden gelir ve profilde otomatik görünür).
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
    IF v_kat = 'role' THEN RAISE EXCEPTION 'Rol rozeti kuşanılamaz.'; END IF;

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

-- ── E2) Eski premium çerçeve anahtarlarını yeni sete eşle ───────────────────
-- Premium ÖZEL ID çerçeveleri yenilendi: eski set premium_01..60 (ID görsele
-- çiziliydi, bazılarında rakamlar silinmişti), yeni set premium_001..024
-- (içi boş, ID'yi uygulama yazıyor). Eski anahtarla kayıtlı kullanıcılarda
-- çerçeve bulunamıyordu. Deterministik olarak yeni sete eşliyoruz.
UPDATE public.kullanicilar
   SET ozel_id_tema = 'premium_' || lpad(((((substring(ozel_id_tema from 9))::int - 1) % 24) + 1)::text, 3, '0')
 WHERE ozel_id_tip = 'premium'
   AND ozel_id_tema ~ '^premium_[0-9]{2}$';

-- ── E) RPC: kuşanmayı kaldır ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rozet_kusanma_kaldir()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_ben BIGINT;
BEGIN
    v_ben := public.benim_kullanici_id();
    IF v_ben IS NULL THEN RAISE EXCEPTION 'Oturum yok.'; END IF;
    UPDATE public.kullanicilar SET kusanilan_rozet = NULL WHERE id = v_ben;
END; $$;
REVOKE ALL ON FUNCTION public.rozet_kusanma_kaldir() FROM public;
GRANT EXECUTE ON FUNCTION public.rozet_kusanma_kaldir() TO authenticated;
