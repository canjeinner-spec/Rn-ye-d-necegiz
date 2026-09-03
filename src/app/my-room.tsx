import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Tabs } from "@/components/Tabs";
import { BosDurum } from "@/components/BosDurum";
import { Yukleniyor } from "@/components/Yukleniyor";
import { Txt } from "@/components/Txt";
import BOS_KUTU from "@/anim/bos-kutu.json";

import {
  katildigimOdalar,
  odaKisiSayilari,
  odaKisiSayilariniDinle,
  sonZiyaretEdilenOdalar,
  takipEttigimOdalar,
  type OdamOdasi,
} from "@/data/remote/roomsRepo";
import { PEOPLE } from "@/data/people";
import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

const TABS = ["Son günlerde", "Katıl", "Takip et"];

/**
 * Üç sekmenin üç ayrı gerçek kaynağı (055 + 021):
 *   0 Son günlerde → oda_ziyaretleri   (odaya her girişte yazılır)
 *   1 Katıl        → oda_uyeleri       (oda panelindeki "Katıl")
 *   2 Takip et     → oda_takip         (oda panelindeki "Takip Et")
 * Önceden üçü de ROOMS sabitinin farklı dilimleriydi.
 */
const YUKLEYICILER = [sonZiyaretEdilenOdalar, katildigimOdalar, takipEttigimOdalar];

const BOS_METIN = [
  "Henüz bir odaya girmedin. Girdiğin odalar burada birikir.",
  "Hiçbir odaya katılmadın. Bir odanın panelinden \"Katıl\" diyebilirsin.",
  "Takip ettiğin oda yok. Oda panelindeki \"Takip Et\" ile ekleyebilirsin.",
];

/** "az önce · 12 dk · 3 sa · 2 gün" — Son günlerde sekmesindeki zaman etiketi. */
function neZaman(ms?: number): string | null {
  if (!ms) return null;
  const fark = Math.max(0, Date.now() - ms);
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  const gun = Math.floor(sa / 24);
  return gun < 7 ? `${gun} gün önce` : `${Math.floor(gun / 7)} hafta önce`;
}

function RoomCard({ room, altYazi, onPress }: { room: OdamOdasi; altYazi?: string | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardThumb}>
        {(room.photo || PEOPLE[room.host]?.photo) ? <Image source={{ uri: room.photo || PEOPLE[room.host]?.photo || "" }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} /> : <Scene kind={room.scene} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Txt weight="extrabold" size={14} color={C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{room.name}</Txt>
          {room.locked && <Icon name="lock" size={12} color={C.dim2} />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 }}>
          {/* Gerçek odalarda crowd boş gelir (canlı koltuk verisi Faz 4);
              o zaman avatar dizisi yerine sahibin adı yazılır. */}
          {room.crowd.length > 0 ? (
            <View style={{ flexDirection: "row" }}>
              {room.crowd.slice(0, 4).map((n, i) => (
                <View key={n + i} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: 11, borderWidth: 2, borderColor: "#14131B" }}>
                  <Portrait name={n} size={22} />
                </View>
              ))}
            </View>
          ) : (
            <Txt weight="semibold" size={11} color={C.dim2} numberOfLines={1} style={{ flexShrink: 1 }}>@{room.host}</Txt>
          )}
          {altYazi && <Txt weight="semibold" size={11} color={C.dim2}>· {altYazi}</Txt>}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon path="M4 12h2M9 7v10M14 4v16M19 9v6" size={15} color={room.live ? C.green : C.dim2} />
        <Txt weight="extrabold" size={12} color={room.live ? C.green : C.dim2}>{room.online}</Txt>
      </View>
    </Pressable>
  );
}

