-- ============================================================================
-- 084_hediye_vitrini.sql — Profildeki hediye vitrini gerçek veriye
-- ----------------------------------------------------------------------------
-- ÇALIŞTIRMA: 083'ten SONRA. İdempotent.
--
-- NEDEN: profildeki "Hediye Sergi Salonu" bölümünde sabit bir sayı vardı
-- ("Normal Hediyeler: 4.926 toplandı") — herkesin profilinde AYNI rakam
-- görünüyordu, 083'te kaldırıldı. Yerine gerçeği koyuyoruz: kişi hangi
-- hediyeden kaç tane aldı.
--
-- KAYNAK: `hediye_gecmisi` zaten alici_id, hediye_id ve miktar yazıyor —
-- oda içi, DM ve profil gönderimlerinin HEPSİ oraya düşüyor (059'daki tek
-- yol). Yani vitrin nereden gönderildiğine bakmaksızın toplu gösteriyor.
--
-- Pasife alınmış hediyeler de listeleniyor (082 ile 29 hediye pasife
-- alınmıştı): kişi onları gerçekten aldıysa vitrininde durmalı, katalogdan
-- kalkmış olması geçmişi silmez.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hediye_vitrini(p_kullanici BIGINT)
RETURNS TABLE (
    hediye_id INTEGER,
    kod       TEXT,
    ad        TEXT,
    emoji     TEXT,
    renk1     TEXT,
    renk2     TEXT,
    kademe    TEXT,
    adet      BIGINT,
    deger     BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    SELECT h.hediye_id,
           g.kod::TEXT,
           COALESCE(g.ad, 'Hediye')::TEXT,
           COALESCE(g.emoji, '🎁')::TEXT,
           COALESCE(g.renk1, '#FDE68A')::TEXT,
           COALESCE(g.renk2, '#B45309')::TEXT,
           COALESCE(g.kademe, 'normal')::TEXT,
           SUM(h.miktar)::BIGINT,
           SUM(h.toplam_deger)::BIGINT
      FROM public.hediye_gecmisi h
      LEFT JOIN public.hediyeler g ON g.id = h.hediye_id
     WHERE h.alici_id = p_kullanici
     GROUP BY h.hediye_id, g.kod, g.ad, g.emoji, g.renk1, g.renk2, g.kademe
    HAVING SUM(h.miktar) > 0
     ORDER BY SUM(h.toplam_deger) DESC, SUM(h.miktar) DESC
     LIMIT 60;
$fn$;

REVOKE ALL ON FUNCTION public.hediye_vitrini(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hediye_vitrini(BIGINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- DOĞRULAMA:
--   SELECT * FROM public.hediye_vitrini(9);
-- Hiç hediye ALMAMIŞSA boş döner — doğru davranış; eskiden herkeste sabit
-- 4.926 yazıyordu.
-- ---------------------------------------------------------------------------
