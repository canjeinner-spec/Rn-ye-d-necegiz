import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

type Ring = {
  rOff: number;
  sw: number;
  g: string[];
  dash?: [number, number];
  dur: number;
  dir?: 1 | -1;
  pulse?: boolean;
  opacity?: number;
  glow?: string;
};

const FRAMES: Record<string, Ring[]> = {
  gumus: [
    { rOff: 0, sw: 3, g: ["#94A3B8", "#E2E8F0", "#64748B"], dash: [0.12, 0.05], dur: 5000, dir: 1, glow: "#CBD5E1" },
    { rOff: -4, sw: 1.5, g: ["#CBD5E1"], dash: [0.06, 0.09], dur: 8000, dir: -1, opacity: 0.55 },
  ],
  neon_mavi: [
    { rOff: 0, sw: 2.5, g: ["#3B82F6", "#60A5FA", "#2563EB"], dur: 2000, pulse: true, glow: "#3B82F6" },
    { rOff: 4, sw: 1.2, g: ["#93C5FD"], dash: [0.18, 0.28], dur: 3000, dir: 1, glow: "#60A5FA" },
  ],
  mor_sis: [
    { rOff: 0, sw: 3, g: ["#7C3AED", "#A78BFA"], dash: [0.28, 0.1], dur: 6000, dir: 1, glow: "#7C3AED" },
    { rOff: -4, sw: 2, g: ["#DDD6FE"], dash: [0.14, 0.2], dur: 4000, dir: -1, opacity: 0.55 },
  ],
  altin_tac: [
    { rOff: 0, sw: 3.5, g: ["#B45309", "#F5CE6E", "#B45309"], dur: 8000, dir: 1, glow: "#F59E0B" },
    { rOff: -5, sw: 1.2, g: ["#FDE68A"], dash: [0.08, 0.06], dur: 12000, dir: -1, opacity: 0.45 },
  ],
  kizil: [
    { rOff: 0, sw: 3, g: ["#DC2626", "#F97316", "#DC2626"], dash: [0.22, 0.06], dur: 2500, dir: 1, glow: "#EF4444" },
    { rOff: 4, sw: 1.5, g: ["#FCA5A5"], dash: [0.1, 0.14], dur: 1800, dir: -1, glow: "#EF4444" },
  ],
  obsidyen: [
    { rOff: 2, sw: 6, g: ["#111827", "#1F2937", "#0F172A"], dur: 0 },
    { rOff: 0, sw: 1.2, g: ["#F59E0B"], dash: [0.06, 0.1], dur: 10000, dir: 1, glow: "#F59E0B" },
  ],
  yesil_dalga: [
    { rOff: 0, sw: 2.5, g: ["#059669", "#34D399"], dur: 1800, pulse: true, glow: "#10B981" },
    { rOff: 3, sw: 2, g: ["#34D399"], dash: [0.05, 0.04], dur: 6000, dir: 1, glow: "#10B981" },
  ],
  mor_lazer: [
    { rOff: 0, sw: 2.5, g: ["#7C3AED", "#EC4899"], dur: 4000, dir: 1, glow: "#8B5CF6" },
    { rOff: 4, sw: 1.2, g: ["#F472B6"], dash: [0.12, 0.2], dur: 3000, dir: -1, glow: "#EC4899" },
  ],
  altin_yayin: [
    { rOff: 0, sw: 3.5, g: ["#92400E", "#F5CE6E", "#92400E"], dur: 2500, pulse: true, glow: "#F59E0B" },
    { rOff: 4, sw: 1, g: ["#F59E0B"], dash: [0.15, 0.2], dur: 8000, dir: 1, opacity: 0.35 },
    { rOff: 8, sw: 1, g: ["#F59E0B"], dash: [0.15, 0.2], dur: 10000, dir: -1, opacity: 0.25 },
  ],

  // --- 056 mağaza kataloğuyla gelen çerçeveler -----------------------------
  // Hepsi burada çiziliyor: yeni çerçeve eklemek için asset değil, birkaç
  // satır halka tarifi yetiyor.
  zumrut: [
    { rOff: 0, sw: 3, g: ["#065F46", "#34D399", "#065F46"], dur: 7000, dir: 1, glow: "#10B981" },
    { rOff: -4, sw: 1.4, g: ["#A7F3D0"], dash: [0.1, 0.08], dur: 5000, dir: -1, opacity: 0.6 },
  ],
  kehribar: [
    { rOff: 0, sw: 3, g: ["#B45309", "#FCD34D", "#B45309"], dur: 6000, dir: 1, glow: "#F59E0B" },
    { rOff: 4, sw: 1.2, g: ["#FDE68A"], dash: [0.2, 0.16], dur: 4500, dir: -1, opacity: 0.5 },
  ],
  okyanus: [
    { rOff: 0, sw: 3, g: ["#0E7490", "#22D3EE", "#0E7490"], dur: 5000, dir: 1, glow: "#22D3EE" },
    { rOff: 4, sw: 1.5, g: ["#67E8F9"], dash: [0.24, 0.12], dur: 3500, dir: -1, glow: "#06B6D4" },
  ],
  gul: [
    { rOff: 0, sw: 3, g: ["#BE185D", "#FBCFE8", "#F5CE6E"], dur: 6500, dir: 1, glow: "#F472B6" },
    { rOff: -4, sw: 1.3, g: ["#FDE68A"], dash: [0.08, 0.12], dur: 9000, dir: -1, opacity: 0.55 },
  ],
  buz: [
    { rOff: 0, sw: 2.5, g: ["#7DD3FC", "#E0F2FE", "#38BDF8"], dur: 2200, pulse: true, glow: "#7DD3FC" },
    { rOff: 4, sw: 1.2, g: ["#E0F2FE"], dash: [0.05, 0.07], dur: 12000, dir: 1, opacity: 0.7 },
  ],
  safir: [
    { rOff: 0, sw: 3.2, g: ["#1E3A8A", "#60A5FA", "#1E3A8A"], dur: 8000, dir: 1, glow: "#3B82F6" },
    { rOff: -5, sw: 1.4, g: ["#BFDBFE"], dash: [0.12, 0.1], dur: 6000, dir: -1, opacity: 0.5 },
  ],
  lav: [
    { rOff: 2, sw: 5, g: ["#1C1917", "#292524"], dur: 0 },
    { rOff: 0, sw: 2.2, g: ["#DC2626", "#F97316", "#FCD34D"], dash: [0.3, 0.05], dur: 3000, dir: 1, glow: "#F97316" },
  ],
  gun_batimi: [
    { rOff: 0, sw: 3.4, g: ["#F97316", "#F472B6", "#7C3AED"], dur: 7000, dir: 1, glow: "#FB7185" },
    { rOff: 4, sw: 1.2, g: ["#FDBA74"], dash: [0.18, 0.14], dur: 5000, dir: -1, opacity: 0.55 },
  ],
  galaksi: [
    { rOff: 0, sw: 3, g: ["#312E81", "#8B5CF6", "#EC4899", "#312E81"], dur: 9000, dir: 1, glow: "#8B5CF6" },
    { rOff: 4, sw: 1, g: ["#E9D5FF"], dash: [0.03, 0.05], dur: 4000, dir: -1, glow: "#C084FC" },
    { rOff: -5, sw: 1, g: ["#F0ABFC"], dash: [0.04, 0.09], dur: 6500, dir: 1, opacity: 0.45 },
  ],
  platin: [
    { rOff: 0, sw: 3.2, g: ["#E5E7EB", "#9CA3AF", "#F9FAFB"], dur: 5500, dir: 1, glow: "#E5E7EB" },
    { rOff: -4, sw: 1.2, g: ["#F9FAFB"], dash: [0.16, 0.1], dur: 8000, dir: -1, opacity: 0.6 },
    { rOff: 5, sw: 0.9, g: ["#D1D5DB"], dash: [0.1, 0.2], dur: 11000, dir: 1, opacity: 0.35 },
  ],
  ejder: [
    { rOff: 2, sw: 5.5, g: ["#0C0A09", "#292524", "#0C0A09"], dur: 0 },
    { rOff: 0, sw: 2.4, g: ["#F59E0B", "#DC2626", "#F59E0B"], dash: [0.26, 0.06], dur: 2600, dir: 1, glow: "#F97316" },
    { rOff: 5, sw: 1.1, g: ["#FCD34D"], dash: [0.05, 0.14], dur: 4200, dir: -1, glow: "#F59E0B", opacity: 0.7 },
  ],
};

