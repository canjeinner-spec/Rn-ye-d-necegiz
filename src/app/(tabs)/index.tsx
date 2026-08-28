import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Eq } from "@/components/Eq";
import { EventBanners } from "@/components/EventBanners";
import { Portrait } from "@/components/Portrait";
import { RoomBadges } from "@/components/RoomBadges";
import { RoomCrest, RoomTopTag, type RoomTier } from "@/components/RoomTopTag";
import { Scene } from "@/components/Scene";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { PEOPLE } from "@/data/people";
import { getMyBannedRoomIds, listRooms } from "@/data/remote/roomsRepo";
import { useCachedResource } from "@/lib/cache";
import { ROOMS, type Room } from "@/data/seed";
import { RoomPasswordGate } from "@/sheets/RoomPasswordGate";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * Liste sırası — her sekmede aynı kural geçerli:
 *   1) Resmî odalar en üstte
 *   2) Sonra Daily Top odalar, sırasıyla (Top1, Top2, …)
 *   3) Sonra normal odalar
 * Aynı katman içinde sekmenin kendi ölçütü uygulanır (varsayılan: kalabalık).
 */
/** "Yeni" sekmesi bu kadar gün içinde kurulmuş odaları gösterir. */
const YENI_ODA_GUN = 7;

function katman(r: Room) {
  if (r.official) return 0;
  if (r.daily != null) return 1;
  return 2;
}

function sirala(list: Room[], ikincil: (a: Room, b: Room) => number = (a, b) => b.online - a.online) {
  return [...list].sort((a, b) => {
    const k = katman(a) - katman(b);
    if (k !== 0) return k;
    // Daily katmanında sıra numarası belirler: Top1 önce.
    if (a.daily != null && b.daily != null && a.daily !== b.daily) return a.daily - b.daily;
    return ikincil(a, b);
  });
}

