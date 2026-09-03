import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CenterModal } from "@/components/CenterModal";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { listRoomBans, setRoomPassword, unbanRoomUser, updateRoomSettings, type RoomBan } from "@/data/remote/roomsRepo";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { THEME_LABEL } from "./room-manage-edit";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function kickZamani(at: number) {
  const d = new Date(at);
  const ay = AYLAR[d.getMonth()];
  const sa = String(d.getHours()).padStart(2, "0");
  const dk = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${ay} ${sa}:${dk}`;
}

type EditField = { key: "name" | "announce"; label: string; multiline?: boolean } | null;

/** Bölüm başlığı — üç bölümün de aralığı ve tipografisi aynı olsun diye tek yerde. */
function Bolum({ baslik, adet }: { baslik: string; adet?: number }) {
  return (
    <View style={styles.bolum}>
      <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5 }}>{baslik}</Txt>
      {!!adet && (
        <View style={styles.countPill}>
          <Txt weight="extrabold" size={9.5} color={C.red}>{adet}</Txt>
        </View>
      )}
    </View>
  );
}

/** Ayar satırı — ikon kutusu + başlık + mevcut değer + ok. */
function Satir({ icon, tint, baslik, deger, onPress }: { icon: IconName; tint: string; baslik: string; deger: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: `${tint}1A` }]}>
        <Icon name={icon} size={15} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="extrabold" size={12.5} color={C.text}>{baslik}</Txt>
        <Txt size={10.5} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>{deger || "—"}</Txt>
      </View>
      <Icon name="chev" size={14} color={C.dim2} />
    </Pressable>
  );
}

export default function RoomManageScreen() {
  const router = useRouter();
  const roomName = useApp((s) => s.roomName);
  const roomAnnounce = useApp((s) => s.roomAnnounce);
  const roomLocked = useApp((s) => s.roomLocked);
  const setRoomName = useApp((s) => s.setRoomName);
  const setRoomAnnounce = useApp((s) => s.setRoomAnnounce);
  const setRoomLocked = useApp((s) => s.setRoomLocked);
  const setRoomPass = useApp((s) => s.setRoomPass);
  const kickedUsers = useApp((s) => s.kickedUsers);
  const unkickFromRoom = useApp((s) => s.unkickFromRoom);
  const currentRoom = useApp((s) => s.currentRoom);
  const patchCurrentRoom = useApp((s) => s.patchCurrentRoom);

  // DB odada yasaklılar kalıcı (022); mock odada eski geçici liste.
  const dbId = currentRoom?.dbId;
  const live = !!dbId && isSupabaseConfigured;
  const isOwner = !!currentRoom?.owner; // ayar düzenleme yalnız sahip (RLS de zorlar)
  // 054: yönetim işlemi görmüş odada sahip hiçbir bilgiyi düzenleyemez.
  const kilitli = !!currentRoom?.islemGordu;
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
    if (kilitli) { haptic.warning(); return; }
    haptic.light();
    setEdit({ key, label, multiline });
    setTmp(value);
  };
  const saveEdit = () => {
    if (!edit) return;
    haptic.success();
    const v = tmp.trim();
    if (edit.key === "name") {
      const yeni = v || roomName;
      setRoomName(yeni);
      if (live && dbId) { patchCurrentRoom({ name: yeni }); updateRoomSettings(dbId, { ad: yeni }).catch(() => {}); }
    } else {
      setRoomAnnounce(v);
      if (live && dbId) { patchCurrentRoom({ announce: v || undefined }); updateRoomSettings(dbId, { aciklama: v || null }).catch(() => {}); }
    }
    setEdit(null);
  };
  const toggleLock = () => {
    if (kilitli) { haptic.warning(); return; }
    haptic.light();
    if (roomLocked) {
      setRoomLocked(false); setRoomPass("");
      if (live && dbId) { patchCurrentRoom({ locked: false }); setRoomPassword(dbId, null).catch(() => {}); }
    } else setLockWarn(true);
  };
  const confirmPass = async () => {
    if (pass.length !== 4) return;
    haptic.success();
    setRoomLocked(true); setRoomPass(pass); setLockPad(false);
    if (live && dbId) { patchCurrentRoom({ locked: true }); try { await setRoomPassword(dbId, pass); } catch { /* RLS/ağ */ } }
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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight="displayBold" size={16} color="#fff">Oda Yönetimi</Txt>
            <Txt weight="semibold" size={10.5} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>
              {roomName}{currentRoom?.id ? ` · ID:${currentRoom.id}` : ""}
            </Txt>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {/* İşlem görmüş odada sahip hiçbir bilgiyi düzenleyemez (054).
              Sunucu da RLS ile engelliyor; bu, sebebi görünür kılan uyarı. */}
          {kilitli && (
            <View style={styles.islemUyari}>
              <View style={styles.islemIkon}>
                <Icon name="ban" size={16} color="#FB7185" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={12.5} color="#FB7185">Bu odaya işlem yapıldı</Txt>
                <Txt size={11} color={C.dim} lh={1.45} style={{ marginTop: 3 }}>
                  {currentRoom?.islemSebep
                    ? `${currentRoom.islemSebep} — düzenleme kapalı.`
                    : "Yönetim işlemi sürerken oda bilgilerini düzenleyemezsin."}
                </Txt>
              </View>
            </View>
          )}

          {/* Görsel ayarlar — kapak ve tema listede yan yana iki önizleme.
              Eskiden ikisi de 34px'lik aynı Scene küçük resmiyle satır halindeydi,
              üst üste iki tıpatıp satır gibi görünüyordu. */}
          {live && isOwner && (
            <>
              <Bolum baslik="ODA GÖRÜNÜMÜ" />
              <View style={{ flexDirection: "row", gap: 11 }}>
                <Pressable disabled={kilitli} onPress={() => router.navigate("/room-manage-edit?section=avatar")} style={[styles.onizlemeKart, kilitli && styles.kapali]}>
                  {/* Oda fotoğrafı kare değil yuvarlak: her yerde avatar gibi gösteriliyor */}
                  <View style={[styles.onizleme, styles.onizlemeOrtali]}>
                    <View style={styles.odaAvatar}>
                      {currentRoom?.photo
                        ? <Image source={{ uri: currentRoom.photo }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} />
                        : <View style={styles.onizlemeBos}><Icon name="camera" size={19} color={C.dim2} /></View>}
                    </View>
                  </View>
                  <View style={styles.onizlemeAlt}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={12} color={C.text}>Oda Fotoğrafı</Txt>
                      <Txt size={9.5} color={C.dim} numberOfLines={1} style={{ marginTop: 1 }}>{currentRoom?.photo ? "Ayarlı" : "Yok"}</Txt>
                    </View>
                    <Icon name="edit" size={13} color={C.dim2} />
                  </View>
                </Pressable>

                <Pressable disabled={kilitli} onPress={() => router.navigate("/room-manage-edit?section=tema")} style={[styles.onizlemeKart, kilitli && styles.kapali]}>
                  <View style={styles.onizleme}>
                    <Scene kind={currentRoom?.scene ?? "club"} />
                  </View>
                  <View style={styles.onizlemeAlt}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={12} color={C.text}>Tema</Txt>
                      <Txt size={9.5} color={C.dim} numberOfLines={1} style={{ marginTop: 1 }}>{THEME_LABEL[currentRoom?.scene ?? "club"]}</Txt>
                    </View>
                    <Icon name="edit" size={13} color={C.dim2} />
                  </View>
                </Pressable>
              </View>
            </>
          )}

          <Bolum baslik="ODA BİLGİLERİ" />
          <View style={[styles.group, kilitli && styles.kapali]}>
            <Satir icon="edit" tint={C.purple2} baslik="Oda İsmi" deger={roomName} onPress={() => openEdit("name", "Oda İsmi", roomName)} />
            <View style={styles.divider} />
            <Satir icon="chat" tint={C.teal} baslik="Duyuru" deger={roomAnnounce} onPress={() => openEdit("announce", "Duyuru", roomAnnounce, true)} />
          </View>

          <Bolum baslik="ODADAN ATILANLAR" adet={kickList.length} />

          {kickList.length === 0 ? (
            <View style={styles.emptyKick}>
              <Icon name="ban" size={17} color={C.dim2} />
              <Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Odadan atılan kimse yok. Atılan kişiler burada listelenir; listeden silersen tekrar girebilir.</Txt>
            </View>
          ) : (
            <View style={styles.group}>
              {kickList.map((k, i) => (
                <View key={k.key}>
                  {i > 0 && <View style={styles.dividerGenis} />}
                  <View style={[styles.row, { gap: 11 }]}>
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

          <Bolum baslik="GİZLİLİK" />

          <View style={styles.group}>
            <Pressable disabled={kilitli} onPress={toggleLock} style={[styles.row, roomLocked && { backgroundColor: `${C.gold}0F` }, kilitli && styles.kapali]}>
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
  islemUyari: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 14, padding: 13, borderRadius: 16, backgroundColor: "rgba(251,113,133,.10)", borderWidth: 1.5, borderColor: "rgba(251,113,133,.34)" },
  islemIkon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.14)", borderWidth: 1, borderColor: "rgba(251,113,133,.30)" },
  kapali: { opacity: 0.45 },
  bolum: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 22, marginBottom: 10 },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  // Ayırıcılar satırın metniyle hizalanır: 13 dolgu + öndeki kutu + 12 boşluk.
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 59 },
  dividerGenis: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 64 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
  countPill: { minWidth: 18, paddingHorizontal: 6, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: `${C.red}29`, borderWidth: 1, borderColor: `${C.red}4D` },
  onizlemeKart: { flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  onizleme: { height: 78, backgroundColor: "rgba(255,255,255,.04)" },
  onizlemeOrtali: { alignItems: "center", justifyContent: "center" },
  odaAvatar: { width: 58, height: 58, borderRadius: 29, overflow: "hidden", borderWidth: 1.5, borderColor: C.gold + "4D", backgroundColor: "rgba(255,255,255,.05)" },
  onizlemeBos: { flex: 1, alignItems: "center", justifyContent: "center" },
  onizlemeAlt: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
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
