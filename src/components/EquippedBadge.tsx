import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";

import { BadgeInfoModal } from "@/components/BadgeInfoModal";
import { PNG_BADGE_IMG } from "@/components/PngBadge";
import { ROOM_BADGE_IMG } from "@/components/RoomBadges";
import { BADGE_INFO } from "@/data/badgeInfo";
import { getBadgeCatalog, type RozetTanim } from "@/data/remote/badgeRepo";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";

/** Kategori başlığı — bilgi kartındaki küçük etiket. */
const KATEGORI_ADI: Record<string, string> = {
  level: "Seviye Rütbesi",
  role: "Rol",
  special: "Özel Rozet",
  oda: "Oda Rozeti",
  basari: "Başarı",
};

/** Kategoriye göre vurgu rengi — kartın parıltısı ve etiketi bunu kullanır. */
const KATEGORI_RENK: Record<string, string> = {
  level: "#F5B100",
  role: "#A98CFF",
  special: "#38BDF8",
  oda: "#5AA9FF",
  basari: "#4ADE80",
};

/** kod -> görsel. level_/role_/special_ PngBadge'de, oda/başarı RoomBadges'te. */
function rozetGorseli(kod: string) {
  const png = PNG_BADGE_IMG as Record<string, number>;
  const room = ROOM_BADGE_IMG as Record<string, number>;
  return png[kod] ?? room[kod] ?? null;
}

/**
 * Kullanıcının kuşandığı rozet (kullanicilar.kusanilan_rozet).
 *
 * Tıklanınca diğer rozetlerle AYNI liquid-glass bilgi kartı açılır
 * (BadgeInfoModal) — tek fark, metin uygulamadaki sabit listeden değil
 * katalogdan (`rozetler` tablosu) geliyor. Böylece yeni eklenen rozetlerin
 * açıklaması kendiliğinden görünür.
 *
 * Hem kendi profilinde hem başkasının gördüğü profilde aynı bileşen çalışır.
 */
export function EquippedBadge({ kod, size = 28 }: { kod?: string | null; size?: number }) {
  const [acik, setAcik] = useState(false);
  const [tanim, setTanim] = useState<RozetTanim | null>(null);

  useEffect(() => {
    if (!acik || !kod || !isSupabaseConfigured) return;
    let alive = true;
    getBadgeCatalog()
      .then((m) => { if (alive) setTanim(m.get(kod) ?? null); })
      .catch(() => { if (alive) setTanim(null); });
    return () => { alive = false; };
  }, [acik, kod]);

  if (!kod) return null;
  const src = rozetGorseli(kod);
  if (!src) return null;

  // Renk: rozet zaten sabit listede tanımlıysa onun tonu (birebir tutarlılık),
  // değilse kategorisinin tonu.
  const sabit = (BADGE_INFO as Record<string, { tint: string } | undefined>)[kod];
  const tint = sabit?.tint ?? KATEGORI_RENK[tanim?.kategori ?? ""] ?? "#F5CE6E";

  return (
    <>
      <Pressable hitSlop={4} onPress={() => { haptic.light(); setAcik(true); }}>
        <Image source={src} style={{ width: size, height: size }} contentFit="contain" />
      </Pressable>

      <BadgeInfoModal
        visible={acik}
        onClose={() => setAcik(false)}
        source={src}
        info={{
          title: tanim?.ad ?? "Rozet",
          sub: KATEGORI_ADI[tanim?.kategori ?? ""] ?? "Rozet",
          desc: tanim?.aciklama ?? "Açıklama yükleniyor…",
          tint,
        }}
      />
    </>
  );
}
