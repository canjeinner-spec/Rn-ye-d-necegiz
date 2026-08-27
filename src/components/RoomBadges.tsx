import { Image } from "expo-image";
import { View } from "react-native";

import { Gradient } from "@/theme/Gradient";
import { Txt } from "./Txt";

// Hiyerarşik oda rozeti seti — kullanıcının kendi ürettiği gerçek sanat eseri.
const IMG = {
  weekly_champion: require("@/assets/badges/room/weekly_champion.png"),
  rank_silver: require("@/assets/badges/room/rank_silver.png"),
  rank_bronze: require("@/assets/badges/room/rank_bronze.png"),
  rising_star: require("@/assets/badges/room/rising_star.png"),
  top_gifter: require("@/assets/badges/room/top_gifter.png"),
  daily_streak: require("@/assets/badges/room/daily_streak.png"),
  weekly_top1: require("@/assets/badges/room/weekly_top1.png"),
  weekly_top2: require("@/assets/badges/room/weekly_top2.png"),
  weekly_top3: require("@/assets/badges/room/weekly_top3.png"),
  room_owner: require("@/assets/badges/room/room_owner.png"),
  co_owner: require("@/assets/badges/room/co_owner.png"),
  trusted_member: require("@/assets/badges/room/trusted_member.png"),
  active_speaker: require("@/assets/badges/room/active_speaker.png"),
  energy_star: require("@/assets/badges/room/energy_star.png"),
  popular: require("@/assets/badges/room/popular.png"),
  loyal_member: require("@/assets/badges/room/loyal_member.png"),
  level_master: require("@/assets/badges/room/level_master.png"),
  chat_master: require("@/assets/badges/room/chat_master.png"),
  room_king: require("@/assets/badges/room/room_king.png"),
  room_queen: require("@/assets/badges/room/room_queen.png"),
  room2: require("@/assets/badges/room/room2.png"),
  room3: require("@/assets/badges/room/room3.png"),
  room4: require("@/assets/badges/room/room4.png"),
  room5: require("@/assets/badges/room/room5.png"),
  rank_pusher: require("@/assets/badges/room/rank_pusher.png"),
  consistent: require("@/assets/badges/room/consistent.png"),
  hot_streak: require("@/assets/badges/room/hot_streak.png"),
  early_bird: require("@/assets/badges/room/early_bird.png"),
  night_owl: require("@/assets/badges/room/night_owl.png"),
  bingo_master: require("@/assets/badges/room/bingo_master.png"),
  event_master: require("@/assets/badges/room/event_master.png"),
  winter_star: require("@/assets/badges/room/winter_star.png"),
  spring_bloom: require("@/assets/badges/room/spring_bloom.png"),
  summer_sun: require("@/assets/badges/room/summer_sun.png"),
  autumn_leaf: require("@/assets/badges/room/autumn_leaf.png"),
  legendary: require("@/assets/badges/room/legendary.png"),
  // 2. parti (rozetv2 sayfası) — henüz hiçbir odaya/kullanıcıya atanmadı,
  // kazanma kuralları belirlenince `room.badges` verisinden kullanılacak.
  first_voice: require("@/assets/badges/room/first_voice.png"),
  room_king_v2: require("@/assets/badges/room/room_king_v2.png"),
  social_butterfly: require("@/assets/badges/room/social_butterfly.png"),
  music_lover: require("@/assets/badges/room/music_lover.png"),
  night_shift: require("@/assets/badges/room/night_shift.png"),
  streak_master: require("@/assets/badges/room/streak_master.png"),
  guardian: require("@/assets/badges/room/guardian.png"),
  chatterbox: require("@/assets/badges/room/chatterbox.png"),
  team_player: require("@/assets/badges/room/team_player.png"),
  vip_member: require("@/assets/badges/room/vip_member.png"),
  gift_giver: require("@/assets/badges/room/gift_giver.png"),
  alpha: require("@/assets/badges/room/alpha.png"),
} as const;

/** Oda rozeti görselleri — rozet koleksiyonu ekranı da bunu kullanır. */
export const ROOM_BADGE_IMG = IMG;

export type RoomBadgeType = keyof typeof IMG | "lv";
export type RoomBadgeItem = { type: RoomBadgeType; n?: number | string };

export function RoomBadge({ type, n, size = 18 }: RoomBadgeItem & { size?: number }) {
  if (type === "lv") {
    return (
      <Gradient
        colors={["#FDE68A", "#F5B100", "#B45309"]}
        deg={180}
        style={{
          minWidth: size,
          height: size,
          paddingHorizontal: 3,
          borderRadius: size * 0.32,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#FFF2C2",
        }}
      >
        <Txt weight="extrabold" size={size * 0.52} color="#5A3206">{n ?? 1}</Txt>
      </Gradient>
    );
  }
  return <Image source={IMG[type]} style={{ width: size, height: size }} contentFit="contain" />;
}

export function RoomBadges({ badges, size = 18 }: { badges: RoomBadgeItem[]; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {badges.slice(0, 3).map((b, i) => (
        <RoomBadge key={b.type + i} type={b.type} n={b.n} size={size} />
      ))}
    </View>
  );
}
