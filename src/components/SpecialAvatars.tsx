import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Icon } from "@/icons/Icon";
import { Gradient } from "@/theme/Gradient";

/**
 * Resmî (Aron) ve Sistem kanallarının avatarları.
 *
 * DM listesinde bunlar `Portrait` ile yan yana duruyor ama Portrait'in 2px
 * halkası varken bunların yoktu; aynı `size` verilmesine rağmen daire
 * çapları ve hizaları farklı görünüyordu. İkisi de artık aynı halka
 * kalıbını kullanıyor: dışta halka, içte kırpma.
 */
function Halka({ size, renk, children }: { size: number; renk: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: renk,
      }}
    >
      <View style={{ flex: 1, borderRadius: (size - 4) / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}

export function OfficialAvatar({ size = 48 }: { size?: number }) {
  const ic = size * 0.5;
  return (
    <View style={{ width: size, height: size }}>
      <Halka size={size} renk="rgba(217,119,6,.55)">
        <Gradient colors={["#7C3AED", "#D97706"]} deg={140} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <Svg width={ic} height={ic} viewBox="0 0 24 24">
          <Path d="M12 3l7 16h-3l-1.3-3H9.3L8 19H5z" fill="#fff" />
          <Path d="M10.1 13h3.8L12 8z" fill="#7C3AED" />
        </Svg>
      </Halka>
      {/* Onay tiki — halkanın dışına taşar, o yüzden Halka'nın kardeşi */}
      <View
        style={{
          position: "absolute",
          right: -1,
          bottom: -1,
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: (size * 0.34) / 2,
          backgroundColor: "#3B82F6",
          borderWidth: 2,
          borderColor: "#08080C",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size * 0.18} height={size * 0.18} viewBox="0 0 24 24">
          <Path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </View>
  );
}

export function SystemAvatar({ size = 48 }: { size?: number }) {
  return (
    <Halka size={size} renk="rgba(45,212,191,.5)">
      <Gradient colors={["#2DD4BF", "#0E7490"]} deg={140} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <Icon name="bell" size={size * 0.44} sw={2} color="#fff" />
    </Halka>
  );
}
