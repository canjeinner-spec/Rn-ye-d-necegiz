import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
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
// GEÇİCİ: liste dolu görünsün diye 4-30 arası sahte kayıt. Silinecek.
import { mockKisiEkle, mockOdaEkle } from "@/data/mockSiralama";
import { ROOMS, type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { useCachedResource } from "@/lib/cache";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { CERCEVEDE_RAKAM, dereceCercevesi, SAHNE } from "@/podium/cerceve";
import { C } from "@/theme/colors";
import { ALT_NAV_YUKSEKLIK, useIcerikAltPayi } from "@/theme/olculer";
import { Gradient } from "@/theme/Gradient";

/** Derece renkleri — altın / gümüş / bronz. */
const MADALYA: Record<number, string> = { 1: "#F5CE6E", 2: "#C7CCD6", 3: "#C9803B" };

/**
 * HER SEKMENİN KENDİ RENGİ.
 *
 * Referans uygulamada sekme değişince sayfanın tonu da değişiyor —
 * kullanıcının tarifiyle "üstte lamba değişir gibi". Tek altın tonunda beş
 * sekme birbirinden ayrılmıyordu.
 *
 * Renkler siyah-altın temaya göre seçildi; MOR ve PEMBE bilerek YOK
 * (kullanıcı kararı, uygulamanın kimliği değil).
 *   Zenginlik  altın      — para
 *   Cazibe     yakut      — hediye taşlarının rengi
 *   Odalar     turkuaz    — canlı yayın/oda
 *   Ajanslar   bakır      — üçüncülük madalyasıyla aynı aile
 *   Yayıncılar çelik mavi — diğer dördünden en uzak ton
 */
const SEKME_RENK = ["#E8B341", "#C8324B", "#17A398", "#C9803B", "#3B82F6"];

/** 1.240 → "1.240", 1.240.000 → "1,2M" (satır dar, sayı taşmasın). */
function kisalt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",")}M`;
  if (n >= 100_000) return `${Math.round(n / 1000)}B`;
  return n.toLocaleString("tr-TR");
}

/* ── Ortak parçalar ──────────────────────────────────────────────────────── */

/** Puan hapı — sağ uçta, para birimi rozetiyle. */
function Puan({ icon, value, guclu, renk = C.gold }: { icon: "coin" | "diamond"; value: string; guclu?: boolean; renk?: string }) {
  return (
    <View style={[styles.puan, guclu && { backgroundColor: renk + "24", borderColor: renk + "66" }]}>
      {icon === "coin" ? <CoinBadge size={13} /> : <DiamondBadge size={13} />}
      <Txt weight="extrabold" size={11.5} color={guclu ? renk : C.text}>{value}</Txt>
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

/**
 * Oda kapağı — DAİRE DEĞİL, yuvarlatılmış KARE.
 *
 * Aynı listede iki biçim vardı: fotoğrafı olan oda `Portrait`ten geçtiği için
 * DAİRE, fotoğrafı olmayan oda `Scene` kutusundan geçtiği için KARE
 * çıkıyordu. Oda kapakları kare üretiliyor (kırpma da kareye göre) ve
 * referans uygulamalarda da kare gösteriliyor; ikisi de kareye alındı.
 */
function OdaGorsel({ kapak, sahne }: { kapak?: string; sahne?: React.ComponentProps<typeof Scene>["kind"] }) {
  return kapak ? (
    <Image source={{ uri: kapak }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" transition={160} />
  ) : (
    <Scene kind={sahne ?? "lounge"} />
  );
}

function OdaKapak(p: { kapak?: string; sahne?: React.ComponentProps<typeof Scene>["kind"] }) {
  return (
    <View style={styles.odaKapak}>
      <OdaGorsel {...p} />
    </View>
  );
}
/**
 * Liste paneli — sahnenin üstünde duran tek yüzey.
 *
 * ÖNCESİ: her satır ayrı bir karttı (kendi zemini, kendi kenarlığı, aralarında
 * boşluk). Salon görselinin üstünde bu, on tane yüzen kutu demekti. Referans
 * uygulamada liste TEK panel: sahne biter, panel başlar, satırlar ince
 * çizgilerle ayrılır. Panel aşağı doğru uzuyor ki sayfanın sonu boş görselle
 * bitmesin.
 */
function Panel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
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
/** Podyumda gösterilecek tek kayıt — kişi de oda da buna çevriliyor. */
type PodyumOge = {
  ad: string;
  foto?: string;
  puan: number;
  /** Kişide seviye rütbesi. */
  seviye?: number;
  /** Kişide kuşanılan rozet. */
  rozet?: string;
  /** Odada sahibinin adı — rozet satırının yerine geçiyor. */
  altYazi?: string;
  /** Puan hapı yerine kişi sayacı — kalabalık odalar listesinde puan yok. */
  kisiSayaci?: boolean;
  /** Avatarın yerine çizilecek şey (oda kapağı). */
  icerik?: React.ReactNode;
  bas: () => void;
};

/**
 * Podyum — ilk üç, kanatlı çerçevelerle.
 *
 * ÖLÇÜ AVATARDAN VERİLİYOR, ÇERÇEVEDEN DEĞİL. Önce her çerçeveye tuval
 * genişliği veriliyordu (134/104/100) ve podyum tutarsız görünüyordu: altının
 * tuvalinde uzun bir taç, gümüşünkinde yok, bronzda defne çelengi var — aynı
 * tuval genişliğinde üçünün HALKA çapı bambaşka çıkıyor. Göz ise tacı değil
 * avatarı kıyaslıyor. Artık istenen avatar çapı veriliyor (84 / 62 / 60) ve
 * tuval genişliğini `PodyumCerceve` ölçülen orandan hesaplıyor.
 *
 * SÜTUNLAR EŞİT (`flex: 1`). Önce her sütun kendi çerçevesi kadar genişti,
 * o yüzden aralar rastgele duruyordu — birinci ile ikinci bitişik, üçüncü
 * uzakta. Birincinin çerçevesi sütunundan geniş olduğu için komşularının
 * üstüne hafifçe biniyor; referans podyumda da kompozisyon böyle kenetli.
 * `zIndex` ile birinci en üstte kalıyor.
 *
 * BASAMAK: birinci ortada ve en üstte, ikinci solda bir basamak aşağıda,
 * üçüncü sağda bir basamak daha aşağıda.
 *
 * Boş dereceler sönük çerçeveyle duruyor ("Boş / Sıra sende"): kapalı
 * betada üç kişi yok, podyumu hiç çizmemek sahneyi de yok ediyordu.
 */
function Podyum({ ogeler, vurgu, tur = "kisi" }: { ogeler: (PodyumOge | undefined)[]; vurgu: string; tur?: "kisi" | "oda" }) {
  if (!ogeler[0]) return null;
  /**
   * PİRAMİT + YENİ ARMALARIN ORANI.
   *
   * Yeni çerçeveler ARMA: kanatlar ve kurdele yüzeyin çoğunu kaplıyor, açıklık
   * tuvalin yalnız ~%32'si (eskisi ~%55). Aynı avatar çapını istemek çerçeveyi
   * iki katına çıkarıyordu. Ölçü artık ÇERÇEVE GENİŞLİĞİNDEN veriliyor
   * (150 / 119 / 119) ki daire ve kare setler birebir aynı kompozisyona
   * otursun — kare armalar aynı avatar çapında daha geniş çiziliyordu ve
   * odalar sekmesi sıkışık görünüyordu. Üçü toplamda
   * ekrandan biraz taşıp komşusuna hafifçe biniyor — referanstaki kenetli
   * kompozisyon da böyle.
   *
   * ÜÇGEN: birinci tepede, ikinci ve üçüncü belirgin biçimde AŞAĞIDA (50/62).
   * Önceki 26/46 farkı yeterince okunmuyordu, üçü yan yana duruyor gibiydi.
   */
  const dizilim = [
    { oge: ogeler[1], derece: 2, genislik: 119, ust: 50 },
    { oge: ogeler[0], derece: 1, genislik: 150, ust: 0 },
    { oge: ogeler[2], derece: 3, genislik: 119, ust: 62 },
  ];
  return (
    <View style={styles.sahne}>
      <View style={styles.podyum}>
        {dizilim.map(({ oge, derece, genislik, ust }) => (
          <Pressable
            key={derece}
            disabled={!oge}
            onPress={() => oge?.bas()}
            style={[styles.podyumSutun, { marginTop: ust, zIndex: derece === 1 ? 2 : 1 }]}
          >
            <PodyumCerceve
              kod={dereceCercevesi(derece, tur)}
              genislik={genislik}
              ad={oge?.ad ?? ""}
              foto={oge?.foto}
              icerik={oge?.icerik}
              bos={!oge}
            />
            {/* Rakam çerçevenin sanatına kabartıldığında ekran kendi madalyonunu
                çizmiyor — referansta da rakam çerçevenin parçası. */}
            {!CERCEVEDE_RAKAM && (
              <View style={[styles.dereceMadalyon, { borderColor: (oge ? MADALYA[derece] : "#FFFFFF") + (oge ? "AA" : "22") }]}>
                <Txt weight="displayBold" size={12} color={oge ? MADALYA[derece] : C.dim2}>{derece}</Txt>
              </View>
            )}
            <Txt weight="extrabold" size={derece === 1 ? 13 : 11.5} color={oge ? "#fff" : C.dim} numberOfLines={1} style={styles.podyumAd}>
              {oge ? oge.ad : "Boş"}
            </Txt>
            {oge ? (
              <>
                {/* Kişide rütbe + kuşanılan rozet, odada sahibinin adı.
                    Rozetler pointerEvents="none" içinde: kendi bilgi
                    kartlarını açıp podyum dokunuşunu yutmasınlar. */}
                {oge.altYazi ? (
                  <View style={styles.podyumAlt}>
                    <Icon name="crown" size={10} color={C.gold + "AA"} />
                    <Txt weight="semibold" size={10} color={C.dim} numberOfLines={1}>{oge.altYazi}</Txt>
                  </View>
                ) : (
                  <View style={styles.kimlikSatiri} pointerEvents="none">
                    <PngBadge name={levelTierBadge(oge.seviye ?? 1)} size={derece === 1 ? 20 : 17} info={false} />
                    <EquippedBadge kod={oge.rozet} size={derece === 1 ? 20 : 17} />
                  </View>
                )}
                <View style={{ marginTop: 5 }}>
                  {/* Kalabalık listesinde sayı ALTIN DEĞİL kişi sayısı; altın hapıyla
                      göstermek yanlış bilgi olurdu. */}
                  {oge.kisiSayaci ? (
                    <View style={styles.kisiHap}>
                      <Icon name="user" size={11} color="#6EE7B7" />
                      <Txt weight="extrabold" size={11.5} color="#6EE7B7">{oge.puan}</Txt>
                    </View>
                  ) : (
                    <Puan icon="coin" value={kisalt(oge.puan)} guclu={derece === 1} renk={vurgu} />
                  )}
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
function KisiListesi({ veri, bos, vurgu, bas }: { veri: SiraKisi[]; bos: React.ReactNode; vurgu: string; bas: (k: SiraKisi) => void }) {
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
  const ogeler = ilk3.map((k) => ({
    ad: k.ad,
    foto: k.foto,
    puan: k.puan,
    seviye: seviye[k.uid],
    rozet: k.rozet,
    bas: () => bas(k),
  }));
  return (
    <>
      <Podyum ogeler={ogeler} vurgu={vurgu} />
      {/* İlk üç podyumda; liste dördüncüden başlıyor. Panel dördüncü yokken
          de çiziliyor: sayfanın alt yarısı boş görselle kalmasın, orada ne
          olacağı da yazsın. */}
      <Panel>
        {veri.length > 3 ? (
          veri.slice(3).map((k) => (
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
          ))
        ) : (
          <Txt size={11.5} color={C.dim2} align="center" style={{ paddingVertical: 22 }}>
            Dördüncü sıradan itibaren burada listelenir
          </Txt>
        )}
      </Panel>
    </>
  );
}

/**
 * Sabit "benim sıram" çubuğu — listenin altında, alt navigasyonun üstünde.
 *
 * Referans uygulamalarda bu çubuk her zaman ekranda: kullanıcı kaçıncı
 * olduğunu görmek için 50 satır kaydırmıyor. Bizde hiç yoktu.
 *
 * Eşleştirme `publicId` ile: sayısal kullanıcı id'si istemcide tutulmuyor ama
 * public id tutuluyor ve sıralama satırları da onu taşıyor. Listede yoksa sıra
 * yerine tire ve dürüst bir açıklama gösteriliyor — uydurma sıra numarası yok.
 */
function BenimSiram({ liste, publicId, ad, foto, vurgu, alt }: {
  liste: SiraKisi[];
  publicId: string | null;
  ad: string;
  foto?: string;
  vurgu: string;
  alt: number;
}) {
  const ben = publicId ? liste.find((k) => k.publicId === publicId) : undefined;
  return (
    <View style={[styles.benimCubuk, { bottom: alt, borderColor: vurgu + "55" }]}>
      <Gradient colors={[vurgu + "26", "transparent"]} deg={110} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.benimSira}>
        <Txt weight="displayBold" size={12.5} color={ben ? vurgu : C.dim2}>{ben ? ben.sira : "—"}</Txt>
      </View>
      <Portrait name={ad} photo={foto} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="extrabold" size={12.5} color="#fff" numberOfLines={1}>{ad}</Txt>
        {!ben && <Txt size={10} color={C.dim} numberOfLines={1} style={{ marginTop: 1 }}>Bu dönemde listeye girmedin</Txt>}
      </View>
      <Puan icon="coin" value={kisalt(ben?.puan ?? 0)} guclu={!!ben} renk={vurgu} />
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
  /** Aktif sekmenin rengi — sayfanın tonunu bu belirliyor. */
  const vurgu = SEKME_RENK[tab] ?? C.gold;

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

  // GEÇİCİ MOCK — kapalı betada liste boş kalıyor, uzun listenin görünümü
  // ölçülemiyordu.  silinince bu üç satır da gider.
  const zenginListe = mockKisiEkle(zengin);
  const cazipListe = mockKisiEkle(cazip);
  const odaListe = mockOdaEkle(hediyeliOdalar);

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
      {/*
        SALON GÖRSELİ SAYFANIN TAMAMINDA — başlık ve sekme şeridi DAHİL.

        Önce yalnız podyumun arkasındaydı, sonra sekme şeridinin altına
        alındı; ikisinde de görselin bittiği yerde ekran ikiye bölünüyordu.
        Referansta arkaplan en tepeden başlıyor, başlık da onun üstünde
        duruyor. Görsel artık kökte: üstünde perde gradyanı (başlık ve liste
        okunaklı kalsın), onun üstünde sekme rengi perdesi.
      */}
      <Image source={SAHNE} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={0} />
      <Gradient
        colors={["rgba(8,8,12,.58)", "rgba(8,8,12,.10)", "rgba(8,8,12,.46)", "rgba(8,8,12,.88)"]}
        deg={180}
        locations={[0, 0.17, 0.58, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/*
        SEKME RENGİ SAHNEYE VURUYOR. `key={tab}` ile her geçişte yeni perde
        sönerek giriyor, eskisi sönerek çıkıyor; ikisi üst üste bindiği için
        renk geçişi ani değil, lambanın rengi değişiyormuş gibi oluyor. Aynı
        salon beş sekmede beş farklı ışıkta görünüyor, ayrı arkaplan üretmeye
        gerek kalmıyor.
      */}
      <Animated.View
        key={tab}
        entering={FadeIn.duration(420)}
        exiting={FadeOut.duration(300)}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Gradient colors={[vurgu + "4D", vurgu + "14", "transparent"]} deg={180} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 10 }}>
          <Txt weight="displayBold" size={18} color="#fff" style={{ letterSpacing: 0.5 }}>Sıralama</Txt>
          {/* Sayaç sunucudan geliyor; "Haftalık · 2g 14s kaldı" sabit yazıydı. */}
          {kalan && (
            <View style={[styles.sureHap, { backgroundColor: vurgu + "1A", borderColor: vurgu + "4D" }]}>
              <Icon name="cal" size={11} color={vurgu} />
              <Txt weight="bold" size={10} color={vurgu}>{periyotAdi} · {kalan}</Txt>
            </View>
          )}
        </View>

        <Tabs items={["Zenginlik", "Cazibe", "Odalar", "Ajanslar", "Yayıncılar"]} active={tab} set={setTab} pad={14} renk={vurgu} />

        {/*
          Gövde sarmalayıcısı: arkaplan artık kökte, burada yalnız yerleşim
          var (dönem hapları + kaydırılan liste).

        */}
        <View style={{ flex: 1 }}>

        {/* Dönem seçici — ilk üç sekme dönemli, ajans/yayıncı henüz değil. */}
        {tab <= 2 && (
          <View style={styles.periyotSatiri}>
            {PERIYOTLAR.map((p) => {
              const secili = p.kod === periyot;
              return (
                <Pressable
                  key={p.kod}
                  onPress={() => { haptic.light(); setPeriyot(p.kod); }}
                  style={[styles.periyotHap, secili && { backgroundColor: vurgu + "2E", borderColor: vurgu + "70" }]}
                >
                  <Txt weight={secili ? "extrabold" : "semibold"} size={10.5} color={secili ? vurgu : C.dim}>
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
              veri={zenginListe}
              bas={kisiyeGit}
              vurgu={vurgu}
              bos={<Bos baslik="Bu dönemde hediye gönderilmedi" alt="Zenginlik sıralaması gönderilen hediyelerin toplam değerine göre hesaplanır." />}
            />
          )}

          {/* ---- Cazibe: en çok hediye alanlar ---- */}
          {tab === 1 && (
            <KisiListesi
              veri={cazipListe}
              bas={kisiyeGit}
              vurgu={vurgu}
              bos={<Bos baslik="Bu dönemde hediye alınmadı" alt="Cazibe sıralaması alınan hediyelerden kalan kazanca göre hesaplanır." />}
            />
          )}

          {/* ---- Odalar: hediye hacmine göre; hiç hediye yoksa kalabalığa göre ---- */}
          {tab === 2 && (
            odaListe.length > 0 ? (
              <>
                <Podyum
                  ogeler={odaListe.slice(0, 3).map((o) => ({
                    ad: o.ad,
                    puan: o.puan,
                    altYazi: o.sahip || "—",
                    icerik: <OdaGorsel kapak={o.kapak} sahne="lounge" />,
                    bas: () => {
                      const r = dbRooms.find((d) => d.dbId === o.odaId);
                      if (r) girOdaya(r);
                    },
                  }))}
                  vurgu={vurgu}
                  tur="oda"
                />
                <Panel>
                  {odaListe.length > 3 ? (
                    odaListe.slice(3).map((o) => (
                      <Pressable
                        key={o.odaId}
                        onPress={() => {
                          const r = dbRooms.find((d) => d.dbId === o.odaId);
                          if (r) girOdaya(r);
                        }}
                      >
                        <Satir n={o.sira}>
                          <OdaKapak kapak={o.kapak} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{o.ad}</Txt>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                              <Icon name="crown" size={10} color={C.gold + "AA"} />
                              <Txt weight="semibold" size={10} color={C.dim} numberOfLines={1}>{o.sahip || "—"}</Txt>
                            </View>
                          </View>
                          <Puan icon="coin" value={kisalt(o.puan)} />
                        </Satir>
                      </Pressable>
                    ))
                  ) : (
                    <Txt size={11.5} color={C.dim2} align="center" style={{ paddingVertical: 22 }}>
                      Dördüncü sıradan itibaren burada listelenir
                    </Txt>
                  )}
                </Panel>
              </>
            ) : kalabalik.length === 0 ? (
              <Bos baslik="Şu an açık oda yok" alt="Odalar aldıkları hediyelere göre sıralanır; henüz hediye dönmediyse en kalabalıklar gösterilir." />
            ) : (
              <>
                <View style={styles.notHap}>
                  <Icon name="user" size={11} color={C.dim} />
                  <Txt weight="semibold" size={10} color={C.dim}>Bu dönemde hediye dönmedi — en kalabalık odalar</Txt>
                </View>
                <Podyum
                  ogeler={kalabalik.slice(0, 3).map((r) => ({
                    ad: r.name,
                    puan: r.online,
                    kisiSayaci: true,
                    altYazi: r.host,
                    icerik: <OdaGorsel kapak={r.photo} sahne={r.scene} />,
                    bas: () => girOdaya(r),
                  }))}
                  vurgu={vurgu}
                  tur="oda"
                />
                <Panel>
                  {kalabalik.length > 3 ? (
                    kalabalik.slice(3).map((r, i) => (
                      <Pressable key={r.id} onPress={() => girOdaya(r)}>
                        <Satir n={i + 4}>
                          <OdaKapak kapak={r.photo} sahne={r.scene} />
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
                  ) : (
                    <Txt size={11.5} color={C.dim2} align="center" style={{ paddingVertical: 22 }}>
                      Dördüncü sıradan itibaren burada listelenir
                    </Txt>
                  )}
                </Panel>
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

        {tab <= 1 && (tab === 0 ? zenginListe : cazipListe).length > 0 && (
          <BenimSiram
            liste={tab === 0 ? zenginListe : cazipListe}
            publicId={benimPublicId}
            ad={benimAd}
            foto={benimFoto || undefined}
            vurgu={vurgu}
            alt={ALT_NAV_YUKSEKLIK + insets.bottom}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
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

  notHap: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    marginBottom: 11, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
  },

  sahne: { marginBottom: 12, paddingTop: 6, paddingBottom: 8 },
  podyum: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 2 },
  // Sütunlar eşit üçte bir; birincinin çerçevesi sütunundan geniş olduğu için
  // komşularının üstüne hafifçe biniyor (referans podyumdaki kenetli düzen).
  podyumSutun: { flex: 1, alignItems: "center", minWidth: 0 },
  podyumAd: { marginTop: 7, maxWidth: "96%" },
  podyumAlt: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, maxWidth: "96%" },
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

  // Satırın kendi zemini YOK: zemin artık panelin. Ayrım ince çizgiyle.
  satir: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)", overflow: "hidden",
  },
  panel: {
    marginHorizontal: -16, marginTop: 6, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    backgroundColor: "rgba(9,8,13,.92)", borderTopWidth: 1, borderColor: "rgba(255,255,255,.08)",
    flexGrow: 1,
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
  odaKapak: { width: 42, height: 42, borderRadius: 13, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },

});
