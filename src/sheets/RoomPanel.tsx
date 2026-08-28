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
};

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

/** Kapağın altındaki üçlü sayı şeridi — kutu içinde kutu olmasın diye düz. */
function Stat({ deger, etiket, renk }: { deger: string; etiket: string; renk?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}>
      <Txt weight="displayBold" size={16} color={renk ?? "#fff"}>{deger}</Txt>
      <Txt weight="semibold" size={9} color={C.dim2} style={{ marginTop: 2, letterSpacing: 0.3 }}>{etiket}</Txt>
    </View>
  );
}

/**
 * Oda profili — üst bardaki oda çipinden açılır.
 *
 * Eskiden: sayfanın içinde bir "oda kimlik kartı" kutusu, altında iki sekme,
 * sekmenin içinde yine kutular (level kutusu, bilgi kutusu) vardı — kutu
 * içinde kutu içinde kutu. Üstelik Profil sekmesindeki verinin neredeyse
 * tamamı sahteydi: her odada LV.29, 13.490/15.000, "Dil: Türkçe",
 * "Ülke: Türkiye" yazıyordu; Room tipinde bu alanların hiçbiri yok.
 *
 * Şimdi: tek akan sayfa. Kapak fotoğrafı sayfanın tepesini tam kaplıyor
 * (kart değil), üstünde odanın adı/ID'si; altında yalnızca gerçek sayılar,
 * varsa duyuru, sahip ve üye listesi.
 */
