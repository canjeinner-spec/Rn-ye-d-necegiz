import { useId } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { Gradient } from "@/theme/Gradient";

export type SceneKind = "official" | "club" | "lounge" | "night" | "fire";

type Pos = { left?: DimensionValue; top?: DimensionValue; right?: DimensionValue; bottom?: DimensionValue };
type BlobDef = Pos & { w: number; h: number; color: string; opacity: number };
type DotDef = { x: DimensionValue; y: DimensionValue; s: number; color: string; opacity?: number };

const BASE: Record<SceneKind, { colors: [string, string, string]; deg: number }> = {
  official: { colors: ["#3A2A0A", "#2A1B40", "#0E0A18"], deg: 150 },
  club: { colors: ["#231140", "#160B2A", "#0B0614"], deg: 150 },
  lounge: { colors: ["#33180A", "#1E0F07", "#0E0704"], deg: 150 },
  night: { colors: ["#101A3C", "#0B0F26", "#070814"], deg: 160 },
  fire: { colors: ["#2E0E12", "#1A080A", "#0D0506"], deg: 150 },
};

const BLOBS: Record<SceneKind, BlobDef[]> = {
  official: [
    { left: -20, top: -40, w: 160, h: 160, color: "#D97706", opacity: 0.5 },
    { right: -25, top: -10, w: 140, h: 140, color: "#7C3AED", opacity: 0.42 },
    { left: "40%", bottom: -50, w: 150, h: 120, color: "#F59E0B", opacity: 0.3 },
  ],
  club: [
    { left: -30, top: -40, w: 160, h: 160, color: "#7C3AED", opacity: 0.5 },
    { right: -20, top: 10, w: 130, h: 130, color: "#DB2777", opacity: 0.4 },
  ],
  lounge: [
    { left: -20, top: -50, w: 150, h: 150, color: "#B45309", opacity: 0.45 },
    { right: -30, bottom: -40, w: 150, h: 150, color: "#7C2D12", opacity: 0.5 },
  ],
  night: [{ left: -30, bottom: -50, w: 170, h: 170, color: "#1D4ED8", opacity: 0.35 }],
  fire: [
    { left: 20, bottom: -60, w: 170, h: 150, color: "#DC2626", opacity: 0.5 },
    { left: 60, bottom: -40, w: 110, h: 100, color: "#F59E0B", opacity: 0.45 },
  ],
};

const DOTS: Record<SceneKind, DotDef[]> = {
  official: [
    { x: "64%", y: "20%", s: 4, color: "#FDE68A" },
    { x: "78%", y: "44%", s: 3, color: "#FCD34D" },
    { x: "36%", y: "16%", s: 3, color: "#fff", opacity: 0.55 },
    { x: "86%", y: "28%", s: 4, color: "#E9D5FF" },
    { x: "50%", y: "34%", s: 2.5, color: "#fff", opacity: 0.45 },
    { x: "24%", y: "40%", s: 2.5, color: "#FDBA74", opacity: 0.6 },
  ],
  club: [
    { x: "62%", y: "22%", s: 5, color: "#E9D5FF" },
    { x: "74%", y: "48%", s: 3, color: "#F0ABFC" },
    { x: "38%", y: "16%", s: 3, color: "#fff", opacity: 0.5 },
    { x: "85%", y: "26%", s: 4, color: "#C4B5FD" },
    { x: "50%", y: "38%", s: 2.5, color: "#fff", opacity: 0.4 },
  ],
  lounge: [
    { x: "70%", y: "20%", s: 4, color: "#FCD34D" },
    { x: "82%", y: "40%", s: 3, color: "#FDBA74" },
    { x: "55%", y: "30%", s: 2.5, color: "#fff", opacity: 0.35 },
  ],
  night: [
    { x: "20%", y: "20%", s: 2.5, color: "#fff", opacity: 0.8 },
    { x: "34%", y: "12%", s: 2, color: "#fff", opacity: 0.6 },
    { x: "55%", y: "24%", s: 2, color: "#fff", opacity: 0.5 },
    { x: "12%", y: "42%", s: 2, color: "#fff", opacity: 0.4 },
  ],
  fire: [
    { x: "30%", y: "44%", s: 3, color: "#FCA5A5" },
    { x: "42%", y: "30%", s: 2.5, color: "#FCD34D" },
    { x: "24%", y: "26%", s: 2, color: "#FDBA74", opacity: 0.6 },
  ],
};

function Blob({ w, h, color, opacity, left, top, right, bottom }: BlobDef) {
  const id = "blob_" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View style={{ position: "absolute", left, top, right, bottom, width: w, height: h }}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function Dot({ x, y, s, color, opacity = 0.7 }: DotDef) {
  return (
    <View style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: s / 2, backgroundColor: color, opacity }} />
  );
}

export function Scene({ kind }: { kind: SceneKind }) {
  const base = BASE[kind];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Gradient colors={base.colors} deg={base.deg} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
        {BLOBS[kind].map((b, i) => (
          <Blob key={i} {...b} />
        ))}
        {kind === "night" && (
          <View
            style={{
              position: "absolute",
              right: 26,
              top: 14,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: "#E7ECFF",
              shadowColor: "rgba(190,200,255,.6)",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 13,
              elevation: 6,
            }}
          />
        )}
        {DOTS[kind].map((d, i) => (
          <Dot key={i} {...d} />
        ))}
      </View>
      <Gradient
        colors={["rgba(5,5,10,.25)", "rgba(5,5,10,.1)", "rgba(5,5,10,.78)"]}
        deg={180}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}
