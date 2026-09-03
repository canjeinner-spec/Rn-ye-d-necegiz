import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BosDurum } from "@/components/BosDurum";
import { Eq } from "@/components/Eq";
import { EventBanners } from "@/components/EventBanners";
import { Portrait } from "@/components/Portrait";
import { RoomBadges } from "@/components/RoomBadges";
import { RoomCrest, RoomTopTag, type RoomTier } from "@/components/RoomTopTag";
import { Scene } from "@/components/Scene";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { PEOPLE } from "@/data/people";
import { getMyBannedRoomIds, listRooms, odaDegisiklikleriniDinle, odaKisiSayilari, odaKisiSayilariniDinle } from "@/data/remote/roomsRepo";
import { useCachedResource } from "@/lib/cache";
import { ROOMS, type Room } from "@/data/seed";
import { RoomPasswordGate } from "@/sheets/RoomPasswordGate";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
// Boş oda listesi animasyonu. Renkleri scripts/lottie-boya.js ile temaya
// boyandı (özgün dosya açık tema için siyah konturluydu, #08080C üstünde
// tamamen kayboluyordu).
import BOS_KUTU from "@/anim/bos-kutu.json";
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

      {/*
        DİZİLİM (WePlay oda listesi referans alındı, tema/renk DEĞİŞMEDİ):
        iki satır. Üstte oda adı + sağ üstte durum hapı, altta tek meta
        satırı ve onun sağında rozetler.

        Eskiden sağda AYRI BİR SÜTUN vardı ve içinde üç şey üst üste
        yarışıyordu: rozetler, canlı hapı, kişi sayısı. Dar bir şeritte üç
        farklı bilgi. Sayı meta satırına, durum hapı sağ üste taşındı;
        sağda yalnız rozetler kaldı — kendi çizdiğin 27 parçalık set artık
        kalabalıkta kaybolmuyor.
      */}
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {/* İsim satırı. Özel odalarda sağ üst köşeyi RoomTopTag kaplıyor,
            o yüzden ada sağdan pay bırakılıyor ve hap çizilmiyor. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt
            weight="extrabold"
            size={14}
            color="#fff"
            numberOfLines={1}
            style={{ flexShrink: 1, marginRight: tier ? 78 : 0 }}
          >
            {room.name}
          </Txt>
          {!tier && (
            <View style={{ marginLeft: "auto" }}>
              {room.live ? (
                <View style={[styles.livePill, { backgroundColor: C.green + "1F", borderWidth: 1, borderColor: C.green + "4D" }]}>
                  <View style={[styles.liveDot, { backgroundColor: "#6EE7B7" }]} />
                  <Txt weight="extrabold" size={10} color="#6EE7B7">Canlı</Txt>
                </View>
              ) : (
                <View style={[styles.livePill, { backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" }]}>
                  <Txt weight="extrabold" size={10} color={C.dim2}>Sessiz</Txt>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Meta satırı: sahip · kişi · yüzler ——— rozetler
            Eskiden bu satır "Arkadaşlar" diyordu ama gösterdiği kişiler
            odadakilerdi, arkadaşların değil. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="crown" size={11} color={C.gold + "AA"} />
          <Txt weight="semibold" size={10.5} color={C.dim} numberOfLines={1} style={{ flexShrink: 1 }}>{room.host}</Txt>

          <View style={styles.metaAyrac} />
          <Icon name="user" size={11} color={C.dim2} />
          <Txt weight="bold" size={10.5} color={C.dim}>{room.online}</Txt>
          {room.live && <Eq color="#F59E0B" />}

          {friendAvatars.length > 0 && (
            <View style={{ flexDirection: "row", marginLeft: 4 }}>
              {friendAvatars.map((n, i) => (
                <View key={n} style={{ marginLeft: i ? -7 : 0, borderRadius: 11, borderWidth: 1.5, borderColor: "#15121C" }}>
                  <Portrait name={n} size={18} />
                </View>
              ))}
            </View>
          )}

          {/* Rozetler sağa yaslı — WePlay'de de üçlü sıra halinde sağda. */}
          {room.badges && room.badges.length > 0 && (
            <View style={{ marginLeft: "auto", paddingLeft: 6 }}>
              <RoomBadges badges={room.badges} size={22} />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Odalardaki kişi sayıları — gerçek katılımcı tablosundan (070).
 * `hazir`: tablo en az bir kez okundu mu.
 */
type CanliVarlik = { sayilar: Map<number, number>; hazir: boolean };

export default function Home() {
  const router = useRouter();
  const odayaGirDene = useApp((s) => s.odayaGirDene);
  const role = useApp((s) => s.role);
  const session = useApp((s) => s.session);
  const privileged = role !== "user";
  const [tab, setTab] = useState(0);
  const [gateRoom, setGateRoom] = useState<Room | null>(null);

  // Cache-first: son oda listesini ANINDA göster (persist → soğuk açılışta bile),
  // arkada tazele. useFocusEffect revalidate cache hook'unun içinde.
  const { data: dbRooms = [], refresh: odalariTazele } = useCachedResource<Room[]>(
    "rooms:list",
    () => listRooms(),
    { persist: true, enabled: isSupabaseConfigured },
  );

  /**
   * Liste CANLI (065).
   *
   * Eskiden yalnızca ekran odaklandığında tazeleniyordu: listeye bakarken
   * duruyorsan hiçbir şey sorgu atmıyordu, yeni açılan oda ancak sekme
   * değiştirip dönünce beliriyordu (15-20 sn "gecikme" bundandı). Artık
   * `odalar` tablosundaki her değişiklik anında listeyi tazeliyor.
   */
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    return odaDegisiklikleriniDinle(odalariTazele);
  }, [odalariTazele]);

  /**
   * Odalardaki CANLI kişi sayısı — `oda_katilimcilar` tablosundan (070).
   *
   * `aktif_katilimci_sayisi` istemcinin yazdığı bir sayıydı: yazılamazsa oda
   * hiç görünmüyor, uygulama çökerse boş oda listede asılı kalıyordu. Presence
   * bağlantı düştüğü an kişiyi düşürdüğü için ikisi de olmuyor. DB sayacı
   * yalnızca soğuk açılışta (presence daha oturmadan) yedek olarak kalıyor.
   */
  const [canli, setCanli] = useState<CanliVarlik>({ sayilar: new Map(), hazir: false });
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

  // DB odaları üstte; mock odalar (MVP'de ekranı canlı tutar) altta. Aynı ID tekrarını ele.
  const dbIds = new Set(dbRooms.map((r) => r.id));
  const tumOdalar = [...dbRooms, ...ROOMS.filter((r) => !dbIds.has(r.id))].map((r) => {
    if (r.dbId == null) return r;
    /**
     * TEK KAYNAK: katılımcı tablosu (070).
     *
     * Buraya kadar iki zayıf kaynağın büyüğü alınıyordu (istemcinin yazdığı
     * `aktif_katilimci_sayisi` + presence). İkisi de kararsızdı, o yüzden
     * "biri bile dolu diyorsa dolu" kuralı gerekiyordu — ama bu, hayalet
     * odayı da listede tutuyordu: uygulama zorla kapanınca sayaç >0 kalıyor
     * ve boş oda listede asılı duruyordu.
     *
     * Artık kalp atışlı gerçek tablo var: kalbi durmuş kayıt zaten elenmiş
     * oluyor. Güvenilir kaynağı zayıf olanla harmanlamanın anlamı yok.
     * Tablo okunana kadar eski sayaç yalnızca ilk karede yedek.
     *
     * ESKİ NOT (kayıt için):
     *
     * Presence'ı tek söz sahibi yapmak (30 Ağustos, ilk deneme) daha kötüydü:
     * presence bir odayı ıskaladığında (`track` gitmemiş, o istemci genel
     * kanala hiç katılmamış, ağ yavaş) o odanın DB sayacı da SIFIRA EZİLİYOR
     * ve içinde insan olan oda boş görünüyordu. Tersi de doğru: yalnız DB
     * sayacına güvenmek, sayacı yazacak istemci yazamayınca aynı sonucu
     * veriyordu.
     *
     * Bu yüzden artık ikisinin BÜYÜĞÜ alınıyor: iki bağımsız kaynaktan biri
     * "burada insan var" diyorsa oda doludur. Yanlış tarafa düşme riski
     * "hayalet oda" (uygulama zorla kapanınca sayaç >0 kalır) — bu, dolu
     * odanın görünmemesinden çok daha zararsız ve zaten bilinen ayrı bir iş
     * (bkz. PROJE_DURUMU.md, Sıradakiler 11).
     */
    if (!canli.hazir) return r; // tablo henüz okunmadı — eski sayaç yedek
    const sayi = canli.sayilar.get(r.dbId) ?? 0;
    return sayi === r.online ? r : { ...r, online: sayi, live: sayi > 0 };
  });

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
   * (Silinmiş odalar zaten sunucuda RLS ile eleniyor.)
   *
   * BOŞ ODA ARTIK TAMAMEN YOK SAYILMIYOR (karar 30 Ağustos). "İçinde kimse
   * yoksa hiç gösterme" kuralı iki kez soruna yol açtı: sahibi kendi odasını
   * göremiyordu, presence bir an gecikince de liste komple boşalıyordu. Boş
   * odalar dört ana sekmede yine gizli — ama artık ayrı bir "Boş" sekmesinde
   * listeleniyorlar, yani hiçbir oda erişilemez hale gelmiyor.
   *
   * "Kim odada" bilgisi artık YALNIZCA canlı presence'tan geliyor — bkz.
   * 070. Eski `aktif_katilimci_sayisi` sayacı istatistik olarak kalıyor (sıralama/Odam/yönetim
   * onu okuyor) ama görünürlüğe karar vermiyor.
   */
  const uygun = useMemo(() => {
    const yasak = new Set(yasakliOdaIds ?? []);
    return tumOdalar.filter((r) => {
      if (r.locked) return false;
      if (r.islemGordu) return false;
      if (r.dbId != null && yasak.has(r.dbId)) return false;
      return true;
    });
  }, [tumOdalar, yasakliOdaIds]);

  /** İçinde en az bir kişi olan odalar — dört ana sekmenin kaynağı. */
  const gorunur = useMemo(() => uygun.filter((r) => r.online > 0), [uygun]);

  /** Boş odalar — yalnızca "Boş" sekmesinde. En son kurulan en üstte. */
  const bosOdalar = useMemo(
    () => sirala(uygun.filter((r) => r.online <= 0), (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [uygun],
  );

  /**
   * SEKMELER — hangisi boş odayı da gösterir?
   *
   * REGRESYON KAYDI: bu listede eskiden HİÇ filtre yoktu (`36802bc`), her oda
   * her zaman görünüyordu. `393d66d` sekmeleri gerçekten çalıştırırken
   * "içinde kimse yoksa gösterme" kuralını getirdi, `99fd630` da bunu TÜM
   * sekmelere yaydı. Sonuç: yeni kurulan oda hiçbir yerde görünmüyordu
   * (057 migration'ının açılış notu tam olarak bunu anlatıyor) ve sahibi
   * kendi odasını bulamıyordu. Kullanıcı 30 Ağustos'ta "eskiden bayağı
   * görünüyordu, bir oturumda bozdunuz" diyerek bunu bildirdi — doğru.
   *
   * NİHAİ KURAL (30 Ağustos, kullanıcı): **boş oda yalnızca "Boş" sekmesinde.**
   * Bir ara Keşfet'e de boş odalar konmuştu, kullanıcı bunu istemedi. Dört
   * ana sekme doluluk arar, beşincisi boşları toplar — kural tek cümlede
   * anlatılabiliyor, sürpriz yok.
   *
   * DİKKAT: bu kuralın işe yaraması "dolu oda gerçekten dolu görünüyor"a
   * bağlı. Sayı iki kaynağın büyüğünden geliyor (yukarı bak); tek kaynağa
   * indirgeme denemesi iki kez de dolu odaları listeden sildi.
   */
  const rooms = useMemo(() => {
    switch (tab) {
      case 1: // Popüler — yalnızca dolu odalar, kalabalıktan seyreğe
        return sirala(gorunur);
      case 2: {
        // Yeni — son YENI_ODA_GUN günde kurulmuş normal odalar (resmî ve
        // Daily Top hariç, onların kendi sekmesi var). En yeni üstte.
        const esik = Date.now() - YENI_ODA_GUN * 24 * 60 * 60 * 1000;
        return gorunur
          .filter((r) => !r.official && r.daily == null && (r.createdAt ?? 0) >= esik)
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      }
      case 3: // Resmî — yalnızca resmî odalar
        return sirala(gorunur.filter((r) => r.official));
      case 4: // Boş — içinde kimse olmayanlar, en yeni üstte
        return bosOdalar;
      default: // Keşfet — dolu odalar, kalabalıktan seyreğe
        return sirala(gorunur);
    }
  }, [tab, gorunur, bosOdalar]);

  const enterAndGo = (room: Room) => {
    haptic.light();
    // Odaya doğrudan girilmiyor: perde açılır, kontroller geçerse girilir.
    odayaGirDene(room);
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
          <Pressable onPress={() => router.navigate("/user-search")} hitSlop={8} style={styles.roundBtn}>
            <Icon name="search" size={19} color={C.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <EventBanners />
          {/* Sekmeler banner'ın ÜSTÜNDEYDİ; artık banner ile oda listesinin
              arasında, yani filtrelediği listenin hemen başında duruyor. */}
          <Tabs items={["Keşfet", "Popüler", "Yeni", "Resmî", "Boş"]} active={tab} set={setTab} pad={14} />
          <View style={{ paddingHorizontal: 12, paddingTop: 14, gap: 10 }}>
            {rooms.length > 0 ? (
              rooms.map((r) => <RoomRow key={r.id} room={r} onPress={() => onRoomPress(r)} />)
            ) : (
              /* Sekmeler artık gerçekten filtreliyor → sonuç boş olabilir.
                 Görsel BosDurum'a taşındı (aynı kalıp rank.tsx ve wallet.tsx'te
                 de kopyalanmıştı); metinler burada kalıyor, sekmeye bağlılar. */
              <BosDurum
                anim={BOS_KUTU}
                baslik={
                  tab === 4
                    ? "Boş oda yok"
                    : tab === 3
                      ? "Henüz resmî oda yok"
                      : tab === 2
                        ? "Yeni açılan oda yok"
                        : "Şu an açık oda yok"
                }
                alt={
                  tab === 4
                    ? "Kurulu her odanın içinde birileri var. Kimse kalmayan odalar buraya düşer."
                    : tab === 3
                      ? "Resmî odalar açıldığında burada listelenir."
                      : tab === 2
                        ? `Son ${YENI_ODA_GUN} günde açılmış bir oda yok.`
                        : "İçinde kimse olmayan odalar \"Boş\" sekmesinde. Kilitli, yasaklı ve işlem görmüş odalar hiç listelenmez."
                }
              />
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
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999 },
  // Meta satirinda sahip ile kisi sayisi arasindaki ince dikey cizgi.
  metaAyrac: { width: 1, height: 9, backgroundColor: "rgba(255,255,255,.14)", marginHorizontal: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
});