export function RoomPanel(props: Props) {
  const { room, roomName, roomPhoto, announce, locked, memberCount, canManage, onManage, onReport, onStats, onClose } = props;
  const insets = useSafeAreaInsets();
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

  const uyeSayisi = live ? dbMembers.length : members.length;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
          <Pressable style={{ flex: 1 }}>
            <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(24,21,34,0.62)", "rgba(11,10,16,0.80)"]} deg={170} style={StyleSheet.absoluteFill} pointerEvents="none" />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              {/* ---- Kapak: sayfanın tepesini tam kaplar, kart değil ---- */}
              <View style={styles.kapak}>
                {roomPhoto
                  ? <Image source={{ uri: roomPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  : <Scene kind={room.scene} />}
                <Gradient
                  colors={["rgba(10,9,14,.15)", "rgba(10,9,14,.55)", "rgba(10,9,14,.94)"]}
                  deg={180}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.handle} />

                {/* Yönet / raporla — kapağın üstünde yüzen cam düğmeler */}
                <View style={styles.kapakAksiyon}>
                  {canManage && (
                    <Pressable onPress={onManage} hitSlop={6} style={[styles.camBtn, { borderColor: C.gold + "55", backgroundColor: C.gold + "22" }]}>
                      <Icon name="gear" size={16} color={C.gold2} />
                    </Pressable>
                  )}
                  <Pressable onPress={onReport} hitSlop={6} style={styles.camBtn}>
                    <Icon name="warn" size={16} color="rgba(255,255,255,.75)" />
                  </Pressable>
                  <Pressable onPress={onClose} hitSlop={6} style={styles.camBtn}>
                    <Icon name="x" size={15} color="rgba(255,255,255,.75)" />
                  </Pressable>
                </View>

                {/* Ad + ID, kapağın alt kenarında */}
                <View style={styles.kapakYazi}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Txt weight="displayBold" size={19} color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>{roomName}</Txt>
                    {locked && <Icon name="lock" size={14} color={C.gold} />}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>
                    <Txt weight="semibold" size={11} color="rgba(255,255,255,.62)">ID: {room.id}</Txt>
                    <Icon name="copy" size={11} color="rgba(255,255,255,.45)" />
                  </View>
                </View>
              </View>

              {/* ---- Sayılar: yalnızca gerçekten bilinenler ---- */}
              <View style={styles.statSerit}>
                <Stat deger={String(memberCount)} etiket="ODADA" renk="#6EE7B7" />
                <View style={styles.statAyirici} />
                <Stat deger={String(uyeSayisi)} etiket="ÜYE" />
                <View style={styles.statAyirici} />
                <Stat deger={room.official ? "Resmî" : "Sohbet"} etiket="ETİKET" renk={room.official ? C.gold2 : undefined} />
              </View>

              <View style={{ paddingHorizontal: 18 }}>
                {/* ---- Duyuru — yoksa hiç yer kaplamaz ---- */}
                {!!announce && (
                  <View style={styles.duyuru}>
                    <Icon name="mega" size={13} color={C.gold2} />
                    <Txt size={12} color={C.text} lh={1.5} style={{ flex: 1, fontStyle: "italic" }}>{announce}</Txt>
                  </View>
                )}

                {/* ---- Sahip + oda istatistikleri ---- */}
                <View style={styles.satirGrup}>
                  <View style={styles.satir}>
                    <Portrait name={room.host} size={34} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="semibold" size={10} color={C.dim2}>ODA SAHİBİ</Txt>
                      <Txt weight="extrabold" size={13} color={C.gold2} numberOfLines={1} style={{ marginTop: 1 }}>{room.host}</Txt>
                    </View>
                  </View>
                  <View style={styles.satirAyirici} />
                  <Pressable onPress={onStats} style={styles.satir}>
                    <View style={styles.satirIkon}>
                      <Icon name="bars" size={15} color={C.teal} />
                    </View>
                    <Txt weight="bold" size={12.5} color={C.text} style={{ flex: 1 }}>Oda İstatistikleri</Txt>
                    <Icon name="chev" size={14} color={C.dim2} />
                  </Pressable>
                </View>

                {/* ---- Üyeler ---- */}
                <View style={styles.bolum}>
                  <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5 }}>ÜYELER</Txt>
                  <View style={styles.sayiPill}>
                    <Txt weight="extrabold" size={9.5} color={C.gold2}>{uyeSayisi}</Txt>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Txt weight="semibold" size={10} color={C.dim2}>/1000</Txt>
                </View>

                {live ? (
                  dbMembers.length === 0 ? (
                    <Txt size={12} color={C.dim} align="center" style={{ paddingVertical: 26 }}>Henüz üye yok. İlk katılan sen ol!</Txt>
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
                            <Portrait name={m.name} size={42} photo={m.photo} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <Txt weight="extrabold" size={13} color={m.rol === "sahip" ? C.gold2 : C.text}>{m.name}</Txt>
                                {roleLabel && (
                                  <View style={{ borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7, backgroundColor: (m.rol === "sahip" ? C.gold : C.purple2) + "1F", borderWidth: 1, borderColor: (m.rol === "sahip" ? C.gold : C.purple2) + "44" }}>
                                    <Txt weight="extrabold" size={9} color={roleColor}>{roleLabel}</Txt>
                                  </View>
                                )}
                              </View>
                              <Txt size={10.5} color={C.dim2} style={{ marginTop: 2 }}>ID: {m.publicId}</Txt>
                            </View>
                            {canEdit && (
                              <View style={[styles.memberArrow, { backgroundColor: isOpen ? "rgba(245,206,110,.15)" : "rgba(255,255,255,.05)", borderColor: isOpen ? C.gold + "44" : "rgba(255,255,255,.1)" }]}>
                                <Icon name="chev" size={15} color={isOpen ? C.gold2 : C.dim} />
                              </View>
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
                          <Portrait name={m.name} size={42} online={m.active} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Txt weight="extrabold" size={13} color={m.role === "host" ? C.gold2 : C.text}>{m.name}</Txt>
                              {roleLabel && (
                                <View style={{ borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7, backgroundColor: (m.role === "host" ? C.gold : C.purple2) + "1F", borderWidth: 1, borderColor: (m.role === "host" ? C.gold : C.purple2) + "44" }}>
                                  <Txt weight="extrabold" size={9} color={roleColor}>{roleLabel}</Txt>
                                </View>
                              )}
                            </View>
                            <Txt size={10.5} color={C.dim2} style={{ marginTop: 2 }}>{m.active ? "Bugün" : "1 gün önce"} aktifti</Txt>
                          </View>
                          {canEdit && (
                            <View style={[styles.memberArrow, { backgroundColor: isOpen ? "rgba(245,206,110,.15)" : "rgba(255,255,255,.05)", borderColor: isOpen ? C.gold + "44" : "rgba(255,255,255,.1)" }]}>
                              <Icon name="chev" size={15} color={isOpen ? C.gold2 : C.dim} />
                            </View>
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
              </View>
            </ScrollView>

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
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.42)" },
  sheet: { height: "84%", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.20)", backgroundColor: "rgba(14,12,20,.34)" },
  handle: { position: "absolute", top: 10, alignSelf: "center", width: 38, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.45)" },
  kapak: { height: 152, justifyContent: "flex-end", overflow: "hidden" },
  kapakAksiyon: { position: "absolute", top: 12, right: 14, flexDirection: "row", gap: 8 },
  camBtn: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,9,14,.45)", borderWidth: 1, borderColor: "rgba(255,255,255,.18)" },
  kapakYazi: { paddingHorizontal: 18, paddingBottom: 13 },
  statSerit: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,.10)" },
  statAyirici: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: "rgba(255,255,255,.12)" },
  duyuru: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 14, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, backgroundColor: C.gold + "0F", borderWidth: 1, borderColor: C.gold + "2E" },
  satirGrup: { marginTop: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", overflow: "hidden" },
  satir: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, paddingHorizontal: 13 },
  satirAyirici: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.09)", marginLeft: 58 },
  satirIkon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: `${C.teal}1A` },
  bolum: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 22, marginBottom: 4 },
  sayiPill: { minWidth: 18, paddingHorizontal: 6, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "24", borderWidth: 1, borderColor: C.gold + "47" },
  footerRow: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,.12)", paddingHorizontal: 18, paddingTop: 12 },
  actBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 14 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,.07)" },
  memberArrow: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  manageActions: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,.07)" },
  roleIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
