import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { Txt } from "@/components/Txt";
import { type Room } from "@/data/seed";
import { verifyRoomPassword } from "@/data/remote/roomsRepo";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function RoomPasswordGate({ room, onClose, onPass }: { room: Room; onClose: () => void; onPass: () => void }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const shake = useSharedValue(0);

  const fail = () => {
    haptic.warning();
    setErr(true);
    setVal("");
    shake.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
    setTimeout(() => setErr(false), 600);
  };
  const submit = async (v: string) => {
    if (v.length !== 4) return;
    // Gerçek oda → sunucuda hash doğrula; mock oda → client değeri (yedek).
    if (room.dbId != null) {
      try {
        if (await verifyRoomPassword(room.dbId, v)) { haptic.success(); onPass(); } else fail();
      } catch { fail(); }
    } else if (v === room.pass) { haptic.success(); onPass(); } else fail();
  };
  const press = (k: string) => {
    if (k === "⌫") { setVal((p) => p.slice(0, -1)); return; }
    if (val.length < 4) {
      const nv = val + k;
      setVal(nv);
      if (nv.length === 4) setTimeout(() => submit(nv), 150);
    }
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={shakeStyle}>
          <Pressable style={[styles.dialog, { borderColor: err ? "#EF4444" : "rgba(255,255,255,.16)" }]}>
            <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.lockIcon}>
              <Icon name="lock" size={26} sw={2} color="#3A2A05" />
            </Gradient>
            <Txt weight="displayBold" size={16.5} color="#fff" numberOfLines={1}>{room.name}</Txt>
            <Txt weight="semibold" size={11.5} color={err ? "#FCA5A5" : C.dim} align="center" style={{ marginTop: 8 }}>
              {err ? "Yanlış şifre, tekrar dene" : "Bu oda kilitli. 4 haneli şifreyi gir."}
            </Txt>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginVertical: 18 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.cell, { backgroundColor: val[i] ? C.gold + "1A" : "rgba(255,255,255,.05)", borderColor: val[i] ? C.gold + "66" : "rgba(255,255,255,.12)" }]}>
                  <Txt weight="displayBold" size={24} color={C.gold2}>{val[i] ? "•" : ""}</Txt>
                </View>
              ))}
            </View>
            <View style={styles.keypad}>
              {KEYS.map((k, i) =>
                k === "" ? (
                  <View key={i} style={styles.key} />
                ) : (
                  <Pressable key={i} onPress={() => press(k)} style={[styles.key, styles.keyFilled]}>
                    <Txt weight="extrabold" size={k === "⌫" ? 16 : 18} color={C.text}>{k}</Txt>
                  </Pressable>
                )
              )}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3,3,8,.7)", padding: 30 },
  dialog: { width: 300, maxWidth: "100%", borderRadius: 24, padding: 24, alignItems: "center", backgroundColor: "rgba(26,22,38,0.98)", borderWidth: 1 },
  lockIcon: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  cell: { width: 44, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%" },
  key: { width: "30%", flexGrow: 1, paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  keyFilled: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
});
