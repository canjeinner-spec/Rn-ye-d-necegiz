import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { CenterModal } from "@/components/CenterModal";
import { MenuIcon } from "@/components/MenuIcon";
import { Txt } from "@/components/Txt";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export function CouponSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<null | "ok" | "err">(null);

  const submit = () => {
    if (code.trim().length < 4) return;
    const ok = code.trim().toUpperCase().startsWith("ARON");
    haptic[ok ? "success" : "warning"]();
    setState(ok ? "ok" : "err");
  };
  const close = () => { setCode(""); setState(null); onClose(); };

  return (
    <CenterModal visible={visible} onClose={close}>
      <View style={styles.dialog}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <MenuIcon icon="ticket" g1="#06B6D4" g2="#0891B2" size={32} />
          <Txt weight="displayBold" size={17} color="#fff">Hediye Kuponu</Txt>
        </View>

        {state === "ok" ? (
          <View style={{ alignItems: "center", paddingTop: 16, paddingBottom: 2 }}>
            <Txt size={40} style={{ marginBottom: 10 }}>🎁</Txt>
            <Txt weight="displayBold" size={16} color="#fff">Kupon kullanıldı!</Txt>
            <Txt size={12} color={C.dim} align="center" style={{ marginTop: 8 }}>500 altın + 7 gün VIP hesabına tanımlandı.</Txt>
            <Pressable onPress={close} style={{ alignSelf: "stretch", marginTop: 18, borderRadius: 14, overflow: "hidden" }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                <Txt weight="extrabold" size={13.5} color="#241A05">Tamam</Txt>
              </Gradient>
            </Pressable>
          </View>
        ) : (
          <>
            <Txt size={11.5} color={C.dim} style={{ marginTop: 10, marginBottom: 12 }}>Kodunu gir, ödülünü anında al.</Txt>
            <TextInput
              value={code}
              onChangeText={(t) => { setCode(t); setState(null); }}
              placeholder="ARON-XXXX-XXXX"
              placeholderTextColor={C.dim2}
              autoCapitalize="characters"
              style={[styles.input, { borderColor: state === "err" ? C.red : C.line }]}
            />
            {state === "err" && <Txt size={11} color={C.red} align="center" style={{ marginTop: 8 }}>Geçersiz veya süresi dolmuş kupon kodu.</Txt>}
            <Pressable onPress={submit} disabled={code.trim().length < 4} style={{ marginTop: 14, borderRadius: 14, overflow: "hidden", opacity: code.trim().length < 4 ? 0.45 : 1 }}>
              <Gradient colors={["#06B6D4", "#0891B2"]} deg={90} style={styles.btn}>
                <Txt weight="extrabold" size={13.5} color="#fff">Kuponu Kullan</Txt>
              </Gradient>
            </Pressable>
          </>
        )}
      </View>
    </CenterModal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: 24, padding: 22, backgroundColor: "#181620", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  input: { width: "100%", backgroundColor: C.card, borderWidth: 1, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 15, color: C.text, fontSize: 15, textAlign: "center", letterSpacing: 2, fontWeight: "700" },
  btn: { paddingVertical: 14, alignItems: "center" },
});
