import { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

export function AgencyEmblem({ s = 26 }: { s?: number }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gold = `agGold_${u}`;
  const edge = `agGoldEdge_${u}`;
  const purp = `agPurp_${u}`;
  const gem = `agGem_${u}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF1B8" />
          <Stop offset="0.45" stopColor="#F0C457" />
          <Stop offset="0.7" stopColor="#D69A2E" />
          <Stop offset="1" stopColor="#8A5C16" />
        </LinearGradient>
        <LinearGradient id={edge} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF7DC" />
          <Stop offset="0.5" stopColor="#E8B84B" />
          <Stop offset="1" stopColor="#9A6B1C" />
        </LinearGradient>
        <LinearGradient id={purp} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B36BF5" />
          <Stop offset="0.5" stopColor="#7C3AED" />
          <Stop offset="1" stopColor="#4C1D95" />
        </LinearGradient>
        <RadialGradient id={gem} cx="0.42" cy="0.35" r="0.7">
          <Stop offset="0" stopColor="#EAFBF1" />
          <Stop offset="0.4" stopColor="#34D399" />
          <Stop offset="1" stopColor="#065F46" />
        </RadialGradient>
      </Defs>
      <G fill={`url(#${gold})`} stroke="#7A5214" strokeWidth="0.4" strokeLinejoin="round">
        <Path d="M23 17 C16 15 9.5 16 4 20 C11 19.2 15.5 20.2 21 22.5 Z" />
        <Path d="M23 22 C15.5 21 9 23 3.4 27 C11 25.2 16 26 21.5 27.6 Z" />
        <Path d="M24 27 C16.5 27 11 30 6.5 34 C13 31 18 31 22.5 32.4 Z" />
      </G>
      <G fill={`url(#${gold})`} stroke="#7A5214" strokeWidth="0.4" strokeLinejoin="round" transform="translate(48,0) scale(-1,1)">
        <Path d="M23 17 C16 15 9.5 16 4 20 C11 19.2 15.5 20.2 21 22.5 Z" />
        <Path d="M23 22 C15.5 21 9 23 3.4 27 C11 25.2 16 26 21.5 27.6 Z" />
        <Path d="M24 27 C16.5 27 11 30 6.5 34 C13 31 18 31 22.5 32.4 Z" />
      </G>
      <Path d="M18.5 12 L24 6 L29.5 12 L26 11 L24 13 L22 11 Z" fill={`url(#${edge})`} stroke="#7A5214" strokeWidth="0.4" strokeLinejoin="round" />
      <Path
        d="M24 10.5 L34.5 14.5 V24.5 C34.5 30.5 29.5 35 24 37.5 C18.5 35 13.5 30.5 13.5 24.5 V14.5 Z"
        fill={`url(#${purp})`}
        stroke={`url(#${edge})`}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path d="M24 12 L32.5 15.4 V18 C28 16.5 20 16.5 15.5 18 V15.4 Z" fill="rgba(255,255,255,.22)" />
      <Circle cx="24" cy="22.5" r="5.2" fill={`url(#${gem})`} stroke="#053D2C" strokeWidth="0.5" />
      <Ellipse cx="22.3" cy="20.4" rx="1.9" ry="1.25" fill="#fff" opacity="0.75" />
    </Svg>
  );
}

export function AgencyBadge({ size = 26 }: { name?: string; size?: number }) {
  return (
    <View
      style={{
        shadowColor: "rgba(245,206,110,.45)",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 5,
        elevation: 3,
      }}
    >
      <AgencyEmblem s={size} />
    </View>
  );
}
