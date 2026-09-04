import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { EquippedBadge } from "@/components/EquippedBadge";
import { PngBadge } from "@/components/PngBadge";
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
  PERIYOTLAR, cazibe, donemBitis, kalanSure, odalar as odaSiralamasi, seviyeler, zenginlik,
  type Periyot, type SiraKisi, type SiraOda,
} from "@/data/remote/siralamaRepo";
import { levelTierBadge } from "@/data/badges";
import { ROOMS, type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { useCachedResource } from "@/lib/cache";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { DERECE_CERCEVE, SAHNE } from "@/podium/cerceve";
import { C } from "@/theme/colors";
import { ALT_NAV_YUKSEKLIK, useIcerikAltPayi } from "@/theme/olculer";
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
function Podyum({ ilk3, seviye, bas }: { ilk3: SiraKisi[]; seviye: Record<number, number>; bas: (k: SiraKisi) => void }) {
  /**
   * PODYUM ÜÇ KİŞİ OLMADAN DA ÇİZİLİYOR.
   *
   * Önce `ilk3.length < 3` şartı vardı: iki kullanıcılı kapalı betada podyum
   * HİÇ görünmüyordu, sahne de görünmüyordu, birinci ile ikinci düz liste
   * satırına düşüyordu. Boş kürsü göstermek hem sahneyi ortaya çıkarıyor hem
   * de doğru mesajı veriyor: o koltuk boş, kapılabilir.
   */
  if (ilk3.length === 0) return null;
  // Birinci ortada ve büyük; ikinci solda, üçüncü sağda ve aşağıda.
  const dizilim: { kisi?: SiraKisi; derece: number; genislik: number; ust: number }[] = [
    { kisi: ilk3[1], derece: 2, genislik: 104, ust: 34 },
    { kisi: ilk3[0], derece: 1, genislik: 134, ust: 0 },
    { kisi: ilk3[2], derece: 3, genislik: 104, ust: 34 },
  ];
  return (
    // Salon görseli artık SAYFANIN arkasında (sekme şeridinin altından en
    // alta kadar); podyum yalnız kendi yerleşimini yönetiyor.
    <View style={styles.sahne}>
      <View style={styles.podyum}>
        {dizilim.map(({ kisi, derece, genislik, ust }) => (
          <Pressable key={derece} disabled={!kisi} onPress={() => kisi && bas(kisi)} style={{ alignItems: "center", marginTop: ust }}>
            <PodyumCerceve kod={DERECE_CERCEVE[derece]} genislik={genislik} ad={kisi?.ad ?? ""} foto={kisi?.foto} bos={!kisi} />
            <View style={[styles.dereceMadalyon, { borderColor: (kisi ? MADALYA[derece] : "#FFFFFF") + (kisi ? "AA" : "22") }]}>
              <Txt weight="displayBold" size={12} color={kisi ? MADALYA[derece] : C.dim2}>{derece}</Txt>
            </View>
            <Txt weight="extrabold" size={derece === 1 ? 13 : 11.5} color={kisi ? "#fff" : C.dim} numberOfLines={1} style={{ marginTop: 7, maxWidth: genislik + 14 }}>
              {kisi ? kisi.ad : "Boş"}
            </Txt>
            {/*
              KİMLİK YIĞINI — referanstaki podyumda adın altında rütbe ve
              rozetler var; bizde yalnız ad ve puan vardı. Rozet sanatı zaten
              elimizde (assets/badges), kuşanılan rozet de sıralama verisiyle
              geliyor. Rozetler `pointerEvents="none"` içinde: kendi bilgi
              kartlarını açıp podyum dokunuşunu yutmasınlar.
            */}
            {kisi ? (
              <>
                <View style={styles.kimlikSatiri} pointerEvents="none">
                  <PngBadge name={levelTierBadge(seviye[kisi.uid] ?? 1)} size={derece === 1 ? 20 : 17} info={false} />
                  <EquippedBadge kod={kisi.rozet} size={derece === 1 ? 20 : 17} />
                </View>
                <View style={{ marginTop: 5 }}>
                  <Puan icon="coin" value={kisalt(kisi.puan)} guclu={derece === 1} />
                </View>
              </>
            ) : (
              <Txt weight="semibold" size={10} color={C.dim2} style={{ marginTop: 6 }}>Sıra sende</Txt>
            )}
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
  const ilk3 = veri.slice(0, 3);
  /**
   * Podyumdaki üç kişinin seviyesi. Sıralama RPC'si seviye döndürmüyor;
   * üç kişilik tek sorgu, RPC'ye kolon eklemekten (migration) ucuz.
   * Anahtar uid'lerden kuruluyor ki dönem/sekme değişince yeniden çekilsin.
   */
  const { data: seviye = {} } = useCachedResource<Record<number, number>>(
    `sira:seviye:${ilk3.map((k) => k.uid).join("-")}`,
    () => seviyeler(ilk3.map((k) => k.uid)),
    { enabled: isSupabaseConfigured && ilk3.length > 0 },
  );
  if (veri.length === 0) return <>{bos}</>;
  return (
    <>
      <Podyum ilk3={ilk3} seviye={seviye} bas={bas} />
      {/* İlk üç podyumda; liste dördüncüden başlıyor (podyum artık az kişiyle
          de çizildiği için burada tekrar etmemeleri gerekiyor). */}
      {veri.slice(3).map((k) => (
        <Pressable key={k.uid} onPress={() => bas(k)}>
          <Satir n={k.sira}>
            <Portrait name={k.ad} photo={k.foto} size={42} />
            <View style={styles.satirKimlik} pointerEvents="box-none">
              <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{k.ad}</Txt>
              <View pointerEvents="none"><EquippedBadge kod={k.rozet} size={18} /></View>
            </View>
            <Puan icon="coin" value={kisalt(k.puan)} />
          </Satir>
        </Pressable>
      ))}
    </>
  );
}

/**
 * Sabit "benim sıram" çubuğu — listenin altında, alt navigasyonun üstünde.
 *
 * Referans uygulamalarda bu çubuk her zaman ekranda: kullanıcı kaçıncı
 * olduğunu görmek için 50 satır kaydırmıyor. Bizde hiç yoktu.
 *
 * Eşleştirme `publicId` ile: mağazadaki sayısal kullanıcı id'si istemcide
 * tutulmuyor ama public id tutuluyor ve sıralama satırları da onu taşıyor.
 * Listede yoksa sıra yerine tire ve dürüst bir açıklama gösteriliyor —
 * uydurma bir sıra numarası değil.
 */
function BenimSiram({ liste, publicId, ad, foto, alt }: {
  liste: SiraKisi[];
  publicId: string | null;
  ad: string;
  foto?: string;
  alt: number;
}) {
  const ben = publicId ? liste.find((k) => k.publicId === publicId) : undefined;
  return (
    <View style={[styles.benimCubuk, { bottom: alt }]}>
      <Gradient colors={[C.gold + "1F", "transparent"]} deg={110} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.benimSira}>
        <Txt weight="displayBold" size={12.5} color={ben ? C.gold2 : C.dim2}>{ben ? ben.sira : "—"}</Txt>
      </View>
      <Portrait name={ad} photo={foto} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="extrabold" size={12.5} color="#fff" numberOfLines={1}>{ad}</Txt>
        {!ben && <Txt size={10} color={C.dim} numberOfLines={1} style={{ marginTop: 1 }}>Bu dönemde listeye girmedin</Txt>}
      </View>
      <Puan icon="coin" value={kisalt(ben?.puan ?? 0)} guclu={!!ben} />
    </View>
  );
}

/* ── Ekran ───────────────────────────────────────────────────────────────── */

export default function RankTab() {
  // Alt navigasyonun altında kalmasın — güvenli alan dahil (theme/olculer).
  const altPayi = useIcerikAltPayi();
  const router = useRouter();
  const odayaGirDene = useApp((s) => s.odayaGirDene);
  const benimPublicId = useApp((s) => s.publicId);
  const benimAd = useApp((s) => s.userName);
  const benimFoto = useApp((s) => s.userPhoto);
  const insets = useSafeAreaInsets();
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

        {/*
          SALON ARKAPLANI TÜM SAYFADA.

          Önce yalnız podyumun arkasındaydı ve görselin boş üst kısmı
          ekranda duruyordu, altındaki liste ise düz siyah zemindeydi —
          sahne bitince ekran ikiye bölünüyordu. Referans uygulamalarda
          arkaplan sayfanın tamamını kaplıyor, liste onun üstünde duruyor.

          Sarmalayıcı sekme şeridinden SONRA başlıyor, yani görsel tam da
          şeridin altındaki çizgiden itibaren görünüyor. Perde gradyanı
          aşağı indikçe koyulaşıyor: podyum aydınlık kalıyor, liste
          satırlarının altı okunaklı oluyor.
        */}
        <View style={{ flex: 1 }}>
          <Image source={SAHNE} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={0} />
          <Gradient
            colors={["rgba(8,8,12,.28)", "rgba(8,8,12,.82)", "rgba(8,8,12,.96)"]}
            deg={180}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

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

        {/* Kişi sekmelerinde alta sabit çubuk biniyor; son satır onun altında
            kalmasın diye içerik payı çubuk kadar artıyor. */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: altPayi + (tab <= 1 ? 62 : 0) }} showsVerticalScrollIndicator={false}>
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
        </View>

        {tab <= 1 && (tab === 0 ? zengin : cazip).length > 0 && (
          <BenimSiram
            liste={tab === 0 ? zengin : cazip}
            publicId={benimPublicId}
            ad={benimAd}
            foto={benimFoto || undefined}
            alt={ALT_NAV_YUKSEKLIK + insets.bottom}
          />
        )}
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

  // Dönem hapları referanstaki gibi TEK KAPSÜL içinde. Ayrı ayrı çerçeveli
  // haplar sekme şeridiyle yarışıyordu; kapsül ikisini ayırıyor.
  periyotSatiri: {
    flexDirection: "row", alignSelf: "center", gap: 3, marginTop: 12, padding: 3,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
  },
  periyotHap: { paddingVertical: 6, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1, borderColor: "transparent" },
  periyotHapAktif: { backgroundColor: C.gold + "24", borderColor: C.gold + "5C" },

  notHap: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    marginBottom: 11, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
  },

  sahne: { marginBottom: 12, paddingTop: 6, paddingBottom: 8 },
  podyum: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  kimlikSatiri: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  satirKimlik: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  benimCubuk: {
    position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: C.gold + "44", backgroundColor: "rgba(13,11,17,.97)",
  },
  benimSira: { width: 22, alignItems: "center" },
  dereceMadalyon: {
    marginTop: -13, width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,8,12,.88)",
  },

  satir: {
    flexDirection: "row", alignItems: "center", gap: 12,
    // Zemin artık salon görselinin üstünde: `C.kart` (%4 beyaz) fotoğrafın
    // üstünde okunmuyordu, satır koyu ve yarı saydam bir yüzeye alındı.
    backgroundColor: "rgba(12,11,16,.72)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
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
