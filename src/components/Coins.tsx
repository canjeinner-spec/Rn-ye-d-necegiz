import { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

export function CoinBadge({ size = 18 }: { size?: number }) {
  const g = "coin_" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View
      style={{
        shadowColor: "rgba(217,119,6,.4)",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <RadialGradient id={g} cx="38%" cy="32%" r="75%">
            <Stop offset="0%" stopColor="#FDE68A" />
            <Stop offset="55%" stopColor="#F5CE6E" />
            <Stop offset="100%" stopColor="#B45309" />
          </RadialGradient>
        </Defs>
        <Circle cx="12" cy="12" r="10" fill={`url(#${g})`} stroke="#92400E" strokeWidth="1" />
        <Circle cx="12" cy="12" r="7" fill="none" stroke="#92400E" strokeWidth="1" opacity="0.4" />
        <Path d="M9.5 8.5h4.2c1.3 0 2.3 1 2.3 2.3s-1 2.3-2.3 2.3H11v2.4M9.5 11h5" stroke="#92400E" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.75" />
        <Ellipse cx="9" cy="8.5" rx="2.5" ry="1.5" fill="#FEF3C7" opacity="0.5" />
      </Svg>
    </View>
  );
}

export function DiamondBadge({ size = 18 }: { size?: number }) {
  const g = "dia_" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View
      style={{
        shadowColor: "rgba(14,165,233,.5)",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id={g} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#A5F3FC" />
            <Stop offset="50%" stopColor="#22D3EE" />
            <Stop offset="100%" stopColor="#0891B2" />
          </LinearGradient>
        </Defs>
        <Path d="M5 9l3-4h8l3 4-7 10z" fill={`url(#${g})`} stroke="#0E7490" strokeWidth="0.8" strokeLinejoin="round" />
        <Path d="M5 9h14M9 5l-1 4 4 10M15 5l1 4-4 10" stroke="#0E7490" strokeWidth="0.7" fill="none" opacity="0.55" />
        <Path d="M8 5l1 4M16 5l-1 4" stroke="#CFFAFE" strokeWidth="0.6" opacity="0.7" />
      </Svg>
    </View>
  );
}
