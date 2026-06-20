import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CenterModal } from "@/components/CenterModal";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type EditField = { key: "name" | "announce"; label: string; multiline?: boolean } | null;

export default function RoomManageScreen() {
  const router = useRouter();
  const { roomName, roomAnnounce, roomLocked, setRoomName, setRoomAnnounce, setRoomLocked, setRoomPass } = useApp();

  const [edit, setEdit] = useState<EditField>(null);
  const [tmp, setTmp] = useState("");
  const [lockWarn, setLockWarn] = useState(false);
  const [lockPad, setLockPad] = useState(false);
  const [pass, setPass] = useState("");

  const openEdit = (key: "name" | "announce", label: string, value: string, multiline?: boolean) => {
    haptic.light();
    setEdit({ key, label, multiline });
    setTmp(value);
  };
  const saveEdit = () => {
    if (!edit) return;
    haptic.success();
    if (edit.key === "name") setRoomName(tmp.trim() || roomName);
    else setRoomAnnounce(tmp.trim());
    setEdit(null);
  };
  const toggleLock = () => {
    haptic.light();
    if (roomLocked) { setRoomLocked(false); setRoomPass(""); }
    else setLockWarn(true);
  };
  const confirmPass = () => {
    if (pass.length !== 4) return;
    haptic.success();
    setRoomPass(pass);
    setRoomLocked(true);
    setLockPad(false);
    setPass("");
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="gear" size={17} color={C.gold} />
            <Txt weight="displayBold" size={16} color="#fff">Oda Yönetimi</Txt>
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionLbl}>ODA BİLGİLERİ</Txt>

          <Pressable onPress={() => openEdit("name", "Oda İsmi", roomName)} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: "rgba(168,85,247,.15)" }]}>
              <Icon name="edit" size={15} color="#A78BFA" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="extrabold" size={12.5} color={C.text}>Oda İsmi</Txt>
              <Txt size={10.5} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>{roomName || "—"}</Txt>
            </View>
            <Icon name="chev" size={14} color={C.dim2} />
          </Pressable>

          <Pressable onPress={() => openEdit("announce", "Duyuru", roomAnnounce, true)} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: "rgba(96,165,250,.15)" }]}>
              <Icon name="chat" size={15} color="#60A5FA" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="extrabold" size={12.5} color={C.text}>Duyuru</Txt>
              <Txt size={10.5} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>{roomAnnounce || "—"}</Txt>
            </View>
            <Icon name="chev" size={14} color={C.dim2} />
          </Pressable>

          <Txt weight="bold" size={10.5} color={C.dim} style={[styles.sectionLbl, { marginTop: 22 }]}>GİZLİLİK</Txt>

          <Pressable onPress={toggleLock} style={[styles.row, roomLocked && { borderColor: C.gold + "44", backgroundColor: C.gold + "0F" }]}>
            <View style={[styles.rowIcon, { backgroundColor: roomLocked ? C.gold + "1A" : "rgba(255,255,255,.06)" }]}>
              <Icon name={roomLocked ? "lock" : "unlock"} size={15} color={roomLocked ? C.gold : C.dim} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="extrabold" size={12.5} color={roomLocked ? C.gold2 : C.text}>{roomLocked ? "Oda Kilitli" : "Odayı Kilitle"}</Txt>
              <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>Şifre ile giriş · listede görünmez</Txt>
            </View>
            <View style={[styles.toggle, { backgroundColor: roomLocked ? C.gold : "rgba(255,255,255,.12)", alignItems: roomLocked ? "flex-end" : "flex-start" }]}>
              <View style={styles.knob} />
            </View>
          </Pressable>
        </View>
      </SafeAreaView>

      <CenterModal visible={!!edit} onClose={() => setEdit(null)}>
        <View style={styles.dialog}>
          <Txt weight="displayBold" size={16} color="#fff" style={{ marginBottom: 14 }}>{edit?.label}</Txt>
          <TextInput
            value={tmp}
            onChangeText={setTmp}
            autoFocus
            multiline={edit?.multiline}
            maxLength={edit?.multiline ? 120 : 24}
            placeholderTextColor={C.dim2}
            style={[styles.input, edit?.multiline && { height: 90, textAlignVertical: "top" }]}
          />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <Pressable onPress={() => setEdit(null)} style={[styles.dlgBtn, { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" }]}>
              <Txt weight="bold" size={13} color={C.text}>İptal</Txt>
            </Pressable>
            <Pressable onPress={saveEdit} style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
              <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={styles.dlgBtn}>
                <Txt weight="extrabold" size={13} color="#fff">Kaydet</Txt>
              </Gradient>
            </Pressable>
          </View>
        </View>
      </CenterModal>

      <CenterModal visible={lockWarn} onClose={() => setLockWarn(false)}>
        <View style={[styles.dialog, { alignItems: "center" }]}>
          <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.dialogIcon}>
            <Icon name="lock" size={25} sw={2} color="#3A2A05" />
          </Gradient>
          <Txt weight="displayBold" size={16.5} color="#fff" align="center">Odayı Kilitle?</Txt>
          <Txt size={11.5} color="rgba(255,255,255,.7)" lh={1.6} align="center" style={{ marginTop: 10 }}>
            Odanı şifrelersen oda listesinde görünmez olur; yalnızca doğrudan katılanlar şifreyle girebilir.
          </Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <Pressable onPress={() => setLockWarn(false)} style={[styles.dlgBtn, { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" }]}>
              <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
            </Pressable>
            <Pressable onPress={() => { setLockWarn(false); setPass(""); setLockPad(true); }} style={{ flex: 1.3, borderRadius: 13, overflow: "hidden" }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.dlgBtn}>
                <Txt weight="extrabold" size={13} color="#3A2A05">Onayla & Devam</Txt>
              </Gradient>
            </Pressable>
          </View>
        </View>
      </CenterModal>

      <CenterModal visible={lockPad} onClose={() => setLockPad(false)}>
        <View style={[styles.dialog, { alignItems: "center" }]}>
          <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.dialogIcon}>
            <Icon name="lock" size={26} sw={2} color="#3A2A05" />
          </Gradient>
          <Txt weight="displayBold" size={17} color="#fff" align="center">Oda Şifresi Belirle</Txt>
          <Txt size={11.5} color={C.dim} lh={1.5} align="center" style={{ marginTop: 8 }}>4 haneli şifre gir. Odaya girmek isteyenler bu şifreyi soracak.</Txt>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginVertical: 20 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.passCell, { backgroundColor: pass[i] ? C.gold + "1A" : "rgba(255,255,255,.05)", borderColor: pass[i] ? C.gold + "66" : "rgba(255,255,255,.12)" }]}>
                <Txt weight="displayBold" size={24} color={C.gold2}>{pass[i] || ""}</Txt>
              </View>
            ))}
          </View>
          <View style={styles.keypad}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
              k === "" ? (
                <View key={i} style={styles.key} />
              ) : (
                <Pressable key={i} onPress={() => { haptic.select(); if (k === "⌫") setPass((p) => p.slice(0, -1)); else if (pass.length < 4) setPass((p) => p + k); }} style={[styles.key, styles.keyFilled]}>
                  <Txt weight="extrabold" size={k === "⌫" ? 16 : 18} color={C.text}>{k}</Txt>
                </Pressable>
              )
            )}
          </View>
          <Pressable onPress={confirmPass} disabled={pass.length !== 4} style={{ width: "100%", marginTop: 16, borderRadius: 14, overflow: "hidden", opacity: pass.length === 4 ? 1 : 0.45 }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 14, alignItems: "center" }}>
              <Txt weight="extrabold" size={14} color="#3A2A05">Kilitle</Txt>
            </Gradient>
          </Pressable>
        </View>
      </CenterModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  sectionLbl: { letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, padding: 13, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  toggle: { width: 42, height: 24, borderRadius: 999, padding: 2, justifyContent: "center" },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  dialog: { borderRadius: 24, padding: 22, backgroundColor: "#181620", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  dialogIcon: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  input: { width: "100%", backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 13.5, fontFamily: "PlusJakartaSans_500Medium" },
  dlgBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  passCell: { width: 44, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%" },
  key: { width: "30%", flexGrow: 1, paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  keyFilled: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
});
