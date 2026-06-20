import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "@/components/Badge";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const ROOM_LV = 29;

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Txt weight="semibold" size={13} color={C.dim}>{label}</Txt>
      <View style={{ flex: 1 }} />
      <Txt weight="bold" size={13} color={valueColor || C.text}>{value}</Txt>
    </View>
  );
}

export function RoomPreview({ room, onClose, onJoin }: { room: Room; onClose: () => void; onJoin: () => void }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [following, setFollowing] = useState(false);
  const [q, setQ] = useState("");
  const members = (room.crowd || []).concat(["Melis", "Rüya", "Furkan", "Ender"]).filter((v, i, a) => a.indexOf(v) === i);
  const filtered = members.filter((m) => m.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
          <Pressable style={{ flex: 1 }}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(28,24,40,0.78)", "rgba(12,11,18,0.92)"]} deg={180} locations={[0, 0.4]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.handle} />

            <View style={styles.tabbar}>
              {["Profil", "Üyeler"].map((t, i) => (
                <Pressable key={t} onPress={() => setTab(i)} style={styles.tabBtn}>
                  <Txt weight={i === tab ? "extrabold" : "semibold"} size={14.5} color={i === tab ? "#fff" : C.dim}>{t}</Txt>
                  {i === tab && <Gradient colors={[C.gold, "#C8922B"]} deg={90} style={styles.tabUnderline} />}
                </Pressable>
              ))}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
              {tab === 0 ? (
                <>
                  <View style={styles.coverCard}>
                    <View style={styles.coverThumb}>
                      {room.photo ? <Image source={{ uri: room.photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="displayBold" size={16} color="#fff" numberOfLines={1}>{room.name}</Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
                        <Txt weight="semibold" size={11.5} color={C.dim}>ID: {room.id}</Txt>
                        <Icon name="copy" size={12} color={C.dim2} />
                      </View>
                    </View>
                    {room.official && (
                      <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.resmiTag}>
                        <Icon name="crown" size={10} color="#3A2A05" />
                        <Txt weight="extrabold" size={9} color="#3A2A05">RESMİ</Txt>
                      </Gradient>
                    )}
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <InfoRow label="Level" value={`LV.${ROOM_LV}`} valueColor="#5EEAD4" />
                    <InfoRow label="Üyeler" value={(room.online + (room.extra || 0)).toLocaleString("tr-TR")} />
                    <InfoRow label="Dil" value="Türkçe" />
                    <InfoRow label="Ülke" value="🇹🇷 Türkiye" />
                    <InfoRow label="Etiket" value={room.official ? "Resmî" : "Sohbet"} />
                    <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                      <Txt weight="semibold" size={13} color={C.dim}>Duyuru</Txt>
                      <View style={{ flex: 1 }} />
                      <Txt weight="semibold" size={12.5} color={C.text} align="right" style={{ maxWidth: "60%", fontStyle: "italic" }}>
                        {room.official ? "Aron'a hoş geldin, keyifli sohbetler!" : "Herkes davetli, saygıyı koru 🌙"}
                      </Txt>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Txt weight="bold" size={13} color={C.dim} style={{ marginBottom: 12 }}>
                    Üyeler: <Txt weight="bold" size={13} color={C.gold2}>{room.online}</Txt>
                    <Txt weight="bold" size={13} color={C.dim2}>/1000</Txt>
                  </Txt>
                  <View style={styles.search}>
                    <Icon name="search" size={16} color={C.dim2} />
                    <TextInput value={q} onChangeText={setQ} placeholder="Kullanıcı adı veya numarası ara" placeholderTextColor={C.dim2} style={styles.searchInput} />
                  </View>
                  {filtered.map((m, i) => {
                    const isHost = m === room.host;
                    return (
                      <View key={m + i} style={styles.memberRow}>
                        <Portrait name={m} size={46} online={i % 3 !== 0} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Txt weight="extrabold" size={13.5} color={isHost ? C.gold2 : C.text}>{m}</Txt>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Badge type="level" size={13} lvl={20 + i} />
                              <Txt weight="extrabold" size={10.5} color="#5EEAD4">LV.{20 + i}</Txt>
                            </View>
                            {isHost && <Badge type="vip" size={15} />}
                            {i % 2 === 0 && <Badge type="streamer" size={15} />}
                          </View>
                          <Txt size={10} color={C.dim2} style={{ marginTop: 2 }}>{i % 3 === 0 ? "Bugün" : "1 gün önce"} aktifti</Txt>
                        </View>
                        <Icon name="userAdd" size={17} color={isHost ? C.gold : C.dim} />
                      </View>
                    );
                  })}
                  {filtered.length === 0 && <Txt size={12.5} color={C.dim} align="center" style={{ paddingVertical: 40 }}>Kullanıcı bulunamadı.</Txt>}
                </>
              )}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
              <Pressable onPress={() => setFollowing((f) => !f)} style={[styles.followBtn, { borderColor: following ? C.gold : "rgba(255,255,255,.16)" }]}>
                <Icon name={following ? "check" : "heart"} size={16} sw={following ? 2.5 : 1.7} color={following ? C.gold2 : C.text} />
                <Txt weight="extrabold" size={14} color={following ? C.gold2 : C.text}>{following ? "Takiptesin" : "Takip Et"}</Txt>
              </Pressable>
              <Pressable onPress={onJoin} style={{ flex: 1.3, borderRadius: 16, overflow: "hidden" }}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.joinBtn}>
                  {room.locked && <Icon name="lock" size={15} color="#241A05" />}
                  <Txt weight="extrabold" size={14} color="#241A05">Katıl</Txt>
                </Gradient>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.5)" },
  sheet: { height: "82%", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.16)", backgroundColor: "rgba(14,12,20,0.6)" },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.22)", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  tabbar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)", paddingHorizontal: 6 },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabUnderline: { position: "absolute", bottom: -1, width: 34, height: 3, borderRadius: 3 },
  coverCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  coverThumb: { width: 72, height: 72, borderRadius: 16, overflow: "hidden" },
  resmiTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)" },
  search: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)", marginBottom: 14 },
  searchInput: { flex: 1, color: C.text, fontSize: 12.5, fontFamily: "PlusJakartaSans_500Medium" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  footer: { flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.08)" },
  followBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 15, borderRadius: 16, borderWidth: 1.5, backgroundColor: "rgba(255,255,255,.06)" },
  joinBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 15 },
});
