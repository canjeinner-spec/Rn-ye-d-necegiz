import { Image } from "expo-image";
import { View } from "react-native";

import { Gradient } from "@/theme/Gradient";
import { Txt } from "./Txt";

const IMG = {
  crown: require("@/assets/badges/crown.png"),
  gem: require("@/assets/badges/gem.png"),
  fire: require("@/assets/badges/fire.png"),
  medal: require("@/assets/badges/medal.png"),
  military: require("@/assets/badges/military.png"),
  trophy: require("@/assets/badges/trophy.png"),
  gstar: require("@/assets/badges/gstar.png"),
  star: require("@/assets/badges/star.png"),
  ring: require("@/assets/badges/ring.png"),
  heart: require("@/assets/badges/heart.png"),
  cp: require("@/assets/badges/cp.png"),
  rocket: require("@/assets/badges/rocket.png"),
  music: require("@/assets/badges/music.png"),
  sparkles: require("@/assets/badges/sparkles.png"),
  hundred: require("@/assets/badges/hundred.png"),
  rosette: require("@/assets/badges/rosette.png"),
  party: require("@/assets/badges/party.png"),
  gift: require("@/assets/badges/gift.png"),
} as const;

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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {badges.map((b, i) => (
        <RoomBadge key={b.type + i} type={b.type} n={b.n} size={size} />
      ))}
    </View>
  );
}
