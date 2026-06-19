import { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

export type RoomBadgeType = "lv" | "hot" | "gem" | "crown" | "cp" | "star" | "mic" | "medal" | "noble";
export type RoomBadgeItem = { type: RoomBadgeType; n?: number | string };

function Glow({ color, children, size }: { color: string; children: React.ReactNode; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: size * 0.16,
        elevation: 3,
      }}
    >
      {children}
    </View>
  );
}

export function RoomBadge({ type, n, size = 18 }: RoomBadgeItem & { size?: number }) {
  const s = size;
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");

  const body = (() => {
    switch (type) {
      case "lv":
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`lv${u}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FDE68A" />
                <Stop offset="0.5" stopColor="#F5B100" />
                <Stop offset="1" stopColor="#B45309" />
              </LinearGradient>
            </Defs>
            <Polygon points="12,1.5 21,6.5 21,17.5 12,22.5 3,17.5 3,6.5" fill={`url(#lv${u})`} stroke="#FFF2C2" strokeWidth="1" strokeLinejoin="round" />
            <SvgText x="12" y="16" fontSize="10" fontWeight="900" fill="#5A3206" textAnchor="middle">{n ?? 1}</SvgText>
          </Svg>
        );
      case "hot":
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`ht${u}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FDE047" />
                <Stop offset="0.45" stopColor="#F97316" />
                <Stop offset="1" stopColor="#DC2626" />
              </LinearGradient>
            </Defs>
            <Path d="M13 2c1 4-4 5-3.5 9.5C8 10 7 8.5 7.2 6.5 4.5 9 3 12 3 15a9 9 0 0 0 18 0c0-4-2.5-7.5-5.5-10.5C16 6.5 15 4 13 2z" fill={`url(#ht${u})`} stroke="#FFE9B0" strokeWidth="0.6" />
            <Path d="M12 14c.5 2-1.6 2.4-1 4.2.8-.5 1-1.2 1-2 .8.8 1.4 1.7 1.4 2.6a2.4 2.4 0 1 1-4.8 0c0-1.8 1.8-2.4 1.4-4.8.8.3 1.6 0 1-.0z" fill="#FFF4D6" opacity="0.85" />
          </Svg>
        );
      case "gem":
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`gm${u}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#A5F3FC" />
                <Stop offset="0.5" stopColor="#22D3EE" />
                <Stop offset="1" stopColor="#0891B2" />
              </LinearGradient>
            </Defs>
            <Path d="M5 9l3-4.5h8L19 9l-7 11z" fill={`url(#gm${u})`} stroke="#CFFAFE" strokeWidth="0.8" strokeLinejoin="round" />
            <Path d="M5 9h14M9 4.5 8 9l4 11M15 4.5 16 9l-4 11" stroke="#0E7490" strokeWidth="0.6" fill="none" opacity="0.5" />
          </Svg>
        );
      case "crown":
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`cr${u}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FDE68A" />
                <Stop offset="1" stopColor="#D97706" />
              </LinearGradient>
            </Defs>
            <Path d="M3 8l4.5 3L12 5l4.5 6L21 8l-1.4 10H4.4z" fill={`url(#cr${u})`} stroke="#FFF2C2" strokeWidth="0.8" strokeLinejoin="round" />
            <Circle cx="12" cy="5" r="1.6" fill="#FF5D8F" />
            <Circle cx="3" cy="8" r="1.4" fill="#7FB4FF" />
            <Circle cx="21" cy="8" r="1.4" fill="#7FB4FF" />
            <Rect x="4.4" y="16" width="15.2" height="2.4" rx="1" fill="#B45309" />
          </Svg>
        );
      case "cp":
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`cp${u}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FBCFE8" />
                <Stop offset="1" stopColor="#BE185D" />
              </LinearGradient>
            </Defs>
            <Path d="M9 21S2 16.5 2 10.5A4 4 0 0 1 9 8a4 4 0 0 1 7 2.5C16 16.5 9 21 9 21z" fill={`url(#cp${u})`} stroke="#FFE4F1" strokeWidth="0.6" />
            <Path d="M16 18c3-2.4 6-5.6 6-9A3.4 3.4 0 0 0 15.6 7" fill="none" stroke="#F9A8D4" strokeWidth="1.4" strokeLinecap="round" />
          </Svg>
        );
      case "star":
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`st${u}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#DDD6FE" />
                <Stop offset="1" stopColor="#7C3AED" />
              </LinearGradient>
            </Defs>
            <Polygon points="12,2 14.7,8.6 21.8,9.2 16.4,13.9 18.1,20.8 12,17 5.9,20.8 7.6,13.9 2.2,9.2 9.3,8.6" fill={`url(#st${u})`} stroke="#F5F3FF" strokeWidth="0.7" strokeLinejoin="round" />
          </Svg>
        );
      case "mic":
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`mc${u}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#6EE7B7" />
                <Stop offset="1" stopColor="#059669" />
              </LinearGradient>
            </Defs>
            <Circle cx="12" cy="12" r="11" fill={`url(#mc${u})`} stroke="#D1FAE5" strokeWidth="0.8" />
            <Rect x="9.5" y="4.5" width="5" height="8.5" rx="2.5" fill="#04231A" />
            <Path d="M7 11a5 5 0 0 0 10 0M12 16v3M9.5 19h5" stroke="#04231A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </Svg>
        );
      case "noble":
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`nb${u}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#C4B5FD" />
                <Stop offset="1" stopColor="#5B21B6" />
              </LinearGradient>
            </Defs>
            <Path d="M12 1.5l9 4.2v6.3C21 18 16.8 21.4 12 23 7.2 21.4 3 18 3 12V5.7z" fill={`url(#nb${u})`} stroke="#EDE9FE" strokeWidth="0.9" strokeLinejoin="round" />
            <Path d="M8 12l4-5 4 5-4 5z" fill="#FDE68A" />
          </Svg>
        );
      case "medal":
      default:
        return (
          <Svg width={s} height={s} viewBox="0 0 24 24">
            <Defs>
              <RadialGradient id={`md${u}`} cx="40%" cy="32%" r="75%">
                <Stop offset="0" stopColor="#FDE68A" />
                <Stop offset="0.6" stopColor="#F5B100" />
                <Stop offset="1" stopColor="#B45309" />
              </RadialGradient>
            </Defs>
            <Path d="M8 2h8l-2.5 6h-3z" fill="#DC2626" />
            <Circle cx="12" cy="15" r="7.5" fill={`url(#md${u})`} stroke="#FFF2C2" strokeWidth="1" />
            <Polygon points="12,10.5 13.4,13.6 16.8,13.9 14.2,16.2 15,19.6 12,17.8 9,19.6 9.8,16.2 7.2,13.9 10.6,13.6" fill="#fff" opacity="0.95" />
          </Svg>
        );
    }
  })();

  const COLOR: Record<RoomBadgeType, string> = {
    lv: "#F5B100", hot: "#F97316", gem: "#22D3EE", crown: "#FDE68A", cp: "#EC4899", star: "#8B5CF6", mic: "#34D399", noble: "#7C3AED", medal: "#F5B100",
  };

  return <Glow color={COLOR[type]} size={s}>{body}</Glow>;
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