export default function MyRoomHub() {
  const router = useRouter();
  const myRoom = useApp((s) => s.myRoom);
  const userName = useApp((s) => s.userName);
  const userPhoto = useApp((s) => s.userPhoto);
  const createMyRoom = useApp((s) => s.createMyRoom);
  const odayaGirDene = useApp((s) => s.odayaGirDene);
  const session = useApp((s) => s.session);
  const [tab, setTab] = useState(0);
  const [creating, setCreating] = useState(false);

  /**
   * "Odam" satırındaki kişi sayısı da presence'tan geliyor (karar 30 Ağustos).
   * Eskiden `myRoom.live` DB sayacını (`aktif_katilimci_sayisi`) okuyordu:
   * odanın İÇİNDEYKEN bile "Şu an boş" yazıyordu, çünkü sayacı ancak odadaki
   * en küçük uid'ye sahip istemci yazıyor. Oda listesiyle aynı kaynağı
   * kullanmak ikisinin çelişmesini de bitiriyor — bkz. 070 katılımcı tablosu.
   */
  const [canli, setCanli] = useState<{ sayilar: Map<number, number>; hazir: boolean }>({
    sayilar: new Map(),
    hazir: false,
  });
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let acik = true;
    const yukle = () =>
      odaKisiSayilari()
        .then((m) => { if (acik) setCanli({ sayilar: m, hazir: true }); })
        .catch((e) => console.warn("[oda-sayi] okunamadi:", (e as Error)?.message || e));
    yukle();
    const bitir = odaKisiSayilariniDinle(yukle);
    return () => { acik = false; bitir(); };
  }, []);
  // Oda listesiyle AYNI kural: iki kaynağın büyüğü. Presence bir odayı
  // ıskalarsa DB sayacı devreye giriyor, tersi de geçerli — tek kaynağa
  // indirgeme denemesi dolu odaları boş gösteriyordu.
  const odamPresence =
    myRoom?.dbId != null && canli.hazir ? canli.sayilar.get(myRoom.dbId) ?? 0 : 0;
  const odamSayi = Math.max(odamPresence, myRoom?.online ?? 0);

  /** Sekme başına liste; null = henüz yüklenmedi. */
  const [listeler, setListeler] = useState<(OdamOdasi[] | null)[]>([null, null, null]);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  /** Oda kurulamadıysa kullanıcıya SÖYLENİR — eskiden sessizce yutuluyordu. */
  const [odaHatasi, setOdaHatasi] = useState<string | null>(null);

  /**
   * `dbId`si olmayan oda veritabanında YOKTUR. Oturum varken böyle bir oda
   * elimizde kaldıysa, bu eski sessiz-hata düşüşünden kalma bir hayalet
   * demektir (bkz. appStore.createMyRoom): içine girilir ama kimse göremez.
   * Onu "odam" saymıyoruz; gerçeğini kurmayı/çekmeyi deniyoruz.
   */
  const odamGercek = !!myRoom && (myRoom.dbId != null || !isSupabaseConfigured || !session);
  const list = listeler[tab];

  const yukle = useCallback(async (i: number) => {
    if (!isSupabaseConfigured) {
      setListeler((l) => l.map((v, j) => (j === i ? [] : v)));
      return;
    }
    try {
      const sonuc = await YUKLEYICILER[i]();
      setListeler((l) => l.map((v, j) => (j === i ? sonuc : v)));
      setHata(null);
    } catch (e) {
      console.warn("[odam]", (e as Error)?.message || e);
      setListeler((l) => l.map((v, j) => (j === i ? [] : v)));
      setHata("Liste yüklenemedi. Bağlantını kontrol et.");
    }
  }, []);

  // Ekrana her dönüşte açık sekmeyi tazele: odadan çıkıp geldiğinde "Son
  // günlerde" listesinin en üstünde o oda olmalı.
  useFocusEffect(useCallback(() => { yukle(tab); }, [tab, yukle]));

  const yenile = async () => {
    setYenileniyor(true);
    await yukle(tab);
    setYenileniyor(false);
  };

  const enterMine = async () => {
    haptic.light();
    if (odamGercek && myRoom) {
      // Kendi odan da perdeden geçiyor: odaya işlem uygulandıysa (054) sahibi
      // de uyarıyı görmeli — düzenleme kapalı ve oda listelerde görünmüyor.
      odayaGirDene(myRoom);
      return;
    }
    if (creating) return;
    setCreating(true);
    setOdaHatasi(null);
    try {
      await createMyRoom();
      router.navigate("/room");
    } catch (e) {
      // Hata artık YUTULMUYOR. Sessiz düşüş, kullanıcıya gerçek gibi görünen
      // ama hiçbir listeye düşmeyen sahte oda üretiyordu.
      const mesaj = (e as Error)?.message || String(e);
      console.warn("[odam] oda kurulamadi:", mesaj);
      setOdaHatasi(`Oda kurulamadı: ${mesaj}`);
    } finally {
      setCreating(false);
    }
  };
  const openRoom = (r: Room) => {
    haptic.light();
    odayaGirDene(r);
  };

  return (
    <View style={styles.root}>
      {/* Ekran düz siyahtı ve içindeki kart mor gradyandı — uygulamanın
          geri kalanı siyah-altın. Diğer ekranlarla aynı zemin + altın hale. */}
      <Zemin />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={17} color="#fff">Odam</Txt>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={C.dim} />}
        >
          <Txt weight="bold" size={10} color={C.dim} style={{ marginBottom: 9, letterSpacing: 0.8 }}>ODAM</Txt>
          <Pressable onPress={enterMine} style={styles.mineCard}>
            <View style={styles.mineThumb}>
              {(myRoom?.photo || userPhoto) ? <Image source={{ uri: myRoom?.photo || userPhoto || "" }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} /> : <Scene kind="club" />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="extrabold" size={15} color="#fff" numberOfLines={1}>{odamGercek && myRoom ? myRoom.name : `${userName} Odası`}</Txt>
              {odamGercek && myRoom ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
                  <View style={styles.idHap}>
                    <Txt weight="bold" size={9.5} color={C.gold2}>ID {myRoom.id}</Txt>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={[styles.nokta, { backgroundColor: odamSayi > 0 ? C.green : C.dim2 }]} />
                    <Txt weight="semibold" size={10.5} color={C.dim}>{odamSayi > 0 ? `${odamSayi} kişi içeride` : "Şu an boş"}</Txt>
                  </View>
                </View>
              ) : (
                <Txt weight="semibold" size={11.5} color={C.dim} style={{ marginTop: 4 }}>Henüz odan yok — oluşturmak için dokun</Txt>
              )}
            </View>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.mineBtn}>
              <Txt weight="extrabold" size={12.5} color="#241A05">{odamGercek ? "Gir" : "Oluştur"}</Txt>
              <Icon name="chev" size={13} sw={2.2} color="#241A05" />
            </Gradient>
          </Pressable>

          {/* Oda kurulamadıysa SÖYLE. Eskiden hata yutulup dbId'siz sahte bir
              oda veriliyordu; kullanıcı odası varmış sanıyor, oda hiçbir
              listeye düşmüyordu. */}
          {odaHatasi && (
            <View style={styles.odaHata}>
              <Icon name="warn" size={13} color="#F59E0B" />
              <Txt size={11} weight="semibold" color="#F59E0B" style={{ flex: 1 }} lh={1.4}>
                {odaHatasi}
              </Txt>
            </View>
          )}

          {/* Elle çizilmiş yeşil çizgili sekmeler yerine ortak Tabs
              (kayan altın çizgi) — uygulamanın her yerindeki sekmelerle aynı. */}
          <View style={{ marginBottom: 14 }}>
            <Tabs items={TABS} active={tab} set={setTab} pad={0} />
          </View>

          {list === null ? (
            <Yukleniyor dolgu={30} boyut={110} />
          ) : list.length > 0 ? (
            list.map((r) => (
              <RoomCard
                key={r.id}
                room={r}
                altYazi={tab === 0 ? neZaman(r.sonZiyaret) : null}
                onPress={() => openRoom(r)}
              />
            ))
          ) : (
            <BosDurum anim={BOS_KUTU} dolgu={30} animBoyut={130} alt={hata ?? BOS_METIN[tab]} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  odaHata: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 10, backgroundColor: "rgba(245,158,11,.10)", borderWidth: 1, borderColor: "rgba(245,158,11,.32)" },
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  mineCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, marginBottom: 22, overflow: "hidden", backgroundColor: C.gold + "0F", borderWidth: 1, borderColor: C.gold + "3D" },
  mineThumb: { width: 66, height: 66, borderRadius: 17, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  mineBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999 },
  idHap: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "33" },
  nokta: { width: 6, height: 6, borderRadius: 3 },
  card: { flexDirection: "row", alignItems: "center", gap: 13, padding: 12, borderRadius: 18, marginBottom: 10, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  cardThumb: { width: 62, height: 62, borderRadius: 15, overflow: "hidden" },
});
