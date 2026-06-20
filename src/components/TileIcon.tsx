import { useId } from "react";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

export type TileType = "tasks" | "store" | "items" | "level";

const G_COLORS: Record<TileType, [string, string]> = {
  tasks: ["#F59E0B", "#D97706"],
  store: ["#EC4899", "#BE185D"],
  items: ["#3B82F6", "#1D4ED8"],
  level: ["#10B981", "#059669"],
};

export function TileIcon({ type, size = 50 }: { type: TileType; size?: number }) {
  const s = size;
  const t = G_COLORS[type] ? type : "tasks";
  const gid = "tile_" + t + useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={G_COLORS[t][0]} />
          <Stop offset="1" stopColor={G_COLORS[t][1]} />
        </LinearGradient>
      </Defs>
      <Rect x={s * 0.08} y={s * 0.08} width={s * 0.84} height={s * 0.84} rx={s * 0.28} fill={`url(#${gid})`} />
      <Rect x={s * 0.08} y={s * 0.08} width={s * 0.84} height={s * 0.42} rx={s * 0.28} fill="rgba(255,255,255,.18)" />

      {t === "tasks" && (
        <G>
          <Rect x={s * 0.28} y={s * 0.26} width={s * 0.44} height={s * 0.5} rx={s * 0.06} fill="#FEF3C7" />
          <Rect x={s * 0.28} y={s * 0.26} width={s * 0.44} height={s * 0.12} rx={s * 0.06} fill="#FCD34D" />
          <Line x1={s * 0.36} y1={s * 0.5} x2={s * 0.64} y2={s * 0.5} stroke="#D97706" strokeWidth={s * 0.04} strokeLinecap="round" />
          <Line x1={s * 0.36} y1={s * 0.6} x2={s * 0.56} y2={s * 0.6} stroke="#D97706" strokeWidth={s * 0.04} strokeLinecap="round" />
        </G>
      )}
      {t === "store" && (
        <G>
          <Path d={`M${s * 0.28} ${s * 0.42} L${s * 0.3} ${s * 0.3} h${s * 0.4} l${s * 0.02} ${s * 0.12} v${s * 0.28} a${s * 0.04} ${s * 0.04} 0 01-${s * 0.04} ${s * 0.04} h-${s * 0.36} a${s * 0.04} ${s * 0.04} 0 01-${s * 0.04}-${s * 0.04} z`} fill="#FBCFE8" />
          <Path d={`M${s * 0.4} ${s * 0.4} a${s * 0.1} ${s * 0.1} 0 00${s * 0.2} 0`} stroke="#BE185D" strokeWidth={s * 0.05} fill="none" strokeLinecap="round" />
        </G>
      )}
      {t === "items" && (
        <G>
          <Path d={`M${s * 0.5} ${s * 0.28} l${s * 0.16} ${s * 0.09} v${s * 0.18} l-${s * 0.16} ${s * 0.1} l-${s * 0.16}-${s * 0.1} v-${s * 0.18} z`} fill="#DBEAFE" stroke="#1D4ED8" strokeWidth={s * 0.02} />
          <Circle cx={s * 0.5} cy={s * 0.47} r={s * 0.05} fill="#3B82F6" />
        </G>
      )}
      {t === "level" && (
        <G>
          <Path d={`M${s * 0.5} ${s * 0.26} l${s * 0.18} ${s * 0.1} v${s * 0.2} l-${s * 0.18} ${s * 0.12} l-${s * 0.18}-${s * 0.12} v-${s * 0.2} z`} fill="#D1FAE5" stroke="#059669" strokeWidth={s * 0.025} />
          <SvgText x={s * 0.5} y={s * 0.55} fontSize={s * 0.18} fontWeight="900" fill="#059669" textAnchor="middle">LV</SvgText>
        </G>
      )}
    </Svg>
  );
}
