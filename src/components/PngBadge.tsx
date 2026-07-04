import { Image } from "expo-image";
import { useState } from "react";
import { Pressable } from "react-native";

import { BADGE_INFO } from "@/data/badgeInfo";
import { haptic } from "@/lib/haptics";
import { BadgeInfoModal } from "./BadgeInfoModal";

const IMG = {
  level_bronze: require("@/assets/badges/level/level_bronze.png"),
  level_silver: require("@/assets/badges/level/level_silver.png"),
  level_gold: require("@/assets/badges/level/level_gold.png"),
  level_platinum: require("@/assets/badges/level/level_platinum.png"),
  level_diamond: require("@/assets/badges/level/level_diamond.png"),
  level_legendary: require("@/assets/badges/level/level_legendary.png"),
  role_developer: require("@/assets/badges/role/developer.png"),
  role_super_admin: require("@/assets/badges/role/super_admin.png"),
  role_admin: require("@/assets/badges/role/admin.png"),
  role_moderator: require("@/assets/badges/role/moderator.png"),
  role_streamer: require("@/assets/badges/role/streamer.png"),
  role_vip: require("@/assets/badges/role/vip.png"),
  role_vip_hukumdar: require("@/assets/badges/role/vip_hukumdar.png"),
  room_weekly_champion: require("@/assets/badges/room/weekly_champion.png"),
  room_rank_silver: require("@/assets/badges/room/rank_silver.png"),
  room_rank_bronze: require("@/assets/badges/room/rank_bronze.png"),
  room_rising_star: require("@/assets/badges/room/rising_star.png"),
  room_top_gifter: require("@/assets/badges/room/top_gifter.png"),
  room_daily_streak: require("@/assets/badges/room/daily_streak.png"),
  special_beta_tester: require("@/assets/badges/special/beta_tester.png"),
} as const;

export type PngBadgeName = keyof typeof IMG;

/**
 * Premium PNG rozet — kullanıcının kendi ürettiği gerçek sanat eseri.
 * Tıklanınca liquid-glass bilgi kartı açılır (info=false ile kapatılabilir).
 */
export function PngBadge({ name, size = 48, info = true }: { name: PngBadgeName; size?: number; info?: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = BADGE_INFO[name];

  if (!info || !meta) {
    return <Image source={IMG[name]} style={{ width: size, height: size }} contentFit="contain" />;
  }

  return (
    <>
      <Pressable hitSlop={4} onPress={() => { haptic.light(); setOpen(true); }}>
        <Image source={IMG[name]} style={{ width: size, height: size }} contentFit="contain" />
      </Pressable>
      <BadgeInfoModal visible={open} onClose={() => setOpen(false)} source={IMG[name]} info={meta} />
    </>
  );
}
