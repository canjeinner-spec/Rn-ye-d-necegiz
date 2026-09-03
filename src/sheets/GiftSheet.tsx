import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CoinBadge } from "@/components/Coins";
import { GiftIcon } from "@/components/GiftIcon";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { Yukleniyor } from "@/components/Yukleniyor";
import { GIFTS, GIFT_TABS, type Gift } from "@/data/gifts";
import { bakiyem, katalog, type KatalogHediyesi } from "@/data/remote/hediyeRepo";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const ADETLER = [1, 7, 14, 99, 520];

/** Hediye alıcısı — gerçek gönderim için uid gerekir. */
export type HediyeAlicisi = { name: string; uid?: number; photo?: string; host?: boolean; mod?: boolean };

/** Katalog satırını istemcinin Gift tipine çevirir (görseller aynı kalsın). */
function giftYap(k: KatalogHediyesi): Gift {
  return { id: k.kod, emoji: k.emoji, name: k.ad, price: k.fiyat, c1: k.renk1, c2: k.renk2, tier: k.kademe };
}

/**
 * Hediye kutusu.
 *
 * Katalog artık DB'den (`hediyeler`) geliyor ve hediye ALTIN ile gönderiliyor —
 * temel şemanın modeli bu (elmas satın alınan varlık, altına çevriliyor).
 * Eskiden katalog data/gifts.ts sabitiydi ve bakiye elmas gösteriliyordu.
 *
 * 059 uygulanmamışsa katalog boş döner; o zaman yerel sabite düşüyoruz ki
 * ekran boş kalmasın — ama o durumda gönderim yalnızca animasyon oynatır.
 */
