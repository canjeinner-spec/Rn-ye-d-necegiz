import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { type SceneKind } from "@/components/Scene";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type RoomType = { ic: IconName; t: string; s: string; g1: string; g2: string; scene: SceneKind };
const TYPES: RoomType[] = [
  { ic: "chat", t: "Sohbet", s: "Serbest muhabbet", g1: "#A855F7", g2: "#7C3AED", scene: "club" },
  { ic: "mic", t: "Karaoke", s: "Şarkı & sahne", g1: "#F5CE6E", g2: "#C8922B", scene: "lounge" },
  { ic: "dice", t: "Oyun", s: "Oyun & yarışma", g1: "#34D399", g2: "#059669", scene: "night" },
];

export function CreateSheet({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (r: Room) => void }) {
  const [type, setType] = useState(0);
  const [name, setName] = useState("");
  const [priv, setPriv] = useState(false);
  const sel = TYPES[type];

  const submit = () => {
    if (!name.trim()) return;
    haptic.success();
    const room: Room = {
      id: String(Math.floor(100000 + Math.random() * 899999)),
      name: name.trim(),
      host: "Sen",
      online: 1,
      mic: 1,
      extra: 0,
      live: true,
      scene: sel.scene,
      locked: priv,
      pass: priv ? "1234" : undefined,
      owner: true,
      crowd: ["Sen"],
    };
    setName("");
    setPriv(false);
    setType(0);
    onCreate(room);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 20 }}>
        <Gradient colors={[sel.g1, sel.g2]} deg={135} style={styles.hero}>
          <Icon name={sel.ic} size={23} color="#fff" />
        </Gradient>
        <View>
          <Txt weight="displayBold" size={18} color="#fff">Oda Oluştur</Txt>
          <Txt size={11} color={C.dim} style={{ marginTop: 2 }}>Kendi odanı aç, arkadaşlarını davet et</Txt>
        </View>
      </View>

      <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, marginBottom: 7 }}>ODA ADI</Txt>
      <TextInput value={name} onChangeText={setName} maxLength={24} placeholder="Örn: Gece Muhabbeti" placeholderTextColor={C.dim2} style={styles.input} />
      <Txt size={9.5} color={C.dim2} align="right" style={{ marginTop: 4 }}>{name.length}/24</Txt>

      <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, marginTop: 10, marginBottom: 8 }}>ODA TÜRÜ</Txt>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {TYPES.map((t, i) => {
          const on = i === type;
          return (
            <Pressable key={t.t} onPress={() => { haptic.select(); setType(i); }} style={[styles.typeCard, { borderColor: on ? t.g1 : "rgba(255,255,255,.08)", backgroundColor: on ? `${t.g1}1F` : "rgba(255,255,255,.03)" }]}>
              {on ? (
                <Gradient colors={[t.g1, t.g2]} deg={160} style={styles.typeIcon}>
                  <Icon name={t.ic} size={19} color="#fff" />
                </Gradient>
              ) : (
                <View style={[styles.typeIcon, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                  <Icon name={t.ic} size={19} color={C.dim} />
                </View>
              )}
              <Txt weight="extrabold" size={12} color={on ? "#fff" : C.text}>{t.t}</Txt>
              <Txt size={9} color={C.dim} align="center" style={{ marginTop: 2 }}>{t.s}</Txt>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => { haptic.select(); setPriv((p) => !p); }} style={[styles.privRow, { borderColor: priv ? `${C.gold}55` : "rgba(255,255,255,.08)" }]}>
        <View style={[styles.privIcon, { backgroundColor: priv ? `${C.gold}1A` : "rgba(255,255,255,.06)", borderColor: priv ? `${C.gold}44` : "transparent" }]}>
          <Icon name="lock" size={16} color={priv ? C.gold : C.dim} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="extrabold" size={12.5} color={C.text}>Gizli Oda</Txt>
          <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Şifre ile giriş · listede görünmez</Txt>
        </View>
        <View style={[styles.toggle, { backgroundColor: priv ? C.gold : "rgba(255,255,255,.12)", alignItems: priv ? "flex-end" : "flex-start" }]}>
          <View style={styles.knob} />
        </View>
      </Pressable>

      <Pressable onPress={submit} disabled={!name.trim()} style={{ marginTop: 18, borderRadius: 15, overflow: "hidden", opacity: name.trim() ? 1 : 0.5 }}>
        <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.createBtn}>
          <Txt weight="extrabold" size={14} color="#241A05">Odayı Aç</Txt>
        </Gradient>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  input: { width: "100%", backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, color: C.text, fontSize: 13.5, fontWeight: "600" },
  typeCard: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1.5, alignItems: "center" },
  typeIcon: { width: 38, height: 38, borderRadius: 11, marginBottom: 8, alignItems: "center", justifyContent: "center" },
  privRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 15, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1 },
  privIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  toggle: { width: 42, height: 24, borderRadius: 999, padding: 2, justifyContent: "center" },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  createBtn: { paddingVertical: 15, alignItems: "center" },
});
