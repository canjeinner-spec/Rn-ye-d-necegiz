import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { PodyumCerceve } from "@/components/PodyumCerceve";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Tabs } from "@/components/Tabs";
import { BosDurum } from "@/components/BosDurum";
import { Txt } from "@/components/Txt";
// Sıralama boş durumu — kupalı şampiyon. Renkleri scripts/lottie-boya.js ile
// temaya boyandı (özgün dosyada konfeti pembe/camgöbeği/yeşildi).
import SAMPIYON from "@/anim/sampiyon.json";
import { listRooms } from "@/data/remote/roomsRepo";
import {
  PERIYOTLAR, cazibe, donemBitis, kalanSure, odalar as odaSiralamasi, zenginlik,
  type Periyot, type SiraKisi, type SiraOda,
} from "@/data/remote/siralamaRepo";
import { ROOMS, type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { useCachedResource } from "@/lib/cache";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { DERECE_CERCEVE, SAHNE } from "@/podium/cerceve";
import { C } from "@/theme/colors";
import { useIcerikAltPayi } from "@/theme/olculer";
import { Gradient } from "@/theme/Gradient";

/** Derece renkleri — altın / gümüş / bronz. */
const MADALYA: Record<number, string> = { 1: "#F5CE6E", 2: "#C7CCD6", 3: "#C9803B" };

/** 1.240 → "1.240", 1.240.000 → "1,2M" (satır dar, sayı taşmasın). */
function kisalt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",")}M`;
  if (n >= 100_000) return `${Math.round(n / 1000)}B`;
  return n.toLocaleString("tr-TR");
}

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
 * Podyum — ilk üç, kanatlı çerçevelerle.
 *
 * ÖNCESİ: madalya renginde halka + taç ikonu + gradyan kaide. Podyumdan çok
 * yer tutucu gibi duruyordu. Referans uygulamalarda podyum bir SAHNE: salon
 * arkaplanı, kanatlı çerçeve, altında derece madalyonu. Kullanıcının istediği
 * "yarışmak için hırslandıran" his büyük ölçüde bu görsel ağırlıktan geliyor.
 *
 * Çerçeveler üretilen sayfadan kesildi (`scripts/cerceve-hazirla.js`) ve
 * avatarın çerçeve içindeki yeri ÖLÇÜLEN orandan geliyor, göz kararı değil.
 */
function Podyum({ ilk3, bas }: { ilk3: SiraKisi[]; bas: (k: SiraKisi) => void }) {
  if (ilk3.length < 3) return null;
  // Birinci ortada ve büyük; ikinci solda, üçüncü sağda ve aşağıda.
  const dizilim = [
    { kisi: ilk3[1], derece: 2, genislik: 104, ust: 34 },
    { kisi: ilk3[0], derece: 1, genislik: 134, ust: 0 },
    { kisi: ilk3[2], derece: 3, genislik: 104, ust: 34 },
  ];
  return (
    <View style={styles.sahne}>
      <Image source={SAHNE} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={0} />
      {/* Sahnenin alt kenarı listeye karışsın; görselin kesildiği yer
          düz bir çizgi olarak görünmesin. */}
      <Gradient colors={["transparent", C.bg]} deg={180} style={styles.sahneEtek} pointerEvents="none" />

      <View style={styles.podyum}>
        {dizilim.map(({ kisi, derece, genislik, ust }) => (
          <Pressable key={kisi.uid} onPress={() => bas(kisi)} style={{ alignItems: "center", marginTop: ust }}>
            <PodyumCerceve kod={DERECE_CERCEVE[derece]} genislik={genislik} ad={kisi.ad} foto={kisi.foto} />
            <View style={[styles.dereceMadalyon, { borderColor: MADALYA[derece] + "AA" }]}>
              <Txt weight="displayBold" size={12} color={MADALYA[derece]}>{derece}</Txt>
            </View>
            <Txt weight="extrabold" size={derece === 1 ? 13 : 11.5} color="#fff" numberOfLines={1} style={{ marginTop: 7, maxWidth: genislik + 14 }}>
              {kisi.ad}
            </Txt>
            <View style={{ marginTop: 5 }}>
              <Puan icon="coin" value={kisalt(kisi.puan)} guclu={derece === 1} />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Veri kaynağı olmayan / henüz boş sekmeler için dürüst boş durum.
 *  Görsel kabuk ortak `BosDurum`'a taşındı; burada yalnız sıralamaya
 *  özgü şampiyon animasyonu seçiliyor. */
function Bos({ baslik, alt }: { baslik: string; alt: string }) {
  return <BosDurum anim={SAMPIYON} baslik={baslik} alt={alt} dolgu={54} animBoyut={165} />;
}

/** Kişi sıralaması — podyum + liste, ortak gövde (Zenginlik ve Cazibe aynı). */
function KisiListesi({ veri, bos, bas }: { veri: SiraKisi[]; bos: React.ReactNode; bas: (k: SiraKisi) => void }) {
  if (veri.length === 0) return <>{bos}</>;
  return (
    <>
      <Podyum ilk3={veri.slice(0, 3)} bas={bas} />
      {veri.slice(veri.length >= 3 ? 3 : 0).map((k) => (
        <Pressable key={k.uid} onPress={() => bas(k)}>
          <Satir n={k.sira}>
            <Portrait name={k.ad} photo={k.foto} size={42} />
            <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1} style={{ flex: 1 }}>{k.ad}</Txt>
            <Puan icon="coin" value={kisalt(k.puan)} />
          </Satir>
        </Pressable>
      ))}
    </>
  );
}

/* ── Ekran ───────────────────────────────────────────────────────────────── */

export default function RankTab() {
  // Alt navigasyonun altında kalmasın — güvenli alan dahil (theme/olculer).
  const altPayi = useIcerikAltPayi();
  const router = useRouter();
  const odayaGirDene = useApp((s) => s.odayaGirDene);
  const [tab, setTab] = useState(0);
  const [periyot, setPeriyot] = useState<Periyot>("hafta");

  const acik = isSupabaseConfigured;

  // Sıralamalar hediye geçmişinden hesaplanıyor (060). Dönem anahtarı cache
  // anahtarına giriyor; yoksa haftadan güne geçince eski liste asılı kalır.
  const { data: zengin = [] } = useCachedResource<SiraKisi[]>(
    `sira:zenginlik:${periyot}`, () => zenginlik(periyot), { persist: true, enabled: acik },
  );
  const { data: cazip = [] } = useCachedResource<SiraKisi[]>(
    `sira:cazibe:${periyot}`, () => cazibe(periyot), { persist: true, enabled: acik },
  );
  const { data: hediyeliOdalar = [] } = useCachedResource<SiraOda[]>(
    `sira:odalar:${periyot}`, () => odaSiralamasi(periyot), { persist: true, enabled: acik },
  );
  const { data: bitis = null } = useCachedResource<number | null>(
    `sira:bitis:${periyot}`, () => donemBitis(periyot), { enabled: acik },
  );

  // Henüz hiç hediye dönmediyse oda sekmesi boş kalmasın: canlı kalabalık listesi.
  const { data: dbRooms = [] } = useCachedResource<Room[]>(
    "rooms:list", () => listRooms(), { persist: true, enabled: acik },
  );
  const kalabalik = [...dbRooms, ...ROOMS.filter((r) => !dbRooms.some((d) => d.id === r.id))]
    .filter((r) => !r.locked && !r.islemGordu && r.online > 0)
    .sort((a, b) => b.online - a.online)
    .slice(0, 20);

  const kalan = kalanSure(bitis);
  const periyotAdi = PERIYOTLAR.find((p) => p.kod === periyot)?.ad ?? "";

  const kisiyeGit = (k: SiraKisi) => {
    haptic.light();
    const q = k.publicId ? `publicId=${encodeURIComponent(k.publicId)}&` : "";
    router.navigate(`/user-profile?${q}name=${encodeURIComponent(k.ad)}`);
  };
  const girOdaya = (r: Room) => { haptic.light(); odayaGirDene(r); };

  return (
    <View style={styles.root}>
      {/* Diğer ekranlarla aynı siyah-altın zemin; burası düz siyahtı. */}
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1F", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 10 }}>
          <Txt weight="displayBold" size={18} color="#fff" style={{ letterSpacing: 0.5 }}>Sıralama</Txt>
          {/* Sayaç sunucudan geliyor; "Haftalık · 2g 14s kaldı" sabit yazıydı. */}
          {kalan && (
            <View style={styles.sureHap}>
              <Icon name="cal" size={11} color={C.gold2} />
              <Txt weight="bold" size={10} color={C.gold2}>{periyotAdi} · {kalan}</Txt>
            </View>
          )}
        </View>

        <Tabs items={["Zenginlik", "Cazibe", "Odalar", "Ajanslar", "Yayıncılar"]} active={tab} set={setTab} pad={14} />

        {/* Dönem seçici — ilk üç sekme dönemli, ajans/yayıncı henüz değil. */}
        {tab <= 2 && (
          <View style={styles.periyotSatiri}>
            {PERIYOTLAR.map((p) => {
              const secili = p.kod === periyot;
              return (
                <Pressable
                  key={p.kod}
                  onPress={() => { haptic.light(); setPeriyot(p.kod); }}
                  style={[styles.periyotHap, secili && styles.periyotHapAktif]}
                >
                  <Txt weight={secili ? "extrabold" : "semibold"} size={10.5} color={secili ? C.gold2 : C.dim}>
                    {p.ad}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: altPayi }} showsVerticalScrollIndicator={false}>
          {/* ---- Zenginlik: en çok hediye gönderenler ---- */}
          {tab === 0 && (
            <KisiListesi
              veri={zengin}
              bas={kisiyeGit}
              bos={<Bos baslik="Bu dönemde hediye gönderilmedi" alt="Zenginlik sıralaması gönderilen hediyelerin toplam değerine göre hesaplanır." />}
            />
          )}

          {/* ---- Cazibe: en çok hediye alanlar ---- */}
          {tab === 1 && (
            <KisiListesi
              veri={cazip}
              bas={kisiyeGit}
              bos={<Bos baslik="Bu dönemde hediye alınmadı" alt="Cazibe sıralaması alınan hediyelerden kalan kazanca göre hesaplanır." />}
            />
          )}

          {/* ---- Odalar: hediye hacmine göre; hiç hediye yoksa kalabalığa göre ---- */}
          {tab === 2 && (
            hediyeliOdalar.length > 0 ? (
              hediyeliOdalar.map((o) => (
                <Pressable
                  key={o.odaId}
                  onPress={() => {
                    const r = dbRooms.find((d) => d.dbId === o.odaId);
                    if (r) girOdaya(r);
                  }}
                >
                  <Satir n={o.sira}>
                    <View style={styles.odaKapak}>
                      {o.kapak
                        ? <Portrait name={o.ad} size={42} photo={o.kapak} />
                        : <View style={styles.odaSahne}><Scene kind="lounge" /></View>}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{o.ad}</Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                        <Icon name="crown" size={10} color={C.gold + "AA"} />
                        <Txt weight="semibold" size={10} color={C.dim} numberOfLines={1}>{o.sahip || "—"}</Txt>
                      </View>
                    </View>
                    <Puan icon="coin" value={kisalt(o.puan)} guclu={o.sira === 1} />
                  </Satir>
                </Pressable>
              ))
            ) : kalabalik.length === 0 ? (
              <Bos baslik="Şu an açık oda yok" alt="Odalar aldıkları hediyelere göre sıralanır; henüz hediye dönmediyse en kalabalıklar gösterilir." />
            ) : (
              <>
                <View style={styles.notHap}>
                  <Icon name="user" size={11} color={C.dim} />
                  <Txt weight="semibold" size={10} color={C.dim}>Bu dönemde hediye dönmedi — en kalabalık odalar</Txt>
                </View>
                {kalabalik.map((r, i) => (
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
                ))}
              </>
            )
          )}

          {/* ---- Ajanslar ----
               Burada uydurma ajans listesi vardı (AGENCY_RANKS): gerçek
               kullanıcıya sahte şampiyon göstermek yanlış. Ajans tabloları
               temel şemada duruyor ama tek bir ajans bile kurulmadı. */}
          {tab === 3 && (
            <Bos
              baslik="Ajans sıralaması yakında"
              alt="Ajanslar kurulmaya başlayınca üyelerinin kazancına göre burada sıralanacak."
            />
          )}

          {/* ---- Yayıncılar ---- */}
          {tab === 4 && (
            <Bos
              baslik="Yayıncı sıralaması yakında"
              alt="Yayıncı kadrosu oluşturulduğunda yayın kazançlarına göre burada sıralanacak."
            />
          )}
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

  periyotSatiri: { flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingTop: 12 },
  periyotHap: {
    paddingVertical: 5.5, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
  },
  periyotHapAktif: { backgroundColor: C.gold + "1F", borderColor: C.gold + "5C" },

  notHap: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    marginBottom: 11, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
  },

  // Sahne listeye göre TAŞIYOR: kaydırma alanının 16 punto yan dolgusundan
  // negatif kenar boşluğuyla çıkıyor ki salon görseli ekranı baştan başa kessin.
  sahne: { marginHorizontal: -16, marginTop: -10, marginBottom: 14, paddingTop: 14, paddingBottom: 18, overflow: "hidden" },
  sahneEtek: { position: "absolute", left: 0, right: 0, bottom: 0, height: 96 },
  podyum: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  dereceMadalyon: {
    marginTop: -13, width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,8,12,.88)",
  },

  satir: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.kart, borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
    borderRadius: 16, paddingVertical: 11, paddingHorizontal: 13, marginBottom: 9, overflow: "hidden",
  },
  siraYuva: { width: 26, alignItems: "center", justifyContent: "center" },
  siraMadalya: { height: 26, borderRadius: 13, borderWidth: 1 },

  puan: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.10)",
  },
  kisiHap: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: C.green + "1A", borderWidth: 1, borderColor: C.green + "44",
  },
  odaKapak: { width: 42, height: 42 },
  odaSahne: { width: 42, height: 42, borderRadius: 13, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },

});
