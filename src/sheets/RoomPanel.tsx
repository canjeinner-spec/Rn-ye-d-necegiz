import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { getRoomMembers, joinRoomMembership, leaveRoomMembership, removeRoomMember, setRoomMemberRole, type RoomMember, type RoomRole } from "@/data/remote/roomsRepo";
import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Role = "host" | "mod" | "user";
type Member = { name: string; role: Role; active: boolean };

type Props = {
  room: Room;
  roomName: string;
  roomPhoto: string | null;
  announce: string;
  locked: boolean;
  memberCount: number;
  canManage: boolean;
  onManage: () => void;
  onReport: () => void;
  onStats: () => void;
  onClose: () => void;
  /** hangi sekmeyle açılsın (varsayılan 0 = Profil; 2 = Mikrofon Sırası) */
  initialTab?: number;
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
  const { room, roomName, roomPhoto, announce, locked, memberCount, canManage, onManage, onReport, onStats, onClose, initialTab } = props;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(initialTab ?? 0);
  const [following, setFollowing] = useState(false);
  const [joined, setJoined] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>(() =>
    (room.crowd || [])
      .concat(["Melis", "Rüya", "Furkan"])
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((n, i) => ({ name: n, role: n === room.host ? "host" : i === 1 ? "mod" : "user", active: i % 3 !== 0 }))
  );

  const makeMod = (i: number) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, role: "mod" } : m)));
  const makeUser = (i: number) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, role: "user" } : m)));
  const kick = (i: number) => { setMembers((ms) => ms.filter((_, j) => j !== i)); setExpanded(null); };

  // ---- Gerçek (DB) oda: kalıcı üyelik + roller (021_oda_uyeleri) ----------
  const dbId = room.dbId;
  const live = !!dbId && isSupabaseConfigured;
  const [dbMembers, setDbMembers] = useState<RoomMember[]>([]);
  const [myRole, setMyRole] = useState<RoomRole | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadMembers = useCallback(() => {
    if (!live || !dbId) return;
    getRoomMembers(dbId)
      .then(({ members: ms, myRole: r }) => { setDbMembers(ms); setMyRole(r); })
      .catch((e) => console.warn("[oda-uye]", e?.message || e));
  }, [live, dbId]);
  useEffect(() => { reloadMembers(); }, [reloadMembers]);

  const isMember = live ? myRole != null : joined;
  const toggleJoin = async () => {
    haptic.light();
    if (!live || !dbId) { setJoined((j) => !j); return; }
    if (myRole === "sahip" || busy) return; // sahip ayrılamaz
    setBusy(true);
    try {
      if (myRole) { await leaveRoomMembership(dbId); setMyRole(null); }
      else { await joinRoomMembership(dbId); setMyRole("uye"); }
      reloadMembers();
    } catch (e) {
      console.warn("[oda-katil]", (e as Error)?.message || e);
    } finally {
      setBusy(false);
    }
  };

  // Canlı üye yönetimi (sunucu da ayrıca doğrular)
  const canManageLive = myRole === "sahip" || myRole === "yardimci" || canManage;
  const liveKick = async (m: RoomMember) => {
    if (!dbId) return;
    setExpanded(null);
    try { await removeRoomMember(dbId, m.id); reloadMembers(); } catch (e) { console.warn("[uye-cikar]", (e as Error)?.message || e); }
  };
  const liveSetRole = async (m: RoomMember, rol: "yardimci" | "uye") => {
    if (!dbId) return;
    setExpanded(null);
    try { await setRoomMemberRole(dbId, m.id, rol); reloadMembers(); } catch (e) { console.warn("[rol-ata]", (e as Error)?.message || e); }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(300)} style={[styles.sheet, tab === 1 ? styles.sheetFull : styles.sheetFit]}>
          <Pressable style={tab === 1 ? { flex: 1 } : undefined}>
            <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(22,19,32,0.88)", "rgba(11,10,16,0.94)"]} deg={170} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.handle} />

            <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
              <View style={styles.idCard}>
                <View style={styles.idThumb}>
                  {roomPhoto ? <Image source={{ uri: roomPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Txt weight="extrabold" size={15} color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>{roomName}</Txt>
                    {locked && <Icon name="lock" size={13} color={C.gold} />}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                    <Txt weight="semibold" size={11} color={C.dim}>ID:{room.id}</Txt>
                    <Icon name="copy" size={12} color={C.dim2} />
                  </View>
                </View>
                {canManage && (
                  <Pressable onPress={onManage} hitSlop={8} style={styles.gearBtn}>
                    <Icon name="gear" size={16} color={C.gold} />
                  </Pressable>
                )}
                <Pressable onPress={onReport} hitSlop={8} style={styles.reportIconBtn}>
                  <Icon name="warn" size={16} color="rgba(255,255,255,.5)" />
                </Pressable>
              </View>
            </View>

            <View style={styles.headerRow}>
              <View style={styles.tabbar}>
                {["Profil", "Üyeler", "Sıra"].map((t, i) => (
                  <Pressable key={t} onPress={() => setTab(i)} style={styles.tabBtn}>
                    <Txt weight={i === tab ? "extrabold" : "medium"} size={15} color={i === tab ? "#fff" : "rgba(255,255,255,.42)"}>{t}</Txt>
                    {i === tab && <Gradient colors={[C.gold, "#C8922B"]} deg={90} style={styles.tabUnderline} />}
                  </Pressable>
                ))}
              </View>
            </View>

            {tab === 0 ? (
              <View style={{ padding: 18, paddingBottom: 14 }}>
                <View style={[styles.levelHeader, { paddingTop: 0 }]}>
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

                <View style={styles.infoGroup}>
                  <InfoRow label="Üyeler" right={String(memberCount)} />
                  <View style={styles.infoDivider} />
                  <InfoRow label="Dil" right="Türkçe" />
                  <View style={styles.infoDivider} />
                  <InfoRow label="Ülke" right="🇹🇷 Türkiye" />
                  <View style={styles.infoDivider} />
                  <InfoRow label="Etiket" right={room.official ? "Resmî" : "Sohbet"} />
                  <View style={styles.infoDivider} />
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Txt weight="semibold" size={13.5} color={C.dim}>Duyuru</Txt>
                    <View style={{ flex: 1 }} />
                    <Txt weight="semibold" size={12.5} color={C.text} align="right" lh={1.5} style={{ maxWidth: "58%", fontStyle: "italic" }}>
                      {announce || (room.official ? "Aron'a hoş geldin, keyifli sohbetler!" : "Herkes davetli, saygıyı koru 🌙")}
                    </Txt>
                  </View>
                </View>
              </View>
            ) : tab === 1 ? (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                  <Txt weight="bold" size={13} color={C.dim}>
                    Üyeler: <Txt weight="bold" size={13} color={C.gold2}>{live ? dbMembers.length : members.length}</Txt>
                    <Txt weight="bold" size={13} color={C.dim2}>/1000</Txt>
                  </Txt>
                </View>
                <View style={styles.searchRow}>
                  <Icon name="search" size={15} color={C.dim2} />
                  <Txt size={12.5} color={C.dim2}>Kullanıcı adı veya numarası ara</Txt>
                </View>

                {live ? (
                  dbMembers.length === 0 ? (
                    <Txt size={12} color={C.dim} align="center" style={{ paddingVertical: 40 }}>Henüz üye yok. İlk katılan sen ol!</Txt>
                  ) : (
                    dbMembers.map((m, i) => {
                      const isOpen = expanded === i;
                      const canEdit =
                        m.rol !== "sahip" &&
                        (myRole === "sahip" || canManage || (myRole === "yardimci" && m.rol === "uye"));
                      const roleColor = m.rol === "sahip" ? C.gold2 : m.rol === "yardimci" ? C.purple2 : C.dim;
                      const roleLabel = m.rol === "sahip" ? "Sahip" : m.rol === "yardimci" ? "Yardımcı" : null;
                      return (
                        <View key={m.id}>
                          <Pressable onPress={canEdit ? () => setExpanded(isOpen ? null : i) : undefined} style={styles.memberRow}>
                            <Portrait name={m.name} size={46} photo={m.photo} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <Txt weight="extrabold" size={13.5} color={m.rol === "sahip" ? C.gold2 : C.text}>{m.name}</Txt>
                                {roleLabel && (
                                  <View style={{ borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7, backgroundColor: (m.rol === "sahip" ? C.gold : C.purple2) + "1F", borderWidth: 1, borderColor: (m.rol === "sahip" ? C.gold : C.purple2) + "44" }}>
                                    <Txt weight="extrabold" size={9} color={roleColor}>{roleLabel}</Txt>
                                  </View>
                                )}
                              </View>
                              <Txt size={10.5} color={C.dim2} style={{ marginTop: 2 }}>ID: {m.publicId}</Txt>
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
                              <RoleBtn icon="trash" color="#FB7185" label="Çıkar" onPress={() => liveKick(m)} />
                              {(myRole === "sahip" || canManage) && (
                                <>
                                  <RoleBtn icon="user" color={C.gold2} label="Üye Yap" dim={m.rol === "uye"} onPress={() => liveSetRole(m, "uye")} />
                                  <RoleBtn icon="crown" color="#5EEAD4" label="Yardımcı Yap" dim={m.rol === "yardimci"} onPress={() => liveSetRole(m, "yardimci")} />
                                </>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )
                ) : (
                  members.map((m, i) => {
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
                  })
                )}
              </ScrollView>
            ) : (
              <View style={{ padding: 18, paddingTop: 40, alignItems: "center" }}>
                <View style={styles.queueIcon}>
                  <Icon name="mic" size={24} color={C.gold} />
                </View>
                <Txt weight="displayBold" size={15} color="#fff" style={{ marginTop: 14 }}>Mikrofon Sırası</Txt>
                <Txt size={12} color={C.dim} align="center" lh={1.5} style={{ marginTop: 8, maxWidth: 260 }}>
                  Mikrofona çıkmak isteyenler yakında burada sıraya girebilecek.
                </Txt>
              </View>
            )}

            <View style={[styles.footerRow, { paddingBottom: 12 + insets.bottom }]}>
              <Pressable onPress={toggleJoin} disabled={busy} style={{ flex: 1, borderRadius: 14, overflow: "hidden", opacity: busy ? 0.6 : 1 }}>
                {isMember ? (
                  <View style={[styles.actBtn, { borderWidth: 1.5, borderColor: C.green + "55", backgroundColor: C.green + "14" }]}>
                    <Icon name="check" size={16} sw={2.5} color="#6EE7B7" />
                    <Txt weight="extrabold" size={13.5} color="#6EE7B7">{myRole === "sahip" ? "Sahibisin" : "Katıldın"}</Txt>
                  </View>
                ) : (
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.actBtn}>
                    <Icon name="plus" size={16} sw={2.5} color="#241A05" />
                    <Txt weight="extrabold" size={13.5} color="#241A05">Katıl</Txt>
                  </Gradient>
                )}
              </Pressable>
              <Pressable onPress={() => setFollowing((f) => !f)} style={[styles.actBtn, { flex: 1, borderWidth: 1.5, borderColor: following ? C.gold : "rgba(255,255,255,.14)", backgroundColor: following ? C.gold + "12" : "rgba(255,255,255,.05)" }]}>
                <Icon name={following ? "check" : "heart"} size={16} sw={following ? 2.5 : 1.7} color={following ? C.gold2 : C.text} />
                <Txt weight="extrabold" size={13.5} color={following ? C.gold2 : C.text}>{following ? "Takiptesin" : "Takip Et"}</Txt>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.55)" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.18)", backgroundColor: "rgba(14,12,20,0.6)" },
  sheetFit: { maxHeight: "90%" },
  sheetFull: { height: "86%" },
  handle: { width: 38, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.2)", alignSelf: "center", marginTop: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)", paddingHorizontal: 8, marginTop: 6 },
  tabbar: { flex: 1, flexDirection: "row" },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabUnderline: { position: "absolute", bottom: -1, width: 28, height: 3, borderRadius: 3 },
  gearBtn: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "14", borderWidth: 1, borderColor: C.gold + "44" },
  footerRow: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingHorizontal: 18, paddingTop: 12 },
  queueIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "44" },
  idCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", marginBottom: 4 },
  reportIconBtn: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.06)" },
  actBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 14 },
  idThumb: { width: 68, height: 68, borderRadius: 14, overflow: "hidden" },
  levelHeader: { flexDirection: "row", alignItems: "center", paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)" },
  levelTrack: { height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.08)", marginVertical: 8, overflow: "hidden" },
  levelBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", marginBottom: 4 },
  infoGroup: { borderRadius: 16, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", paddingHorizontal: 14, marginTop: 4 },
  infoDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", marginBottom: 14 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  memberArrow: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  manageActions: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  roleIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
