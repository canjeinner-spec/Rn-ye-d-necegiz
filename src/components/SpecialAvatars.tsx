import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Icon } from "@/icons/Icon";
import { Gradient } from "@/theme/Gradient";

export function OfficialAvatar({ size = 48 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Gradient colors={["#7C3AED", "#D97706"]} deg={140} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
          <Path d="M12 3l7 16h-3l-1.3-3H9.3L8 19H5z" fill="#fff" />
          <Path d="M10.1 13h3.8L12 8z" fill="#7C3AED" />
        </Svg>
      </Gradient>
      <View style={{ position: "absolute", right: -1, bottom: -1, width: size * 0.34, height: size * 0.34, borderRadius: (size * 0.34) / 2, backgroundColor: "#3B82F6", borderWidth: 2, borderColor: "#08080C", alignItems: "center", justifyContent: "center" }}>
        <Svg width={size * 0.18} height={size * 0.18} viewBox="0 0 24 24">
          <Path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </View>
  );
}

export function SystemAvatar({ size = 48 }: { size?: number }) {
  return (
    <Gradient colors={["#2DD4BF", "#0E7490"]} deg={140} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
      <Icon name="bell" size={size * 0.46} sw={2} color="#fff" />
    </Gradient>
  );
}
