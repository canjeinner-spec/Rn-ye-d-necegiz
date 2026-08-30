import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AgencyBadge, agencyTier } from "@/components/AgencyBadge";
import { AgencyEmblem } from "@/components/AgencyEmblem";
import { Badge } from "@/components/Badge";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { listRooms } from "@/data/remote/roomsRepo";
import { AGENCY_RANKS, RANKS, ROOMS, STREAMER_RANKS, type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { useCachedResource } from "@/lib/cache";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/** Derece renkleri — altın / gümüş / bronz. */
const MADALYA: Record<number, string> = { 1: "#F5CE6E", 2: "#C7CCD6", 3: "#C9803B" };

/* ── Ortak parçalar ──────────────────────────────────────────────────────── */

/** Puan hapı — sağ uçta, para birimi rozetiyle. */
function Puan({ icon, value, guclu }: { icon: "coin" | "diamond"; value: string; guclu?: boolean }) {
  return (
    <View style={[styles.puan, guclu && { backgroundColor: C.gold + "1F", borderColor: C.gold + "5C" }]}>
      {icon === "coin" ? <CoinBadge size={13} /> : <DiamondBadge size={13} />}
      <Txt weight="extrabold" size={11.5} color={guclu ? C.gold2 : C.text}>{value}</Txt>
    </View>
  );
}

/** Sıra numarası — ilk üçte madalya rengiyle dolu madalyon. */
function Sira({ n }: { n: number }) {
  const renk = MADALYA[n];
  if (!renk) {
    return (
      <View style={styles.siraYuva}>
        <Txt weight="extrabold" size={12.5} color={C.dim2}>{n}</Txt>
      </View>
    );
  }
  return (
    <View style={[styles.siraYuva, styles.siraMadalya, { backgroundColor: renk + "24", borderColor: renk + "77" }]}>
      <Txt weight="displayBold" size={12.5} color={renk}>{n}</Txt>
    </View>
  );
}

/** Liste satırı — ilk üç altın kenarlı ve hafif parıltılı. */
function Satir({ n, children }: { n: number; children: React.ReactNode }) {
  const renk = MADALYA[n];
  return (
    <View style={[styles.satir, renk ? { borderColor: renk + "4D" } : null]}>
      {renk && <Gradient colors={[renk + "12", "transparent"]} deg={110} style={StyleSheet.absoluteFill} pointerEvents="none" />}
      <Sira n={n} />
      {children}
    </View>
  );
}

/**
 * Podyum — ilk üç.
 *
 * Eskiden kaidesi 62×38 / 48×24'lük minik gradyan dikdörtgenlerdi; podyumdan
 * çok yer tutucuya benziyordu. Artık gerçek yükseklik farkı, madalya renginde
 * kaide, birincide taç ve ışık var.
 */
function Podyum({ ilk3 }: { ilk3: { name: string; coins: string }[] }) {
  if (ilk3.length < 3) return null;
  const dizilim = [
    { kisi: ilk3[1], derece: 2, yukseklik: 52, avatar: 58 },
    { kisi: ilk3[0], derece: 1, yukseklik: 76, avatar: 76 },
    { kisi: ilk3[2], derece: 3, yukseklik: 38, avatar: 58 },
  ];
  return (
    <View style={styles.podyum}>
      {dizilim.map(({ kisi, derece, yukseklik, avatar }) => {
        const renk = MADALYA[derece];
        const birinci = derece === 1;
        return (
          <View key={kisi.name} style={{ flex: 1, alignItems: "center" }}>
            {birinci && (
              <View style={styles.tac}>
                <Icon name="crown" size={19} sw={2} color={C.gold2} />
              </View>
            )}
            <View>
              {birinci && <View style={styles.tacIsik} pointerEvents="none" />}
              <Portrait name={kisi.name} size={avatar} ring={renk} glow={birinci} frameBorder="#0B0A11" />
            </View>
            <Txt weight="extrabold" size={birinci ? 13 : 11.5} color="#fff" numberOfLines={1} style={{ marginTop: 8, maxWidth: "100%" }}>
              {kisi.name}
            </Txt>
            <View style={{ marginTop: 6 }}>
              <Puan icon="coin" value={kisi.coins} guclu={birinci} />
            </View>

            {/* Kaide */}
            <View style={[styles.kaide, { height: yukseklik, borderColor: renk + "55" }]}>
              <Gradient colors={[renk + "3D", renk + "0A"]} deg={180} style={StyleSheet.absoluteFill} />
              <View style={[styles.kaideParilti, { backgroundColor: renk + "99" }]} pointerEvents="none" />
              <Txt weight="displayBold" size={birinci ? 22 : 18} color={renk}>{derece}</Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Veri kaynağı olmayan sekmeler için dürüst boş durum. */
function Bos({ baslik, alt }: { baslik: string; alt: string }) {
  return (
    <View style={styles.bos}>
      <View style={styles.bosIkon}>
        <Icon name="trophy" size={22} color={C.gold} />
      </View>
      <Txt weight="displayBold" size={14.5} color="#fff" style={{ marginTop: 13 }}>{baslik}</Txt>
      <Txt size={11.5} color={C.dim} align="center" lh={1.5} style={{ marginTop: 7, maxWidth: 260 }}>{alt}</Txt>
    </View>
  );
}

/* ── Ekran ───────────────────────────────────────────────────────────────── */

export default function RankTab() {
  const router = useRouter();
  const odayaGirDene = useApp((s) => s.odayaGirDene);
  const [tab, setTab] = useState(0);

  // "Odalar" sekmesi GERÇEK: kalabalığa göre sıralı oda listesi.
  // (Zenginlik/Cazibe/Ajans/Yayıncı için henüz veri kaynağı yok.)
  const { data: dbRooms = [] } = useCachedResource<Room[]>(
    "rooms:list", () => listRooms(), { persist: true, enabled: isSupabaseConfigured },
  );
  const odaSirasi = [...dbRooms, ...ROOMS.filter((r) => !dbRooms.some((d) => d.id === r.id))]
    .filter((r) => !r.locked && !r.islemGordu && r.online > 0)
    .sort((a, b) => b.online - a.online)
    .slice(0, 20);

  const girOdaya = (r: Room) => { haptic.light(); odayaGirDene(r); };

  return (
    <View style={styles.root}>
      {/* Diğer ekranlarla aynı siyah-altın zemin; burası düz siyahtı. */}
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1F", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 10 }}>
          <Txt weight="displayBold" size={18} color="#fff" style={{ letterSpacing: 0.5 }}>Sıralama</Txt>
          <View style={styles.sureHap}>
            <Icon name="cal" size={11} color={C.gold2} />
            <Txt weight="bold" size={10} color={C.gold2}>Haftalık · 2g 14s kaldı</Txt>
          </View>
        </View>

        <Tabs items={["Zenginlik", "Cazibe", "Odalar", "Ajanslar", "Yayıncılar"]} active={tab} set={setTab} pad={14} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* ---- Zenginlik ---- */}
          {tab === 0 && (
            <>
              <Podyum ilk3={RANKS.slice(0, 3)} />
              {RANKS.slice(3).map((p, i) => (
                <Satir key={p.name} n={i + 4}>
                  <Portrait name={p.name} size={42} />
                  <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1} style={{ flex: 1 }}>{p.name}</Txt>
                  <Puan icon="coin" value={p.coins} />
                </Satir>
              ))}
            </>
          )}

          {/* ---- Cazibe: veri kaynağı yok ---- */}
          {tab === 1 && (
            <Bos
              baslik="Cazibe sıralaması yakında"
              alt="Alınan hediyelere göre hesaplanacak. Hediye sistemi bağlandığında burası dolacak."
            />
          )}

          {/* ---- Odalar: GERÇEK veri ---- */}
          {tab === 2 && (
            odaSirasi.length === 0 ? (
              <Bos baslik="Şu an açık oda yok" alt="Odalar kalabalıklarına göre burada sıralanır." />
            ) : (
              odaSirasi.map((r, i) => (
                <Pressable key={r.id} onPress={() => girOdaya(r)}>
                  <Satir n={i + 1}>
                    <View style={styles.odaKapak}>
                      {r.photo
                        ? <Portrait name={r.name} size={42} photo={r.photo} />
                        : <View style={styles.odaSahne}><Scene kind={r.scene} /></View>}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{r.name}</Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                        <Icon name="crown" size={10} color={C.gold + "AA"} />
                        <Txt weight="semibold" size={10} color={C.dim} numberOfLines={1}>{r.host}</Txt>
                      </View>
                    </View>
                    <View style={styles.kisiHap}>
                      <Icon name="user" size={11} color="#6EE7B7" />
                      <Txt weight="extrabold" size={11.5} color="#6EE7B7">{r.online}</Txt>
                    </View>
                  </Satir>
                </Pressable>
              ))
            )
          )}

          {/* ---- Ajanslar ----
               İlk üç ajans kendine özgü armayı taşır (altın taçlı / gümüş /
               bronz), gerisi sade çelik arma. Önceden hepsi aynı amblemdi:
               birinci ajansla sonuncusu birbirinden ayırt edilemiyordu. */}
          {tab === 3 && AGENCY_RANKS.map((a, i) => {
            const sira = i + 1;
            const kademe = agencyTier(sira);
            const renk = MADALYA[sira];
            return (
              <Satir key={a.name} n={sira}>
                <AgencyBadge tier={kademe} size={kademe ? 46 : 38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Txt weight="extrabold" size={13.5} color={renk ?? C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{a.name}</Txt>
                    {kademe === 1 && (
                      <View style={styles.sampiyonHap}>
                        <Icon name="crown" size={9} color="#241A05" />
                        <Txt weight="extrabold" size={8.5} color="#241A05">ŞAMPİYON</Txt>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Icon name="crown" size={10} color={C.gold + "AA"} />
                    <Txt weight="semibold" size={10} color={C.dim} numberOfLines={1} style={{ flexShrink: 1 }}>{a.owner}</Txt>
                    <View style={styles.uyeHap}>
                      <Icon name="users" size={9} color={C.dim} />
                      <Txt weight="bold" size={9.5} color={C.dim}>{a.members}</Txt>
                    </View>
                  </View>
                </View>
                <Puan icon="diamond" value={a.score} guclu={kademe === 1} />
              </Satir>
            );
          })}

          {/* ---- Yayıncılar ----
               Satır aynı kalıpta ama ilk üç belirgin: madalya halkalı büyük
               avatar, ajans adı kendi hapında, kazanç öne çıkıyor. */}
          {tab === 4 && STREAMER_RANKS.map((s, i) => {
            const sira = i + 1;
            const renk = MADALYA[sira];
            return (
              <Satir key={s.name} n={sira}>
                <View>
                  <Portrait name={s.name} size={renk ? 48 : 42} ring={renk ?? undefined} glow={sira === 1} online />
                  {sira === 1 && (
                    <View style={styles.yayinciTac}>
                      <Icon name="crown" size={11} color="#241A05" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Txt weight="extrabold" size={13.5} color={renk ?? C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{s.name}</Txt>
                    <Badge type="streamer" size={15} />
                  </View>
                  <View style={styles.ajansHap}>
                    <AgencyEmblem s={11} />
                    <Txt weight="bold" size={9.5} color={C.dim} numberOfLines={1}>{s.agency}</Txt>
                  </View>
                </View>
                <Puan icon="coin" value={s.coins} guclu={sira === 1} />
              </Satir>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 250 },
  sureHap: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6,
    paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: C.gold + "14", borderWidth: 1, borderColor: C.gold + "3D",
  },

  podyum: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8, paddingTop: 22, paddingBottom: 22 },
  tac: { marginBottom: 4 },
  tacIsik: {
    position: "absolute", top: -10, left: -10, right: -10, bottom: -10, borderRadius: 60,
    backgroundColor: C.gold + "1F",
    shadowColor: C.gold, shadowOpacity: 0.9, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  kaide: {
    alignSelf: "stretch", marginTop: 10, marginHorizontal: 4,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderWidth: 1, borderBottomWidth: 0, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  kaideParilti: { position: "absolute", top: 0, left: 12, right: 12, height: 1.5 },

  satir: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
    borderRadius: 16, paddingVertical: 11, paddingHorizontal: 13, marginBottom: 9, overflow: "hidden",
  },
  siraYuva: { width: 26, alignItems: "center", justifyContent: "center" },
  siraMadalya: { height: 26, borderRadius: 13, borderWidth: 1 },

  puan: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)",
  },
  kisiHap: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: C.green + "1A", borderWidth: 1, borderColor: C.green + "44",
  },
  odaKapak: { width: 42, height: 42 },
  odaSahne: { width: 42, height: 42, borderRadius: 13, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },

  sampiyonHap: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: C.gold2,
  },
  uyeHap: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)",
  },
  ajansHap: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 4,
    paddingVertical: 2.5, paddingHorizontal: 8, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)",
  },
  yayinciTac: {
    position: "absolute", top: -6, alignSelf: "center",
    width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: C.gold2, borderWidth: 1.5, borderColor: "#0B0A11",
  },
  bos: { alignItems: "center", paddingVertical: 54, paddingHorizontal: 18 },
  bosIkon: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
    backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "3D",
  },
});
