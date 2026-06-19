import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Role = "host" | "mod" | "user";
type Member = { name: string; role: Role; active: boolean };

type Props = {
  room: Room;
  roomName: string;
  setRoomName: (v: string) => void;
  roomPhoto: string | null;
  announce: string;
  setAnnounce: (v: string) => void;
  locked: boolean;
  setLocked: (v: boolean) => void;
  setRoomPass: (v: string) => void;
  memberCount: number;
  canManage: boolean;
  onReport: () => void;
  onStats: () => void;
  onClose: () => void;
};

const ROOM_LV = 29;
const ROOM_XP = 13490;
const ROOM_NEXT = 15000;

function InfoRow({ label, right }: { label: string; right: string }) {
  return (
    <View style={styles.infoRow}>
      <Txt weight="semibold" size={13.5} color={C.dim}>{label}</Txt>
      <View style={{ flex: 1 }} />
      <Txt weight="bold" size={13.5} color={C.text}>{right}</Txt>
    </View>
  );
}

function ManageRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.manageRow}>
      <Txt weight="bold" size={13} color={C.text}>{label}</Txt>
      <View style={{ flex: 1 }} />
      <Txt size={12} color={C.dim} numberOfLines={1} style={{ maxWidth: 140 }}>{value || "—"}</Txt>
      <Icon name="chev" size={14} color={C.dim2} />
    </Pressable>
  );
}

