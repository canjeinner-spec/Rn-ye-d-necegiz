import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { CenterModal } from "@/components/CenterModal";
import { Txt } from "@/components/Txt";
import { updateMyProfile } from "@/data/remote/profileRepo";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { userName, userBio, setUserName, setUserBio } = useApp();
  const [n, setN] = useState(userName);
  const [b, setB] = useState(userBio);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setN(userName); setB(userBio); setErr(null); }
  }, [visible, userName, userBio]);

  const nameOk = n.trim().length >= 2 && n.trim().length <= 24;
  const save = async () => {
    if (!nameOk || saving) return;
    haptic.success();
    setErr(null);
    const name = n.trim();
    const bio = b.trim();
    // Anlık UI güncellemesi
    setUserName(name);
    setUserBio(bio);
    // Oturum varsa DB'ye de kalıcı yaz
    if (isSupabaseConfigured && useApp.getState().session) {
      setSaving(true);
      try {
        await updateMyProfile({ kullanici_adi: name, biyografi: bio || null });
      } catch (e: any) {
        const m = (e?.message || "").toLowerCase();
        setErr(m.includes("duplicate") || m.includes("unique") ? "Bu kullanıcı adı alınmış." : "Kaydedilemedi, tekrar dene.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    onClose();
  };

  return (
    <CenterModal visible={visible} onClose={onClose}>
      <View style={styles.dialog}>
        <Txt weight="displayBold" size={17} color="#fff">Profili Düzenle</Txt>

        <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>GÖRÜNEN AD</Txt>
        <TextInput value={n} onChangeText={setN} maxLength={24} placeholder="Adın" placeholderTextColor={C.dim2} style={[styles.input, { borderColor: n && !nameOk ? C.red : C.line }]} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Txt weight="semibold" size={10} color={n && !nameOk ? C.red : C.dim2}>{n && !nameOk ? "2-24 karakter olmalı" : "Herkese görünür"}</Txt>
          <Txt size={10} color={C.dim2}>{n.length}/24</Txt>
        </View>

        <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>BİYOGRAFİ</Txt>
        <TextInput value={b} onChangeText={setB} maxLength={120} multiline placeholder="Kendinden bahset..." placeholderTextColor={C.dim2} style={[styles.input, { height: 80, textAlignVertical: "top" }]} />
        <Txt size={10} color={C.dim2} align="right" style={{ marginTop: 6 }}>{b.length}/120</Txt>

        {err ? <Txt weight="semibold" size={11} color={C.red} style={{ marginTop: 10 }}>{err}</Txt> : null}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          <Pressable onPress={onClose} disabled={saving} style={[styles.btn, { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }]}>
            <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
          </Pressable>
          <Pressable onPress={save} disabled={!nameOk || saving} style={{ flex: 1, borderRadius: 14, overflow: "hidden", opacity: nameOk && !saving ? 1 : 0.45 }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
              {saving ? <ActivityIndicator color="#241A05" /> : <Txt weight="extrabold" size={13} color="#241A05">Kaydet</Txt>}
            </Gradient>
          </Pressable>
        </View>
      </View>
    </CenterModal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: 24, padding: 22, backgroundColor: "#181620", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  lbl: { marginTop: 16, letterSpacing: 0.5 },
  input: { width: "100%", marginTop: 8, backgroundColor: C.card, borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, color: C.text, fontSize: 14, fontWeight: "700" },
  btn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
