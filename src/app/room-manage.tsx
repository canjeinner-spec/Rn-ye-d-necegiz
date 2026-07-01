import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CenterModal } from "@/components/CenterModal";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { listRoomBans, unbanRoomUser, type RoomBan } from "@/data/remote/roomsRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function kickZamani(at: number) {
  const d = new Date(at);
  const ay = AYLAR[d.getMonth()];
  const sa = String(d.getHours()).padStart(2, "0");
  const dk = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${ay} ${sa}:${dk}`;
}

type EditField = { key: "name" | "announce"; label: string; multiline?: boolean } | null;

export default function RoomManageScreen() {
  const router = useRouter();
  const { roomName, roomAnnounce, roomLocked, setRoomName, setRoomAnnounce, setRoomLocked, setRoomPass } = useApp();
  const kickedUsers = useApp((s) => s.kickedUsers);
  const unkickFromRoom = useApp((s) => s.unkickFromRoom);

  // DB odada yasaklılar kalıcı (022); mock odada eski geçici liste.
  const dbId = useApp((s) => s.currentRoom?.dbId);
  const live = !!dbId && isSupabaseConfigured;
  const [bans, setBans] = useState<RoomBan[]>([]);
  const reloadBans = useCallback(() => {
    if (!live || !dbId) return;
    listRoomBans(dbId).then(setBans).catch((e) => console.warn("[yasaklar]", e?.message || e));
  }, [live, dbId]);
  useEffect(() => { reloadBans(); }, [reloadBans]);
  const unban = (b: RoomBan) => {
    haptic.success();
    setBans((xs) => xs.filter((x) => x.id !== b.id)); // optimistik
    if (dbId) unbanRoomUser(dbId, b.id).catch(() => reloadBans());
  };
  const kickList: { key: string; name: string; photo?: string | null; by: string; at: number; undo: () => void }[] = live
    ? bans.map((b) => ({ key: `b${b.id}`, name: b.name, photo: b.photo, by: b.by, at: b.at, undo: () => unban(b) }))
    : kickedUsers.map((k) => ({ key: k.name, name: k.name, photo: k.photo, by: k.by, at: k.at, undo: () => { haptic.success(); unkickFromRoom(k.name); } }));

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

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionLbl}>ODA BİLGİLERİ</Txt>

          <View style={styles.group}>
            <Pressable onPress={() => openEdit("name", "Oda İsmi", roomName)} style={[styles.row, styles.rowInGroup]}>
              <View style={[styles.rowIcon, { backgroundColor: `${C.purple2}1A` }]}>
                <Icon name="edit" size={15} color={C.purple2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={12.5} color={C.text}>Oda İsmi</Txt>
                <Txt size={10.5} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>{roomName || "—"}</Txt>
              </View>
              <Icon name="chev" size={14} color={C.dim2} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable onPress={() => openEdit("announce", "Duyuru", roomAnnounce, true)} style={[styles.row, styles.rowInGroup]}>
              <View style={[styles.rowIcon, { backgroundColor: `${C.teal}1A` }]}>
                <Icon name="chat" size={15} color={C.teal} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={12.5} color={C.text}>Duyuru</Txt>
                <Txt size={10.5} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>{roomAnnounce || "—"}</Txt>
              </View>
              <Icon name="chev" size={14} color={C.dim2} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 22, marginBottom: 10 }}>
            <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5 }}>ODADAN ATILANLAR</Txt>
            {kickList.length > 0 && (
              <View style={styles.countPill}>
                <Txt weight="extrabold" size={9.5} color={C.red}>{kickList.length}</Txt>
              </View>
            )}
          </View>

          {kickList.length === 0 ? (
            <View style={styles.emptyKick}>
              <Icon name="ban" size={17} color={C.dim2} />
              <Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Odadan atılan kimse yok. Atılan kişiler burada listelenir; listeden silersen tekrar girebilir.</Txt>
            </View>
          ) : (
            <View style={styles.group}>
              {kickList.map((k, i) => (
                <View key={k.key}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={[styles.row, styles.rowInGroup, { gap: 11 }]}>
                    <Portrait name={k.name} size={40} photo={k.photo || undefined} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>{k.name}</Txt>
                      <Txt size={10} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>
                        <Txt size={10} color={C.red}>{k.by}</Txt> attı · {kickZamani(k.at)}
                      </Txt>
                    </View>
                    <Pressable onPress={k.undo} hitSlop={8} style={styles.unkickBtn}>
                      <Icon name="unlock" size={13} color={C.green} />
                      <Txt weight="extrabold" size={11} color={C.green}>Geri al</Txt>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Txt weight="bold" size={10.5} color={C.dim} style={[styles.sectionLbl, { marginTop: 22 }]}>GİZLİLİK</Txt>

          <View style={styles.group}>
            <Pressable onPress={toggleLock} style={[styles.row, styles.rowInGroup, roomLocked && { backgroundColor: `${C.gold}0F` }]}>
              <View style={[styles.rowIcon, { backgroundColor: roomLocked ? `${C.gold}1A` : "rgba(255,255,255,.06)" }]}>
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
        </ScrollView>
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
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 58 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
  rowInGroup: { marginBottom: 0 },
  countPill: { minWidth: 18, paddingHorizontal: 6, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: `${C.red}29`, borderWidth: 1, borderColor: `${C.red}4D` },
  emptyKick: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line },
  unkickBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 10, backgroundColor: `${C.green}1F`, borderWidth: 1, borderColor: `${C.green}47` },
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