function RoleBtn({ icon, color, label, dim, onPress }: { icon: IconName; color: string; label: string; dim?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", gap: 6, opacity: dim ? 0.4 : 1 }}>
      <View style={[styles.roleIcon, { borderColor: color + "44", backgroundColor: color + "1F" }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Txt weight="bold" size={10.5} color={color}>{label}</Txt>
    </Pressable>
  );
}

export function RoomPanel(props: Props) {
  const { room, roomName, setRoomName, roomPhoto, announce, setAnnounce, locked, setLocked, setRoomPass, memberCount, canManage, onReport, onStats, onClose } = props;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [lockWarn, setLockWarn] = useState(false);
  const [lockSheet, setLockSheet] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [editField, setEditField] = useState<{ label: string; multiline?: boolean; set: (v: string) => void } | null>(null);
  const [tmp, setTmp] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>(() =>
    (room.crowd || [])
      .concat(["Melis", "Rüya", "Furkan"])
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((n, i) => ({ name: n, role: n === room.host ? "host" : i === 1 ? "mod" : "user", active: i % 3 !== 0 }))
  );

  const openEdit = (label: string, value: string, set: (v: string) => void, multiline?: boolean) => {
    setEditField({ label, set, multiline });
    setTmp(value);
  };
  const confirmLock = () => {
    if (passInput.length !== 4) return;
    setRoomPass(passInput);
    setLocked(true);
    setLockSheet(false);
    setPassInput("");
  };
  const makeMod = (i: number) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, role: "mod" } : m)));
  const makeUser = (i: number) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, role: "user" } : m)));
  const kick = (i: number) => { setMembers((ms) => ms.filter((_, j) => j !== i)); setExpanded(null); };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
          <Pressable style={{ flex: 1 }}>
            <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(22,19,32,0.88)", "rgba(11,10,16,0.94)"]} deg={170} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.glint} pointerEvents="none" />
            <View style={styles.handle} />

            <View style={styles.tabbar}>
              {["Profil", "Üyeler"].map((t, i) => (
                <Pressable key={t} onPress={() => setTab(i)} style={styles.tabBtn}>
                  <Txt weight={i === tab ? "extrabold" : "medium"} size={15} color={i === tab ? "#fff" : "rgba(255,255,255,.42)"}>{t}</Txt>
                  {i === tab && <Gradient colors={[C.gold, "#C8922B"]} deg={90} style={styles.tabUnderline} />}
                </Pressable>
              ))}
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 + insets.bottom }}>
              {tab === 0 ? (
                <>
                  <View style={styles.idCard}>
                    <View style={styles.idThumb}>
                      {roomPhoto ? <Image source={{ uri: roomPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={15} color="#fff" numberOfLines={1}>{roomName}</Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <Txt weight="semibold" size={11} color={C.dim}>ID:{room.id}</Txt>
                        <Icon name="copy" size={12} color={C.dim2} />
                      </View>
                    </View>
                    <Pressable onPress={onReport}>
                      <Icon name="warn" size={20} color="rgba(255,255,255,.4)" />
                    </Pressable>
                  </View>

                  <View style={styles.levelHeader}>
                    <Txt weight="semibold" size={13.5} color={C.dim}>Level</Txt>
                    <View style={{ flex: 1 }} />
                    <Txt weight="semibold" size={11.5} color="rgba(255,255,255,.45)">{ROOM_XP.toLocaleString("tr-TR")}/{ROOM_NEXT.toLocaleString("tr-TR")}</Txt>
                    <Txt weight="displayBold" size={14} color="#5EEAD4" style={{ marginLeft: 8 }}>LV.{ROOM_LV}</Txt>
                  </View>
                  <View style={styles.levelTrack}>
                    <View style={{ height: "100%", width: `${(ROOM_XP / ROOM_NEXT) * 100}%`, borderRadius: 4, backgroundColor: "#06B6D4" }} />
                  </View>
                  <Pressable onPress={onStats} style={styles.levelBanner}>
                    <Txt weight="semibold" size={11.5} color={C.dim} style={{ flex: 1 }}>Level Atlayın ve Oda Avantajlarının Kilidini Açın</Txt>
                    <View style={{ flexDirection: "row" }}>
                      {(room.crowd || []).slice(0, 2).map((n, i) => (
                        <View key={n} style={{ marginLeft: i ? -8 : 0, borderRadius: 16, borderWidth: 2, borderColor: "rgba(22,19,32,.9)" }}>
                          <Portrait name={n} size={28} />
                        </View>
                      ))}
                    </View>
                    <Icon name="chev" size={14} color={C.dim2} />
                  </Pressable>

                  <InfoRow label="Üyeler" right={String(memberCount)} />
                  <InfoRow label="Dil" right="Türkçe" />
                  <InfoRow label="Ülke" right="🇹🇷 Türkiye" />
                  <InfoRow label="Etiket" right={room.official ? "Resmî" : "Sohbet"} />
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Txt weight="semibold" size={13.5} color={C.dim}>Duyuru</Txt>
                    <View style={{ flex: 1 }} />
                    <Txt weight="semibold" size={12.5} color={C.text} align="right" lh={1.5} style={{ maxWidth: "58%", fontStyle: "italic" }}>
                      {announce || (room.official ? "Aron'a hoş geldin, keyifli sohbetler!" : "Herkes davetli, saygıyı koru 🌙")}
                    </Txt>
                  </View>

                  {canManage && (
                    <View style={{ marginTop: 10, gap: 8 }}>
                      <Txt weight="bold" size={11} color={C.dim2} style={{ letterSpacing: 0.5, marginBottom: 4 }}>ODA YÖNETİMİ</Txt>
                      <ManageRow label="Oda İsmi" value={roomName} onPress={() => openEdit("Oda İsmi", roomName, setRoomName)} />
                      <ManageRow label="Duyuru" value={announce} onPress={() => openEdit("Duyuru", announce, setAnnounce, true)} />
                      <Pressable onPress={() => (locked ? (setLocked(false), setRoomPass("")) : setLockWarn(true))} style={[styles.manageRow, locked && { borderColor: C.gold + "44", backgroundColor: C.gold + "0F" }]}>
                        <Icon name={locked ? "lock" : "unlock"} size={17} color={locked ? C.gold : C.dim} />
                        <Txt weight="bold" size={13} color={locked ? C.gold : C.text} style={{ marginLeft: 10 }}>{locked ? "Kilitli" : "Odayı Kilitle"}</Txt>
                        <View style={{ flex: 1 }} />
                        <View style={[styles.toggle, { backgroundColor: locked ? C.gold : "rgba(255,255,255,.12)", alignItems: locked ? "flex-end" : "flex-start" }]}>
                          <View style={styles.knob} />
                        </View>
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                    <Txt weight="bold" size={13} color={C.dim}>
                      Üyeler: <Txt weight="bold" size={13} color={C.gold2}>{members.length}</Txt>
                      <Txt weight="bold" size={13} color={C.dim2}>/1000</Txt>
                    </Txt>
                  </View>
                  <View style={styles.searchRow}>
                    <Icon name="search" size={15} color={C.dim2} />
                    <Txt size={12.5} color={C.dim2}>Kullanıcı adı veya numarası ara</Txt>
                  </View>

                  {members.map((m, i) => {
                    const isOpen = expanded === i;
                    const canEdit = canManage && m.role !== "host";
                    const roleColor = m.role === "host" ? C.gold2 : m.role === "mod" ? C.purple2 : C.dim;
                    const roleLabel = m.role === "host" ? "Sahip" : m.role === "mod" ? "Yardımcı" : null;
                    return (
                      <View key={m.name + i}>
                        <Pressable onPress={canEdit ? () => setExpanded(isOpen ? null : i) : undefined} style={styles.memberRow}>
                          <Portrait name={m.name} size={46} online={m.active} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Txt weight="extrabold" size={13.5} color={m.role === "host" ? C.gold2 : C.text}>{m.name}</Txt>
                              <Txt weight="extrabold" size={10.5} color="#5EEAD4">LV.{22 + i}</Txt>
                              {roleLabel && (
                                <View style={{ borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7, backgroundColor: (m.role === "host" ? C.gold : C.purple2) + "1F", borderWidth: 1, borderColor: (m.role === "host" ? C.gold : C.purple2) + "44" }}>
                                  <Txt weight="extrabold" size={9} color={roleColor}>{roleLabel}</Txt>
                                </View>
                              )}
                            </View>
                            <Txt size={10.5} color={C.dim2} style={{ marginTop: 2 }}>{m.active ? "Bugün" : "1 gün önce"} aktifti</Txt>
                          </View>
                          {canEdit ? (
                            <View style={[styles.memberArrow, { backgroundColor: isOpen ? "rgba(245,206,110,.15)" : "rgba(255,255,255,.05)", borderColor: isOpen ? C.gold + "44" : "rgba(255,255,255,.1)" }]}>
                              <Icon name="chev" size={15} color={isOpen ? C.gold2 : C.dim} />
                            </View>
                          ) : (
                            <Icon name="user" size={18} color={roleColor} />
                          )}
                        </Pressable>
                        {isOpen && canEdit && (
                          <View style={styles.manageActions}>
                            <RoleBtn icon="trash" color="#FB7185" label="Çıkar" onPress={() => kick(i)} />
                            <RoleBtn icon="user" color={C.gold2} label="Üye Yap" dim={m.role === "user"} onPress={() => makeUser(i)} />
                            <RoleBtn icon="crown" color="#5EEAD4" label="Yardımcı Yap" dim={m.role === "mod"} onPress={() => makeMod(i)} />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>

      {lockWarn && (
        <Pressable style={styles.centerOverlay} onPress={() => setLockWarn(false)}>
          <Pressable style={styles.dialog}>
            <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.dialogIcon}>
              <Icon name="lock" size={25} sw={2} color="#3A2A05" />
            </Gradient>
            <Txt weight="displayBold" size={16.5} color="#fff" align="center">Odayı Kilitle?</Txt>
            <Txt size={11.5} color="rgba(255,255,255,.7)" lh={1.6} align="center" style={{ marginTop: 10 }}>
              Odanı şifrelersen yeni kullanıcılara ve oda listesinde görünmez olur; yalnızca doğrudan katılım yapanlar şifreyle girebilir.
            </Txt>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Pressable onPress={() => setLockWarn(false)} style={[styles.dlgBtn, { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" }]}>
                <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
              </Pressable>
              <Pressable onPress={() => { setLockWarn(false); setPassInput(""); setLockSheet(true); }} style={{ flex: 1.3, borderRadius: 13, overflow: "hidden" }}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={[styles.dlgBtn, { flex: undefined }]}>
                  <Txt weight="extrabold" size={13} color="#3A2A05">Onayla & Devam</Txt>
                </Gradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}

      {lockSheet && (
        <Pressable style={styles.centerOverlay} onPress={() => setLockSheet(false)}>
          <Pressable style={styles.dialog}>
            <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.dialogIcon}>
              <Icon name="lock" size={26} sw={2} color="#3A2A05" />
            </Gradient>
            <Txt weight="displayBold" size={17} color="#fff" align="center">Oda Şifresi Belirle</Txt>
            <Txt size={11.5} color={C.dim} lh={1.5} align="center" style={{ marginTop: 8 }}>4 haneli şifre gir. Odaya girmek isteyenler bu şifreyi soracak.</Txt>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginVertical: 20 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.passCell, { backgroundColor: passInput[i] ? C.gold + "1A" : "rgba(255,255,255,.05)", borderColor: passInput[i] ? C.gold + "66" : "rgba(255,255,255,.12)" }]}>
                  <Txt weight="displayBold" size={24} color={C.gold2}>{passInput[i] || ""}</Txt>
                </View>
              ))}
            </View>
            <View style={styles.keypad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
                k === "" ? (
                  <View key={i} style={styles.key} />
                ) : (
                  <Pressable key={i} onPress={() => { if (k === "⌫") setPassInput((p) => p.slice(0, -1)); else if (passInput.length < 4) setPassInput((p) => p + k); }} style={[styles.key, styles.keyFilled]}>
                    <Txt weight="extrabold" size={k === "⌫" ? 16 : 18} color={C.text}>{k}</Txt>
                  </Pressable>
                )
              )}
            </View>
            <Pressable onPress={confirmLock} disabled={passInput.length !== 4} style={{ width: "100%", marginTop: 16, borderRadius: 14, overflow: "hidden", opacity: passInput.length === 4 ? 1 : 0.45 }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 14, alignItems: "center" }}>
                <Txt weight="extrabold" size={14} color="#3A2A05">Kilitle</Txt>
              </Gradient>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {editField && (
        <Pressable style={styles.centerOverlay} onPress={() => setEditField(null)}>
          <Pressable style={[styles.dialog, { maxWidth: 320 }]}>
            <Txt weight="displayBold" size={16} color="#fff" style={{ marginBottom: 14 }}>{editField.label}</Txt>
            <TextInput
              value={tmp}
              onChangeText={setTmp}
              autoFocus
              multiline={editField.multiline}
              placeholderTextColor={C.dim2}
              style={[styles.editInput, editField.multiline && { height: 90, textAlignVertical: "top" }]}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => setEditField(null)} style={[styles.dlgBtn, { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" }]}>
                <Txt weight="bold" size={13} color={C.text}>İptal</Txt>
              </Pressable>
              <Pressable onPress={() => { editField.set(tmp); setEditField(null); }} style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
                <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={styles.dlgBtn}>
                  <Txt weight="extrabold" size={13} color="#fff">Kaydet</Txt>
                </Gradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.55)" },
  sheet: { height: "88%", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.18)", backgroundColor: "rgba(14,12,20,0.6)" },
  glint: { position: "absolute", top: 0, left: 60, right: 60, height: 1, backgroundColor: "rgba(255,255,255,.55)" },
  handle: { width: 38, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.2)", alignSelf: "center", marginTop: 12 },
  tabbar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)", paddingHorizontal: 8, marginTop: 6 },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabUnderline: { position: "absolute", bottom: -1, width: 28, height: 3, borderRadius: 3 },
  idCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", marginBottom: 4 },
  idThumb: { width: 68, height: 68, borderRadius: 14, overflow: "hidden" },
  levelHeader: { flexDirection: "row", alignItems: "center", paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)" },
  levelTrack: { height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.08)", marginVertical: 8, overflow: "hidden" },
  levelBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)", marginBottom: 4 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)" },
  manageRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  toggle: { width: 42, height: 24, borderRadius: 999, padding: 2, justifyContent: "center" },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", marginBottom: 14 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  memberArrow: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  manageActions: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  roleIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  centerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3,3,8,.62)", alignItems: "center", justifyContent: "center", padding: 28 },
  dialog: { width: "100%", maxWidth: 300, borderRadius: 24, padding: 22, alignItems: "center", backgroundColor: "rgba(28,24,40,0.98)", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  dialogIcon: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  dlgBtn: { flex: 1, paddingVertical: 13, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  passCell: { width: 44, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%" },
  key: { width: "30%", flexGrow: 1, paddingVertical: 14, alignItems: "center", borderRadius: 14 },
  keyFilled: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  editInput: { width: "100%", backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 13.5, fontFamily: "PlusJakartaSans_500Medium" },
});
