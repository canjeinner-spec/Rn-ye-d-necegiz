import { useId } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

export type BadgeType =
  | "developer"
  | "super_admin"
  | "vip"
  | "level"
  | "streamer"
  | "member";

type BadgeProps = { type: BadgeType; size?: number; lvl?: number | string };

const GLOW: Record<BadgeType, string> = {
  developer: "#7C3AED",
  super_admin: "#EF4444",
  vip: "#F59E0B",
  level: "#06B6D4",
  streamer: "#10B981",
  member: "#8B5CF6",
};

export function Badge({ type, size = 26, lvl }: BadgeProps) {
  const s = size;
  const t = GLOW[type] ? type : "member";
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gid = `bdg_${t}_${uid}`;

  return (
    <View
      style={{
        shadowColor: GLOW[t],
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: s * 0.14,
        elevation: 4,
      }}
    >
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        {t === "developer" && (
          <G>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#C4B5FD" />
                <Stop offset="1" stopColor="#7C3AED" />
              </LinearGradient>
            </Defs>
            <Path
              d={`M${s * 0.5},${s * 0.12} L${s * 0.84},${s * 0.31} L${s * 0.84},${s * 0.69} L${s * 0.5},${s * 0.88} L${s * 0.16},${s * 0.69} L${s * 0.16},${s * 0.31} Z`}
              fill={`url(#${gid})`}
              stroke="#E2D9FF"
              strokeWidth={s * 0.035}
              strokeLinejoin="round"
            />
            <G stroke="#1E0B40" strokeWidth={s * 0.07} strokeLinecap="round" strokeLinejoin="round" fill="none">
              <Polyline points={`${s * 0.42},${s * 0.4} ${s * 0.32},${s * 0.5} ${s * 0.42},${s * 0.6}`} />
              <Polyline points={`${s * 0.58},${s * 0.4} ${s * 0.68},${s * 0.5} ${s * 0.58},${s * 0.6}`} />
            </G>
          </G>
        )}

        {t === "super_admin" && (
          <G>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FCA5A5" />
                <Stop offset="1" stopColor="#B91C1C" />
              </LinearGradient>
            </Defs>
            <Path
              d={`M${s * 0.5},${s * 0.12} L${s * 0.82},${s * 0.26} L${s * 0.82},${s * 0.52} C${s * 0.82},${s * 0.72} ${s * 0.5},${s * 0.9} ${s * 0.5},${s * 0.9} C${s * 0.5},${s * 0.9} ${s * 0.18},${s * 0.72} ${s * 0.18},${s * 0.52} L${s * 0.18},${s * 0.26} Z`}
              fill={`url(#${gid})`}
              stroke="#FFE2E2"
              strokeWidth={s * 0.04}
              strokeLinejoin="round"
            />
            <Polygon
              points={`${s * 0.5},${s * 0.3} ${s * 0.555},${s * 0.45} ${s * 0.7},${s * 0.45} ${s * 0.58},${s * 0.55} ${s * 0.62},${s * 0.7} ${s * 0.5},${s * 0.61} ${s * 0.38},${s * 0.7} ${s * 0.42},${s * 0.55} ${s * 0.3},${s * 0.45} ${s * 0.445},${s * 0.45}`}
              fill="#FFF"
            />
          </G>
        )}

        {t === "vip" && (
          <G>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FEF3C7" />
                <Stop offset="0.5" stopColor="#FBBF24" />
                <Stop offset="1" stopColor="#B45309" />
              </LinearGradient>
            </Defs>
            <Path
              d={`M${s * 0.16},${s * 0.66} L${s * 0.26},${s * 0.3} L${s * 0.5},${s * 0.54} L${s * 0.74},${s * 0.3} L${s * 0.84},${s * 0.66} Z`}
              fill={`url(#${gid})`}
              stroke="#7A5214"
              strokeWidth={s * 0.03}
              strokeLinejoin="round"
            />
            <Rect x={s * 0.16} y={s * 0.68} width={s * 0.68} height={s * 0.1} rx={s * 0.05} fill={`url(#${gid})`} stroke="#7A5214" strokeWidth={s * 0.025} />
            <Circle cx={s * 0.26} cy={s * 0.27} r={s * 0.06} fill="#FEF3C7" />
            <Circle cx={s * 0.5} cy={s * 0.2} r={s * 0.07} fill="#FFF7DC" />
            <Circle cx={s * 0.74} cy={s * 0.27} r={s * 0.06} fill="#FEF3C7" />
          </G>
        )}

        {t === "level" && (
          <G>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#A5F3FC" />
                <Stop offset="1" stopColor="#0891B2" />
              </LinearGradient>
            </Defs>
            <Path
              d={`M${s * 0.58},${s * 0.12} L${s * 0.34},${s * 0.54} L${s * 0.49},${s * 0.54} L${s * 0.42},${s * 0.88} L${s * 0.68},${s * 0.46} L${s * 0.52},${s * 0.46} Z`}
              fill={`url(#${gid})`}
              stroke="#ECFEFF"
              strokeWidth={s * 0.035}
              strokeLinejoin="round"
            />
            {lvl != null && (
              <G>
                <Circle cx={s * 0.76} cy={s * 0.76} r={s * 0.2} fill="#0E7490" stroke="#A5F3FC" strokeWidth={s * 0.03} />
                <SvgText x={s * 0.76} y={s * 0.835} fontSize={s * 0.26} fontWeight="900" fill="#ECFEFF" textAnchor="middle">
                  {String(lvl)}
                </SvgText>
              </G>
            )}
          </G>
        )}

        {t === "streamer" && (
          <G>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#6EE7B7" />
                <Stop offset="1" stopColor="#059669" />
              </LinearGradient>
            </Defs>
            <Rect x={s * 0.38} y={s * 0.16} width={s * 0.24} height={s * 0.36} rx={s * 0.12} fill={`url(#${gid})`} stroke="#D1FAE5" strokeWidth={s * 0.03} />
            <Path d={`M${s * 0.28},${s * 0.42} A${s * 0.22},${s * 0.22} 0 0 0 ${s * 0.72},${s * 0.42}`} stroke={`url(#${gid})`} strokeWidth={s * 0.08} strokeLinecap="round" fill="none" />
            <Line x1={s * 0.5} y1={s * 0.64} x2={s * 0.5} y2={s * 0.82} stroke={`url(#${gid})`} strokeWidth={s * 0.08} strokeLinecap="round" />
            <Line x1={s * 0.34} y1={s * 0.82} x2={s * 0.66} y2={s * 0.82} stroke={`url(#${gid})`} strokeWidth={s * 0.08} strokeLinecap="round" />
          </G>
        )}

        {t === "member" && (
          <G>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#DDD6FE" />
                <Stop offset="1" stopColor="#7C3AED" />
              </LinearGradient>
            </Defs>
            <Path
              d={`M${s * 0.5},${s * 0.14} L${s * 0.63},${s * 0.4} L${s * 0.9},${s * 0.44} L${s * 0.7},${s * 0.62} L${s * 0.75},${s * 0.88} L${s * 0.5},${s * 0.74} L${s * 0.25},${s * 0.88} L${s * 0.3},${s * 0.62} L${s * 0.1},${s * 0.44} L${s * 0.37},${s * 0.4} Z`}
              fill={`url(#${gid})`}
              stroke="#F5F3FF"
              strokeWidth={s * 0.03}
              strokeLinejoin="round"
            />
          </G>
        )}
      </Svg>
    </View>
  );
}