let UID = 0;

function RingLayer({ sv, baseR, ring }: { sv: number; baseR: number; ring: Ring }) {
  const rot = useSharedValue(0);
  const op = useSharedValue(ring.pulse ? 0.55 : ring.opacity ?? 1);
  const id = `frm${UID++}`;
  const c = sv / 2;
  const r = baseR + ring.rOff;
  const circ = 2 * Math.PI * r;

  useEffect(() => {
    if (ring.pulse) {
      op.value = withRepeat(withTiming(1, { duration: ring.dur / 2, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else if (ring.dur > 0) {
      rot.value = withRepeat(withTiming(360 * (ring.dir ?? 1), { duration: ring.dur, easing: Easing.linear }), -1, false);
    }
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const stops = ring.g.length === 1 ? [ring.g[0], ring.g[0]] : ring.g;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        style,
        ring.glow
          ? { shadowColor: ring.glow, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }
          : null,
      ]}
    >
      <Svg width={sv} height={sv}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {stops.map((s, i) => (
              <Stop key={i} offset={i / (stops.length - 1)} stopColor={s} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={ring.sw}
          strokeLinecap="round"
          strokeDasharray={ring.dash ? [circ * ring.dash[0], circ * ring.dash[1]] : undefined}
        />
      </Svg>
    </Animated.View>
  );
}

export function FramePreview({ id, size = 56 }: { id: string; size?: number }) {
  const pad = 9;
  const sv = size + pad * 2;
  const baseR = size / 2 + 3;
  const rings = FRAMES[id];
  if (!rings) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", top: -pad, left: -pad, width: sv, height: sv }}>
      {rings.map((ring, i) => (
        <RingLayer key={i} sv={sv} baseR={baseR} ring={ring} />
      ))}
    </Animated.View>
  );
}