export function GiftSheet({
  visible,
  onClose,
  recipients = [],
  onSend,
  onBakiyeYukle,
}: {
  visible: boolean;
  onClose: () => void;
  recipients?: HediyeAlicisi[];
  /** hediyeDbId varsa gönderim GERÇEKTEN yapılır (bakiyeden düşer). */
  onSend: (gift: Gift, qty: number, recipient: string, aliciId?: number, hediyeDbId?: number) => void;
  onBakiyeYukle?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [adetIx, setAdetIx] = useState(0);
  const [adetAcik, setAdetAcik] = useState(false);
  const [hedef, setHedef] = useState(0);
  /** Tek alıcı varsa "Tümü" anlamsız — o kişiyi seçili başlatıyoruz. */
  const tekAlici = recipients.length === 1;
  const [altin, setAltin] = useState<number | null>(null);
  const [veri, setVeri] = useState<KatalogHediyesi[] | null>(null);

  /**
   * TEK ALICI VARSA O SEÇİLİ OLSUN.
   *
   * `hedef` 0 ile başlıyor ve 0 = "Tümü". Profil ekranında alıcı listesi tek
   * kişiden ibaret; kullanıcı ayrıca dokunmadığı sürece "Tümü" seçili kalıyor
   * ve gönderim `aliciId: undefined` ile çıkıyordu → "Alıcı bulunamadı".
   * Tek kişilik bağlamda "Tümü" seçeneği zaten gizleniyor (aşağıda).
   */
  useEffect(() => {
    if (tekAlici) setHedef(1);
  }, [tekAlici]);

  useEffect(() => {
    if (!visible || !isSupabaseConfigured) return;
    let alive = true;
    katalog().then((k) => { if (alive) setVeri(k); }).catch(() => { if (alive) setVeri([]); });
    bakiyem().then((b) => { if (alive && b) setAltin(b.altin); }).catch(() => {});
    return () => { alive = false; };
  }, [visible]);

  // DB kataloğu varsa ondan, yoksa yerel sabitten (görsel tazeliği için).
  const { sekmeler, liste } = useMemo(() => {
    if (veri && veri.length) {
      const kats = [...new Set(veri.map((k) => k.kategori))];
      const aktifKat = kats[Math.min(tab, kats.length - 1)];
      return { sekmeler: kats, liste: veri.filter((k) => k.kategori === aktifKat) };
    }
    const yerel = (GIFTS[tab] || []).map<KatalogHediyesi>((g, i) => ({
      dbId: 0, kod: g.id, ad: g.name, kategori: GIFT_TABS[tab], emoji: g.emoji,
      fiyat: g.price, renk1: g.c1, renk2: g.c2, kademe: g.tier, sira: i,
    }));
    return { sekmeler: GIFT_TABS, liste: yerel };
  }, [veri, tab]);

  /**
   * Karo başına Gift nesnesi BİR KEZ üretiliyor. Eskiden render içinde
   * `giftYap(k)` çağrılıyordu: her render yeni nesne, yani `GiftIcon`
   * memo'su hiç tutmaz ve tek dokunuşta altı Lottie görünümü birden
   * yeniden render edilirdi. Gecikme hissinin kaynağı buydu.
   */
  const karolar = useMemo(() => liste.map((k) => ({ k, g: giftYap(k) })), [liste]);

  const secili = liste.find((g) => g.kod === sel) || null;
  const adet = ADETLER[adetIx];
  /**
   * "Herkese" (hedef 0) ALICI BAŞINA ücretlendiriliyor — sunucu da öyle
   * yapıyor (081). Burada çarpmazsak kullanıcı 100 altın görüp 300 ödüyordu.
   * Odada kimse yoksa çarpan 1 kalır; sunucu zaten "kimse yok" diye reddeder.
   */
  const carpan = hedef === 0 ? Math.max(1, recipients.length) : 1;
  const tutar = secili ? secili.fiyat * adet * carpan : 0;
  const yetersiz = altin != null && tutar > altin;
  const kimeAd = hedef === 0 ? "Herkese" : recipients[hedef - 1]?.name || "Herkese";

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(280)} style={styles.sheet}>
          <Pressable>
            {/* BLUR KALDIRILDI: hemen altindaki gradyanin iki rengi de OPAK
                (#16121F, #0B0A11), yani blur ciziliyor ama tek pikseli
                gorunmuyordu — saf maliyet. expo-blur her karede yeniden
                orneklem yapiyor; sayfa her acilista ve her dokunusta bunu
                bedavaya oduyordu. Alfali gradyanlarin altindaki blur katmanlari
                (BottomNav, CamZemin, modal basliklari) GERCEKTEN gorunuyor,
                onlara dokunulmadi. */}
            <Gradient colors={["#16121F", "#0B0A11"]} deg={170} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Gradient colors={[C.gold + "1A", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />

            <View style={styles.tutamac} />

            <View style={styles.kimeSatiri}>
              {!tekAlici && (
                <Pressable onPress={() => { haptic.select(); setHedef(0); }} style={[styles.tumu, hedef === 0 ? { borderColor: C.gold, backgroundColor: C.gold + "1F" } : { borderColor: "rgba(255,255,255,.12)" }]}>
                  <Icon name="users" size={14} color={hedef === 0 ? C.gold2 : C.dim} />
                  <Txt weight="extrabold" size={11.5} color={hedef === 0 ? C.gold2 : C.dim}>Tümü</Txt>
                </Pressable>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 6 }}>
                {recipients.map((r, i) => {
                  const on = hedef === i + 1;
                  return (
                    <Pressable key={r.name} onPress={() => { haptic.select(); setHedef(i + 1); }} style={{ alignItems: "center", width: 48 }}>
                      <View style={[styles.kisi, { borderColor: on ? C.gold : "transparent" }]}>
                        <Portrait name={r.name} size={38} photo={r.photo} ring={on ? C.gold : "rgba(255,255,255,.16)"} glow={on} />
                      </View>
                      <Txt weight={on ? "extrabold" : "semibold"} size={9} color={on ? C.gold2 : C.dim2} numberOfLines={1} style={{ marginTop: 3, maxWidth: 46 }}>
                        {r.name}
                      </Txt>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {sekmeler.map((t, i) => (
                <Pressable key={t} onPress={() => { haptic.select(); setTab(i); setSel(null); }} style={{ paddingVertical: 11 }}>
                  <Txt weight={i === tab ? "extrabold" : "semibold"} size={12.5} color={i === tab ? C.gold2 : C.dim}>{t}</Txt>
                  {i === tab && <View style={styles.tabCizgi} />}
                </Pressable>
              ))}
            </ScrollView>

            {/* YÜKSEKLİK SABİT, `maxHeight` DEĞİL. Sebebi ölçüldü: yüklenirken
                `Yukleniyor`un 200 ms parlama koruması hiçbir şey çizmiyor, yani
                bu alan 0 yükseklikte kalıyordu. `SlideInDown` (280 ms) tam o
                sırada ölçüm alıp animasyonu kuruyor; veri gelince içerik
                büyüyor ama transform eski ölçüye göre kalıyor ve sayfanın alt
                kısmı ekran dışında kalıyordu ("yarım açılıyor"). Bir hediyeye
                dokununca yeniden yerleşim olduğu için düzeliyordu. Sabit
                yükseklikle ölçü ilk kareden itibaren doğru. */}
            <ScrollView style={{ height: 300 }} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {veri === null && isSupabaseConfigured ? (
                <Yukleniyor dolgu={26} boyut={96} yazi="Hediyeler yükleniyor" style={{ width: "100%" }} />
              ) : (
                karolar.map(({ k, g }) => {
                  const on = sel === k.kod;
                  return (
                    <Pressable
                      key={k.kod}
                      onPress={() => { haptic.select(); setSel(k.kod); }}
                      // Kenarlık YOK: karolar çıplak dursun, görseli çerçevelemesin.
                      // Seçim tek işaretle anlatılıyor — yumuşak zemin.
                      style={[styles.hucre, on && styles.hucreSecili]}
                    >
                      <GiftIcon gift={g} size={58} oynat={on} />
                      <Txt weight="bold" size={9.5} color={on ? "#fff" : C.text} numberOfLines={1} align="center" style={{ marginTop: 5, maxWidth: 72 }}>
                        {k.ad}
                      </Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                        <CoinBadge size={10} />
                        <Txt weight="extrabold" size={9.5} color={C.gold2}>{k.fiyat.toLocaleString("tr-TR")}</Txt>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {adetAcik && (
              <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.adetKutu}>
                {ADETLER.map((a, i) => (
                  <Pressable
                    key={a}
                    onPress={() => { haptic.select(); setAdetIx(i); setAdetAcik(false); }}
                    style={[styles.adetSecim, i === adetIx && { backgroundColor: C.gold + "1F", borderColor: C.gold + "59" }]}
                  >
                    <Txt weight="extrabold" size={12.5} color={i === adetIx ? C.gold2 : C.text}>×{a}</Txt>
                  </Pressable>
                ))}
              </Animated.View>
            )}

            <View style={[styles.alt, { paddingBottom: 14 + insets.bottom }]}>
              {/* Hediye ALTIN ile gönderilir; elmas satın alınıp altına çevrilir. */}
              <Pressable onPress={() => { haptic.light(); onBakiyeYukle?.(); }} style={styles.bakiye}>
                <CoinBadge size={15} />
                <Txt weight="extrabold" size={12.5} color={C.gold2}>
                  {altin == null ? "—" : altin.toLocaleString("tr-TR")}
                </Txt>
                <View style={styles.arti}>
                  <Icon name="plus" size={11} sw={3} color="#241A05" />
                </View>
              </Pressable>

              <View style={{ flex: 1 }} />

              <Pressable onPress={() => { haptic.light(); setAdetAcik((v) => !v); }} style={styles.adetCip}>
                <Txt weight="extrabold" size={13} color={C.text}>×{adet}</Txt>
                <Icon name="chev" size={11} sw={2.4} color={C.dim} />
              </Pressable>

              <Pressable
                disabled={!secili || yetersiz}
                onPress={() => secili && onSend(giftYap(secili), adet, kimeAd, hedef === 0 ? undefined : recipients[hedef - 1]?.uid, secili.dbId || undefined)}
                style={{ borderRadius: 999, overflow: "hidden", opacity: !secili || yetersiz ? 0.5 : 1 }}
              >
                <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.gonder}>
                  <Txt weight="extrabold" size={13.5} color="#241A05">
                    {yetersiz ? "Altın yetmiyor" : "Gönder"}
                  </Txt>
                  {!!secili && !yetersiz && (
                    <View style={styles.tutar}>
                      <Txt weight="extrabold" size={11} color="#3A2A05">{tutar.toLocaleString("tr-TR")}</Txt>
                    </View>
                  )}
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
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.55)" },
  sheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
    backgroundColor: "rgba(10,9,14,.72)",
  },
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 160 },
  tutamac: { alignSelf: "center", width: 38, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.28)", marginTop: 9 },
  kimeSatiri: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  tumu: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  kisi: { borderRadius: 999, padding: 2, borderWidth: 2 },
  tabs: { gap: 18, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.07)" },
  tabCizgi: { position: "absolute", left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 4, backgroundColor: C.gold },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 6 },
  hucre: { width: "23%", alignItems: "center", paddingVertical: 10, borderRadius: 14 },
  hucreSecili: { backgroundColor: "rgba(255,255,255,.08)" },
  adetKutu: { position: "absolute", right: 100, bottom: 74, flexDirection: "row", gap: 6, padding: 6, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", backgroundColor: "rgba(16,15,22,.97)" },
  adetSecim: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: "transparent" },
  alt: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.07)" },
  bakiye: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingLeft: 11, paddingRight: 6, borderRadius: 999, borderWidth: 1, borderColor: C.gold + "38", backgroundColor: C.gold + "12" },
  arti: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.gold2 },
  adetCip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", backgroundColor: "rgba(255,255,255,.05)" },
  gonder: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 20 },
  tutar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(255,255,255,.35)" },
});
