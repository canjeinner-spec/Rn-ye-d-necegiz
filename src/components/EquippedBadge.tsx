import { Image } from "expo-image";

import { PNG_BADGE_IMG } from "@/components/PngBadge";
import { ROOM_BADGE_IMG } from "@/components/RoomBadges";

/**
 * Kullanıcının kuşandığı rozet (kullanicilar.kusanilan_rozet).
 *
 * Rozet `kod`'u uygulamadaki PNG anahtarıyla birebir aynı: seviye/rol/özel
 * rozetleri PngBadge haritasında, oda ve başarı rozetleri RoomBadges
 * haritasında. Kod bulunamazsa hiçbir şey çizilmez (eski/kaldırılmış rozet).
 */
export function EquippedBadge({ kod, size = 28 }: { kod?: string | null; size?: number }) {
  if (!kod) return null;
  const png = PNG_BADGE_IMG as Record<string, number>;
  const room = ROOM_BADGE_IMG as Record<string, number>;
  const src = png[kod] ?? room[kod] ?? null;
  if (!src) return null;
  return <Image source={src} style={{ width: size, height: size }} contentFit="contain" />;
}