function RoomRow({ room, onPress }: { room: Room; onPress: () => void }) {
  const friendAvatars = room.crowd.slice(0, 3);
  const coverUri = room.photo || PEOPLE[room.host]?.photo;
  const tier: RoomTier | null = room.official ? "official" : room.daily != null ? "daily" : null;
  // Resmî/Daily kartlar mavi-mor gradyandı, temadan kopuktu; ikisi de artık
  // altın tonlu, resmî biraz daha sıcak.
  const tierBg = tier === "daily" ? (["#2E2410", "#191308"] as const) : (["#33280F", "#1B1508"] as const);

  return (
    <Pressable onPress={onPress} style={[styles.row, tier && styles.rowSpecial]}>
      {tier && <Gradient colors={tierBg} deg={135} style={StyleSheet.absoluteFill} pointerEvents="none" />}
      {tier && (
        <View style={styles.crest} pointerEvents="none">
          <RoomCrest kind={tier} />
        </View>
      )}
      {tier && <RoomTopTag kind={tier} rank={room.daily ?? 1} />}

      <View style={styles.cover}>
        {coverUri ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
        {room.locked && (
          <View style={styles.lockTag}>
            <Icon name="lock" size={10} color="#fff" />
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 5, marginRight: tier ? 6 : 0 }}>
        <Txt weight="extrabold" size={14} color="#fff" numberOfLines={1}>
          {room.name}
        </Txt>
        {/* Eskiden bu satır "Arkadaşlar" diyordu ama gösterdiği kişiler
            odadakilerdi, arkadaşların değil. Üstelik gerçek odalarda crowd
            boş geldiği için etiket boşlukta duruyordu. Artık oda sahibi
            yazıyor; odadakilerin yüzleri varsa yanında gösteriliyor. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="crown" size={11} color={C.gold + "AA"} />
          <Txt weight="semibold" size={10.5} color={C.dim} numberOfLines={1} style={{ flexShrink: 1 }}>{room.host}</Txt>
          {friendAvatars.length > 0 && (
            <View style={{ flexDirection: "row", marginLeft: 2 }}>
              {friendAvatars.map((n, i) => (
                <View key={n} style={{ marginLeft: i ? -7 : 0, borderRadius: 11, borderWidth: 1.5, borderColor: "#15121C" }}>
                  <Portrait name={n} size={18} />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={{ minWidth: tier ? 84 : undefined, alignItems: "flex-end", justifyContent: tier ? "flex-end" : "space-between", alignSelf: "stretch" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {room.badges && <RoomBadges badges={room.badges} size={22} />}
          {/* Canlı rozeti mordu; yeşil daha okunur ve "yayında" hissini verir. */}
          {!tier && (room.live ? (
            <View style={[styles.livePill, { backgroundColor: C.green + "1F", borderWidth: 1, borderColor: C.green + "4D" }]}>
              <View style={[styles.liveDot, { backgroundColor: "#6EE7B7" }]} />
              <Txt weight="extrabold" size={10} color="#6EE7B7">Canlı</Txt>
            </View>
          ) : (
            <View style={[styles.livePill, { backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" }]}>
              <Txt weight="extrabold" size={10} color={C.dim2}>Sessiz</Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
          <Icon name="user" size={12} color={C.dim2} />
          <Txt weight="bold" size={10.5} color={C.dim}>{room.online}</Txt>
          {room.live && <Eq color="#F59E0B" />}
        </View>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const enterRoom = useApp((s) => s.enterRoom);
  const role = useApp((s) => s.role);
  const session = useApp((s) => s.session);
  const privileged = role !== "user";
  const [tab, setTab] = useState(0);
  const [gateRoom, setGateRoom] = useState<Room | null>(null);

  // Cache-first: son oda listesini ANINDA göster (persist → soğuk açılışta bile),
  // arkada tazele. useFocusEffect revalidate cache hook'unun içinde.
  const { data: dbRooms = [] } = useCachedResource<Room[]>(
    "rooms:list",
    () => listRooms(),
    { persist: true, enabled: isSupabaseConfigured },
  );

  // DB odaları üstte; mock odalar (MVP'de ekranı canlı tutar) altta. Aynı ID tekrarını ele.
  const dbIds = new Set(dbRooms.map((r) => r.id));
  const tumOdalar = [...dbRooms, ...ROOMS.filter((r) => !dbIds.has(r.id))];

  // Yasaklandığım odalar — listede hiç görünmemeli.
  const { data: yasakliOdaIds } = useCachedResource<number[]>(
    "rooms:banned", () => getMyBannedRoomIds(), { persist: true, enabled: isSupabaseConfigured && !!session },
  );

  /**
   * GÖRÜNÜRLÜK KURALI — her sekmede, istisnasız geçerli. Listede yeri
   * olmayan odalar:
   *   • gizli/kilitli   — zaten "listede görünmez" sözüyle kilitleniyor
   *   • yasaklandığım   — giremeyeceğim odayı listelemenin anlamı yok
   *   • işlem görmüş    — yönetim işlemi olan oda tanıtılmaz (054)
   *   • boş             — içinde kimse olmayan odaya sokmanın faydası yok
   * (Silinmiş odalar zaten sunucuda RLS ile eleniyor.)
   *
   * Kendi odam için istisna YOK: sahip odasına profildeki "Odam"
   * bölümünden giriyor, listeye boş oda düşürmeye gerek kalmıyor.
   */
  const gorunur = useMemo(() => {
    const yasak = new Set(yasakliOdaIds ?? []);
    return tumOdalar.filter((r) => {
      if (r.locked) return false;
      if (r.islemGordu) return false;
      if (r.dbId != null && yasak.has(r.dbId)) return false;
      return r.online > 0;
    });
  }, [dbRooms, yasakliOdaIds]);

  // Sekmeler daha önce hiçbir şey yapmıyordu: dördü de aynı listeyi
  // gösteriyordu (tab state'i yalnızca çubuğu boyuyordu).
  const rooms = useMemo(() => {
    switch (tab) {
      case 1: // Popüler — en kalabalıktan seyreğe
        return sirala(gorunur);
      case 2: {
        // Yeni — yalnızca YENİ KURULMUŞ NORMAL odalar. Resmî ve Daily Top
        // odalar buraya girmez (onların kendi yeri var); sıralama kuruluş
        // tarihine göre değil, etkileşime (kalabalığa) göre.
        const esik = Date.now() - YENI_ODA_GUN * 24 * 60 * 60 * 1000;
        return gorunur
          .filter((r) => !r.official && r.daily == null && (r.createdAt ?? 0) >= esik)
          .sort((a, b) => b.online - a.online);
      }
      case 3: // Resmî — yalnızca resmî odalar
        return sirala(gorunur.filter((r) => r.official));
      default:
        return sirala(gorunur);
    }
  }, [tab, gorunur]);

  const enterAndGo = (room: Room) => {
    haptic.light();
    enterRoom(room);
    router.navigate("/room");
  };
  const onRoomPress = (room: Room) => {
    haptic.light();
    // developer / süper admin kilitli odaya şifresiz girer
    if (room.locked && !privileged) setGateRoom(room);
    else enterAndGo(room);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <View style={{ width: 38 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Txt weight="displayBold" size={19} color="#fff" style={{ letterSpacing: 2 }}>ARON</Txt>
            <Txt weight="displayBold" size={19} color={C.gold} style={{ letterSpacing: 2 }}>CHAT</Txt>
          </View>
          <Pressable onPress={() => router.navigate("/preview")} hitSlop={8} style={styles.roundBtn}>
            <Icon name="search" size={19} color={C.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <EventBanners />
          {/* Sekmeler banner'ın ÜSTÜNDEYDİ; artık banner ile oda listesinin
              arasında, yani filtrelediği listenin hemen başında duruyor. */}
          <Tabs items={["Keşfet", "Popüler", "Yeni", "Resmî"]} active={tab} set={setTab} pad={14} />
          <View style={{ paddingHorizontal: 12, paddingTop: 14, gap: 10 }}>
            {rooms.length > 0 ? (
              rooms.map((r) => <RoomRow key={r.id} room={r} onPress={() => onRoomPress(r)} />)
            ) : (
              /* Sekmeler artık gerçekten filtreliyor → sonuç boş olabilir */
              <View style={styles.bos}>
                <View style={styles.bosIkon}>
                  <Icon name="mic" size={20} color={C.gold} />
                </View>
                <Txt weight="displayBold" size={14} color="#fff" style={{ marginTop: 12 }}>
                  {tab === 3 ? "Şu an açık resmî oda yok" : tab === 2 ? "Yeni açılan oda yok" : "Şu an açık oda yok"}
                </Txt>
                <Txt size={11.5} color={C.dim} align="center" lh={1.5} style={{ marginTop: 6, maxWidth: 250 }}>
                  {tab === 3
                    ? "Resmî odalar açıldığında burada listelenir."
                    : tab === 2
                      ? `Son ${YENI_ODA_GUN} günde açılmış aktif bir oda yok.`
                      : "Boş, kilitli, yasaklı ve işlem görmüş odalar listelenmez. Sen bir oda açarak başlayabilirsin."}
                </Txt>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {gateRoom && (
        <RoomPasswordGate
          room={gateRoom}
          onClose={() => setGateRoom(null)}
          onPass={() => { const r = gateRoom; setGateRoom(null); enterAndGo(r); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  roundBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: "rgba(28,22,40,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.06)",
  },
  rowSpecial: { overflow: "hidden", borderColor: "rgba(255,255,255,.12)" },
  // Arma 124px'ti ve top:-22 ile kartın dışına taşıyordu; kartta
  // overflow:"hidden" olduğu için üst kısmı kesiliyordu. Artık kartın içinde.
  crest: { position: "absolute", right: 2, top: 0, bottom: 0, justifyContent: "center", opacity: 0.85 },
  cover: { width: 62, height: 62, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  lockTag: { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" },
  bos: { alignItems: "center", paddingVertical: 44, paddingHorizontal: 18 },
  bosIkon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "3D" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
});
