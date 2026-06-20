import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { type VipTierKey } from "@/data/vip";

const ACircle = Animated.createAnimatedComponent(Circle);

function PulseRing() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, []);
  const props = useAnimatedProps(() => ({ r: 9 + t.value * 4, strokeOpacity: 0.5 * (1 - t.value) }));
  return <ACircle cx={60} cy={33} r={9} fill="none" stroke="#fff" strokeWidth={1} animatedProps={props} />;
}

export function VipEmblem({ tier = "asil", s = 120 }: { tier?: VipTierKey; s?: number }) {
  const royal = tier === "hukumdar";
  const gid = royal ? "vipH" : "vipA";
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 120 120">
        <Defs>
          <LinearGradient id={`${gid}_band`} x1="0" y1="0" x2="0" y2="1">
            {(royal
              ? [["0", "#FFF1B8"], ["0.5", "#F0C457"], ["1", "#9A6B1C"]]
              : [["0", "#FDE7C4"], ["0.5", "#D9A05B"], ["1", "#8A5A2B"]]
            ).map(([o, c]) => <Stop key={o} offset={o} stopColor={c} />)}
          </LinearGradient>
          <LinearGradient id={`${gid}_jewel`} x1="0" y1="0" x2="1" y2="1">
            {(royal
              ? [["0", "#D8B4FE"], ["1", "#7C3AED"]]
              : [["0", "#FCA5A5"], ["1", "#B45309"]]
            ).map(([o, c]) => <Stop key={o} offset={o} stopColor={c} />)}
          </LinearGradient>
          <RadialGradient id={`${gid}_halo`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={royal ? "rgba(168,85,247,.5)" : "rgba(245,206,110,.4)"} />
            <Stop offset="1" stopColor="rgba(0,0,0,0)" />
          </RadialGradient>
        </Defs>
        <Circle cx={60} cy={58} r={52} fill={`url(#${gid}_halo)`} />
        <Rect x={30} y={78} width={60} height={13} rx={4} fill={`url(#${gid}_band)`} stroke="#7A5214" strokeWidth={1} />
        <Path d="M28 78 L34 44 L46 62 L60 36 L74 62 L86 44 L92 78 Z" fill={`url(#${gid}_band)`} stroke="#7A5214" strokeWidth={1.4} strokeLinejoin="round" />
        <Circle cx={34} cy={42} r={5} fill={`url(#${gid}_jewel)`} stroke="#fff" strokeWidth={0.8} />
        <Circle cx={60} cy={33} r={6.5} fill={`url(#${gid}_jewel)`} stroke="#fff" strokeWidth={1} />
        <Circle cx={86} cy={42} r={5} fill={`url(#${gid}_jewel)`} stroke="#fff" strokeWidth={0.8} />
        <Circle cx={60} cy={84} r={5.5} fill={`url(#${gid}_jewel)`} stroke="#fff" strokeWidth={0.8} />
        <Path d="M30 80 Q60 74 90 80" stroke="rgba(255,255,255,.5)" strokeWidth={1.5} fill="none" />
        {royal && <PulseRing />}
      </Svg>
    </View>
  );
}
