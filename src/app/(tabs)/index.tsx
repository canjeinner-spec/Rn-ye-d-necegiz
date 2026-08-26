import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Fragment, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { EventBanners } from "@/components/EventBanners";
import { Scene } from "@/components/Scene";
import { Screen } from "@/components/Screen";
import { Tabs } from "@/components/Tabs";
import { TopBar } from "@/components/TopBar";
import { Txt } from "@/components/Txt";
import { PEOPLE } from "@/data/people";
import { listRooms } from "@/data/remote/roomsRepo";
import { useCachedResource } from "@/lib/cache";
import { ROOMS, type Room } from "@/data/seed";
import { RoomPasswordGate } from "@/sheets/RoomPasswordGate";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { Ui } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { I, R, S, T } from "@/theme/tokens";

/**
 * Oda listesi satırı — WePlay `wejoy_voice_room_list_item` ölçüleri:
 * 84dp satır, 64dp kapak (r16), isim 16dp, kişi sayısı 12dp (8dp altında),
 * kilit rozeti kapağın sağ-alt köşesinde, sağda giriş butonu.
 */
function RoomRow({ room, onPress }: { room: Room; onPress: () => void }) {
  const coverUri = room.photo || PEOPLE[room.host]?.photo;
  const label = room.official ? "Resmî" : room.daily != null ? `TOP ${room.daily}` : null;
  const labelBg = room.official ? Ui.accentSoft : "#FFF1DC";
  const labelFg = room.official ? Ui.accentPressed : "#B7791F";

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,.06)" }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: Ui.surfaceAlt }]}
    >
      <View style={styles.cover}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Scene kind={room.scene} />
        )}
        {room.locked && (
          <View style={styles.lockTag}>
            <Icon name="lock" size={10} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.nameLine}>
          {!!label && (
            <View style={[styles.label, { backgroundColor: labelBg }]}>
              <Txt weight="extrabold" size={T.small} color={labelFg}>
                {label}
              </Txt>
            </View>
          )}
          <Txt weight="bold" size={T.title} color={Ui.textHeading} numberOfLines={1} style={{ flexShrink: 1 }}>
            {room.name}
          </Txt>
        </View>
        <View style={styles.metaLine}>
          <Txt size={T.body} color={Ui.gray500} numberOfLines={1}>
            {room.online} kişi
          </Txt>
          {room.live && (
            <>
              <View style={styles.liveDot} />
              <Txt weight="semibold" size={T.body} color={Ui.live}>
                Canlı
              </Txt>
            </>
          )}
        </View>
      </View>

      {/* WePlay: 60x28, r4, #74BFFF -> #4293FF dikey gradyan, beyaz ortalı yazı.
          Satırın tamamı basılabilir olduğu için buton görsel — dokunuş üste iletilir. */}
      <Gradient colors={["#74BFFF", "#4293FF"]} deg={180} style={styles.enterBtn}>
        <Txt weight="semibold" size={T.text} color="#FFFFFF">
          Gir
        </Txt>
      </Gradient>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const enterRoom = useApp((s) => s.enterRoom);
  const role = useApp((s) => s.role);
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
  const rooms = [...dbRooms, ...ROOMS.filter((r) => !dbIds.has(r.id))];

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
    <Screen edges={["top"]}>
      <TopBar
        big
        title="Aron Chat"
        right={
          <Pressable onPress={() => router.navigate("/preview")} hitSlop={8}>
            <Icon name="search" size={I.lg} color={Ui.textTitle} />
          </Pressable>
        }
      />

      <Tabs items={["Keşfet", "Popüler", "Yakında", "Takip Edilen"]} active={tab} set={setTab} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <EventBanners />
        <View style={styles.list}>
          {rooms.map((r, i) => (
            <Fragment key={r.id}>
              {i > 0 && <View style={styles.divider} />}
              <RoomRow room={r} onPress={() => onRoomPress(r)} />
            </Fragment>
          ))}
        </View>
      </ScrollView>

      {gateRoom && (
        <RoomPasswordGate
          room={gateRoom}
          onClose={() => setGateRoom(null)}
          onPass={() => { const r = gateRoom; setGateRoom(null); enterAndGo(r); }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Beyaz blok — gri sayfa zemininin üstünde */
  list: { backgroundColor: Ui.surface, marginTop: 10 },
  /** Ayırıcı metnin hizasından başlar: 20 (kapak sol) + 64 (kapak) + 10 */
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Ui.border, marginLeft: 94 },
  /** WePlay: 84dp satır, kapak soldan 20, buton sağdan 16 */
  row: {
    height: 84,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: S.xl,
    paddingRight: S.lg,
    backgroundColor: Ui.surface,
  },
  /** WePlay: 64dp kapak, 16dp yarıçap */
  cover: { width: 64, height: 64, borderRadius: R.lg, overflow: "hidden", backgroundColor: Ui.surfaceAlt },
  lockTag: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    borderTopLeftRadius: R.sm,
    backgroundColor: "rgba(0,0,0,.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  /** Kapaktan 10, butondan 8 boşluk (WePlay) */
  info: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: S.sm },
  /** WePlay: 60x28, yarıçap 4 */
  enterBtn: { width: 60, height: 28, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  nameLine: { flexDirection: "row", alignItems: "center", gap: S.xs },
  /** WePlay: 18dp yüksek etiket çipi, yatay 4dp iç boşluk */
  label: { height: 18, minWidth: 30, paddingHorizontal: S.xs, borderRadius: R.sm, alignItems: "center", justifyContent: "center" },
  /** İsim ile kişi sayısı arası 8dp */
  metaLine: { flexDirection: "row", alignItems: "center", gap: S.sm, marginTop: S.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Ui.live },
});
