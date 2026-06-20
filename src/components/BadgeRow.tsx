import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { BADGE_INFO, type BadgeItem } from "@/data/badges";
import { C } from "@/theme/colors";
import { GlassPanel } from "@/theme/GlassPanel";
import { AgencyEmblem, AgencyBadge } from "./AgencyEmblem";
import { Badge, type BadgeType } from "./Badge";
import { Txt } from "./Txt";

function InfoRow({ label, value, color = "#fff" }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
      <Txt weight="semibold" size={10} color={C.dim}>
        {label}
      </Txt>
      <Txt weight="extrabold" size={11.5} color={color} style={{ letterSpacing: 0.5 }}>
        {value}
      </Txt>
    </View>
  );
}

/** Rozet açıklama kartı — tek başına overlay (Modal içinde de çalışır). */
export function BadgeInfoCard({ info, onClose }: { info: BadgeItem | null; onClose: () => void }) {
  const cur = info && BADGE_INFO[info.type];
  if (!info || !cur) return null;
  const meta = info.meta;
  return (
    <Pressable onPress={onClose} style={styles.overlay}>
      <GlassPanel style={{ width: "100%", maxWidth: 244, padding: 18, paddingTop: 20, alignItems: "center" }} radius={22}>
        <View style={{ marginBottom: 11 }}>
          {info.type === "agency" ? (
            <AgencyEmblem s={58} />
          ) : (
            <Badge type={cur.icon as BadgeType} size={50} lvl={info.type === "level" ? (info.lvl ?? 12) : undefined} />
          )}
        </View>
        <Txt weight="extrabold" size={15.5} color="#fff">
          {cur.label}
        </Txt>
        <View style={{ width: 34, height: 2.5, borderRadius: 3, backgroundColor: C.gold2, marginTop: 8, marginBottom: 10, opacity: 0.9 }} />

        {info.type === "agency" && meta ? (
          <>
            <Txt size={11} color="rgba(255,255,255,.62)" lh={1.5} align="center" style={{ marginBottom: 11 }}>
              {cur.desc}
            </Txt>
            <View style={{ alignSelf: "stretch", backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", borderRadius: 12, paddingHorizontal: 12 }}>
              <InfoRow label="Ajans ID" value={meta.id || "—"} />
              <View style={{ height: 1, backgroundColor: "rgba(255,255,255,.07)" }} />
              <InfoRow label="Ajans Adı" value={meta.name || "—"} color={C.gold2} />
              <View style={{ height: 1, backgroundColor: "rgba(255,255,255,.07)" }} />
              <InfoRow label="Sahibi" value={meta.owner || "—"} />
            </View>
          </>
        ) : (
          <Txt size={11.5} color="rgba(255,255,255,.68)" lh={1.55} align="center">
            {cur.desc}
          </Txt>
        )}
      </GlassPanel>
    </Pressable>
  );
}

export function BadgeRow({ badges, size = 26, onBadgePress }: { badges: BadgeItem[]; size?: number; onBadgePress?: (b: BadgeItem) => void }) {
  const [info, setInfo] = useState<BadgeItem | null>(null);

  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {badges.map((b) => (
        <Pressable key={b.type + (b.lvl ?? "")} onPress={() => (onBadgePress ? onBadgePress(b) : setInfo(b))}>
          {b.type === "agency" ? (
            <AgencyBadge name={b.meta?.name || "AJANS"} size={size} />
          ) : (
            <Badge type={b.type as BadgeType} size={size} lvl={b.lvl} />
          )}
        </Pressable>
      ))}

      {!onBadgePress && (
        <Modal visible={!!info} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
          <BadgeInfoCard info={info} onClose={() => setInfo(null)} />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 30, backgroundColor: "rgba(3,3,8,.5)", zIndex: 50 },
});
