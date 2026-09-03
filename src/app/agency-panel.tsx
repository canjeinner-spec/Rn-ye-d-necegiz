import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AgencyEmblem } from "@/components/AgencyEmblem";
import { Badge } from "@/components/Badge";
import { CenterModal } from "@/components/CenterModal";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { AGENCY_MEMBERS, type AgencyMember } from "@/data/agency";
import {
  kazancGunluk,
  kazancOzeti,
  kazancSaatlik,
  komisyonOrani,
  sonHediyelerim,
  type GelenHediye,
  type GunDilimi,
  type KazancOzeti,
  type SaatDilimi,
} from "@/data/remote/hediyeRepo";
import { SEARCH_DIR } from "@/data/search";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

const GUN_ADI = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/** "14:05" — son hediyeler listesindeki saat. */
function saatBicimi(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Yayıncı Paneli.
 *
 * Eski hâli baştan sona YEŞİLDİ: zemin koyu yeşil (#0C2418), kazanç kartı
 * yeşil, sekmeler yeşil dolu butonlar, çubuk grafiği yeşil, "Para Çek" yeşil,
 * komisyon çipi yeşil. Uygulamanın geri kalanı siyah-altın. Ayrıca altın
 * karşılığı "🪙" emojisiyle yazılıyordu ve grafikte hep 6. çubuk vurguluydu
 * (veriyle ilgisi olmayan sabit).
 *
 * ⚠️ Rakamlar hâlâ örnek veri: kazanç, yayın süresi, üye listesi ve ciro
 * data/agency.ts sabitlerinden geliyor. Gerçeğe bağlanması hediye ekonomisine
 * (gönderilen hediyenin bakiyeden düşüp alıcıya yazılması) bağlı.
 */
export default function AgencyPanelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [members, setMembers] = useState<AgencyMember[]>(AGENCY_MEMBERS);
  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState("");
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Gerçek kazanç (058 hediye defteri) --------------------------------
  const [ozet, setOzet] = useState<KazancOzeti | null>(null);
  const [saatlik, setSaatlik] = useState<SaatDilimi[]>([]);
  const [gunluk, setGunluk] = useState<GunDilimi[]>([]);
  const [sonlar, setSonlar] = useState<GelenHediye[]>([]);
  const [komisyon, setKomisyon] = useState(0.3);
  /** 0 = bugün, 1 = dün */
  const [gunOnce, setGunOnce] = useState(0);

  const yukle = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const [o, g, h, k] = await Promise.all([
        kazancOzeti(),
        kazancGunluk(7),
        sonHediyelerim(15),
        komisyonOrani(),
      ]);
      setOzet(o);
      setGunluk(g);
      setSonlar(h);
      setKomisyon(k);
    } catch (e) {
      console.warn("[kazanc]", (e as Error)?.message || e);
    }
  }, []);

  useFocusEffect(useCallback(() => { yukle(); }, [yukle]));

  // Saatlik kırılım gün seçimine bağlı — ayrı yükleniyor.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    kazancSaatlik(gunOnce)
      .then((r) => { if (alive) setSaatlik(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [gunOnce]);

  const saatlikMax = Math.max(0, ...saatlik.map((x) => x.altin));
  const enIyiSaat = saatlik.find((x) => x.altin === saatlikMax)?.saat ?? 0;
  const gunlukMax = Math.max(0, ...gunluk.map((x) => x.altin));
  const haftaToplam = gunluk.reduce((t, x) => t + x.altin, 0);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const note = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 1800);
  };
  const removeMember = (name: string) => { haptic.medium(); setMembers((ms) => ms.filter((x) => x.name !== name)); note(`${name} ajanstan çıkarıldı.`); };
  const addMember = () => {
    const u = SEARCH_DIR[addId.trim()];
    if (!u || u.kind !== "user") { haptic.warning(); note("Bu ID'de kullanıcı bulunamadı."); return; }
    if (members.some((m) => m.name === u.name)) { note("Zaten ajansta."); setAddOpen(false); return; }
    haptic.success();
    setMembers((ms) => [...ms, { name: u.name, role: "streamer", coins: "0", hours: 0, active: true }]);
    setAddOpen(false); setAddId(""); note(`${u.name} ajansa eklendi.`);
  };

  return (
    <View style={styles.root}>
      <Zemin />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Yayıncı Paneli</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        {/* İki dolu yeşil buton yerine ortak Tabs (kayan altın çizgi) */}
        <Tabs items={["Yayıncı", "Ajansım"]} active={tab} set={setTab} fill pad={16} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              {/* Kazanç kartı — artık gerçek: hediye defterinden (058) */}
              <View style={styles.kazancKart}>
                <Gradient colors={[C.gold + "1F", "rgba(255,255,255,.02)"]} deg={150} style={StyleSheet.absoluteFill} />

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Txt weight="bold" size={10} color={C.gold2} style={{ letterSpacing: 0.8 }}>BU AY TOPLAM KAZANÇ</Txt>
                  <View style={{ flex: 1 }} />
                  <View style={styles.komisyonCip}>
                    <Txt weight="bold" size={8.5} color={C.dim2} style={{ letterSpacing: 0.5 }}>
                      PLATFORM PAYI %{Math.round(komisyon * 100)}
                    </Txt>
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 }}>
                  <CoinBadge size={20} />
                  <Txt weight="displayBold" size={32} color="#fff">
                    {ozet ? ozet.buAy.toLocaleString("tr-TR") : "—"}
                  </Txt>
                </View>
                <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 4 }}>
                  Bugün {ozet ? ozet.bugun.toLocaleString("tr-TR") : "0"} · Tüm zamanlar {ozet ? ozet.toplam.toLocaleString("tr-TR") : "0"}
                </Txt>

                <View style={styles.statSerit}>
                  {([
                    [ozet ? String(ozet.hediyeAy) : "0", "Alınan hediye"],
                    [ozet ? String(ozet.kisiAy) : "0", "Gönderen kişi"],
                    [ozet ? ozet.komisyon.toLocaleString("tr-TR") : "0", "Kesilen pay"],
                  ] as const).map(([v, l], i) => (
                    <View key={l} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                      {i > 0 && <View style={styles.statAyirici} />}
                      <View style={{ flex: 1, alignItems: i === 0 ? "flex-start" : "center" }}>
                        <Txt weight="displayBold" size={15} color="#fff">{v}</Txt>
                        <Txt weight="semibold" size={9.5} color={C.dim} style={{ marginTop: 2 }}>{l}</Txt>
                      </View>
                    </View>
                  ))}
                </View>

                <Pressable onPress={() => { haptic.light(); router.navigate("/withdraw"); }} style={styles.cekSarma}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.cekBtn}>
                    <Icon name="bank" size={15} color="#241A05" />
                    <Txt weight="extrabold" size={13} color="#241A05">Para Çek</Txt>
                  </Gradient>
                </Pressable>
              </View>

              {/* Saatlik kırılım — hangi saatte ne kazanıldığı hiç yoktu */}
              <View style={styles.bolumBasi}>
                <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.8 }}>SAATLİK KAZANÇ</Txt>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(["Bugün", "Dün"] as const).map((lbl, i) => (
                    <Pressable
                      key={lbl}
                      onPress={() => { haptic.select(); setGunOnce(i); }}
                      style={[styles.miniCip, gunOnce === i && { borderColor: C.gold + "66", backgroundColor: C.gold + "1A" }]}
                    >
                      <Txt weight="extrabold" size={10} color={gunOnce === i ? C.gold2 : C.dim}>{lbl}</Txt>
                    </Pressable>
                  ))}
                </View>
              </View>

              {saatlikMax === 0 ? (
                <View style={styles.bosKutu}>
                  <Txt weight="semibold" size={11.5} color={C.dim} align="center">
                    {gunOnce === 0 ? "Bugün henüz hediye almadın." : "Dün hediye almamışsın."}
                  </Txt>
                </View>
              ) : (
                <>
                  <View style={styles.saatGrafik}>
                    {saatlik.map((s) => (
                      <View key={s.saat} style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                        <View style={styles.saatYuva}>
                          <View style={{ height: `${(s.altin / saatlikMax) * 100}%`, width: "100%", justifyContent: "flex-end" }}>
                            {s.altin > 0 ? (
                              <Gradient colors={[C.gold2, "#B4802A"]} deg={180} style={styles.saatCubuk} />
                            ) : (
                              <View style={styles.saatCubuk} />
                            )}
                          </View>
                        </View>
                        {s.saat % 6 === 0 && <Txt weight="semibold" size={8} color={C.dim2}>{s.saat}</Txt>}
                      </View>
                    ))}
                  </View>
                  <Txt weight="semibold" size={10} color={C.dim2} align="center" style={{ marginTop: 6 }}>
                    En iyi saat: {enIyiSaat}:00 · {saatlikMax.toLocaleString("tr-TR")} altın
                  </Txt>
                </>
              )}

              <View style={styles.bolumBasi}>
                <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.8 }}>SON 7 GÜN</Txt>
                <Txt weight="bold" size={10} color={C.dim2}>{haftaToplam.toLocaleString("tr-TR")} altın</Txt>
              </View>

              <View style={styles.grafik}>
                {gunluk.map((g, i) => {
                  const zirve = gunlukMax > 0 && g.altin === gunlukMax;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      <Txt weight="bold" size={9} color={zirve ? C.gold2 : C.dim2}>
                        {g.altin >= 1000 ? `${Math.round(g.altin / 1000)}K` : g.altin}
                      </Txt>
                      <View style={styles.cubukYuva}>
                        <View style={{ height: gunlukMax > 0 ? `${(g.altin / gunlukMax) * 100}%` : "0%", width: "100%", justifyContent: "flex-end" }}>
                          {zirve ? (
                            <Gradient colors={[C.gold2, "#B4802A"]} deg={180} style={styles.cubuk} />
                          ) : (
                            <View style={[styles.cubuk, { backgroundColor: C.gold + "2E", borderColor: C.gold + "3D" }]} />
                          )}
                        </View>
                      </View>
                      <Txt weight="semibold" size={9} color={zirve ? C.gold2 : C.dim2}>{GUN_ADI[new Date(g.gun).getDay()]}</Txt>
                    </View>
                  );
                })}
              </View>

              {/* Son gelen hediyeler — kimden, ne, ne kazandırdı */}
              <View style={styles.bolumBasi}>
                <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.8 }}>SON GELEN HEDİYELER</Txt>
              </View>
              {sonlar.length === 0 ? (
                <View style={styles.bosKutu}>
                  <Txt weight="semibold" size={11.5} color={C.dim} align="center">Henüz hediye almadın.</Txt>
                </View>
              ) : (
                sonlar.map((h) => (
                  <View key={h.id} style={styles.hediyeSatiri}>
                    <View style={styles.hediyeIkon}>
                      <Txt size={17}>{h.emoji}</Txt>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>
                        {h.hediyeAd} <Txt weight="bold" size={11.5} color={C.gold2}>×{h.adet}</Txt>
                      </Txt>
                      <Txt weight="semibold" size={10} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>
                        {h.gonderen} · {saatBicimi(h.tarih)}
                      </Txt>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <CoinBadge size={12} />
                      <Txt weight="extrabold" size={12} color={C.gold2}>+{h.kazanc.toLocaleString("tr-TR")}</Txt>
                    </View>
                  </View>
                ))
              )}
              <View style={styles.bolumBasi}>
                <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.8 }}>BAĞLI OLDUĞUN AJANS</Txt>
              </View>
              <View style={styles.ajansSatiri}>
                <AgencyEmblem s={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="extrabold" size={13.5} color={C.text} numberOfLines={1}>Aron Stars</Txt>
                  <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>Sahip: Ardaowski · 48 üye</Txt>
                </View>
                <View style={styles.komisyon}>
                  <Txt weight="extrabold" size={10} color={C.gold2}>%70</Txt>
                  <Txt weight="semibold" size={8.5} color={C.dim2}>komisyon</Txt>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.ajansKart}>
                <Gradient colors={[C.gold + "24", "rgba(255,255,255,.02)"]} deg={150} style={StyleSheet.absoluteFill} />
                <AgencyEmblem s={50} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="displayBold" size={17} color="#fff" numberOfLines={1}>Aron Stars</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <View style={styles.idCip}>
                      <Txt weight="bold" size={9} color={C.gold2}>ID 1</Txt>
                    </View>
                    <View style={styles.siraCip}>
                      <Icon name="trophy" size={9} color={C.gold2} />
                      <Txt weight="bold" size={9} color={C.gold2}>#1</Txt>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }}>
                    <DiamondBadge size={13} />
                    <Txt weight="extrabold" size={13} color="#67E8F9">12.6M</Txt>
                    <Txt weight="semibold" size={10} color={C.dim}>aylık ciro</Txt>
                  </View>
                </View>
              </View>

              <View style={styles.bolumBasi}>
                <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.8 }}>ÜYELER · {members.length}</Txt>
                <Pressable onPress={() => { haptic.light(); setAddOpen(true); }} style={{ borderRadius: 999, overflow: "hidden" }}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.ekleBtn}>
                    <Icon name="userAdd" size={13} color="#241A05" />
                    <Txt weight="extrabold" size={11} color="#241A05">Üye Ekle</Txt>
                  </Gradient>
                </Pressable>
              </View>

              {members.map((m) => (
                <View key={m.name} style={styles.uyeSatiri}>
                  <Portrait name={m.name} size={42} online={m.active} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{m.name}</Txt>
                      <Badge type="streamer" size={14} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 3 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <CoinBadge size={10} />
                        <Txt weight="semibold" size={10} color={C.dim}>{m.coins}</Txt>
                      </View>
                      <Txt weight="semibold" size={10} color={C.dim}>{m.hours} sa</Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={[styles.nokta, { backgroundColor: m.active ? C.green : C.dim2 }]} />
                        <Txt weight="semibold" size={10} color={m.active ? C.green : C.dim2}>{m.active ? "Aktif" : "Pasif"}</Txt>
                      </View>
                    </View>
                  </View>
                  <Pressable onPress={() => removeMember(m.name)} style={styles.cikarBtn}>
                    <Icon name="trash" size={15} color={C.red} />
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <CenterModal visible={addOpen} onClose={() => setAddOpen(false)}>
        <View style={styles.dialog}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View style={styles.dialogIkon}>
              <Icon name="userAdd" size={17} color={C.gold2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="displayBold" size={16.5} color="#fff">Ajansa Üye Ekle</Txt>
              <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>Yayıncının ID'sini gir</Txt>
            </View>
          </View>

          <View style={styles.girisKutu}>
            <Icon name="search" size={16} color={C.dim} />
            <TextInput
              autoFocus
              value={addId}
              onChangeText={(t) => setAddId(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Yayıncı ID (örn: 8821)"
              placeholderTextColor={C.dim2}
              style={{ flex: 1, color: C.text, fontSize: 14, padding: 0, fontFamily: "PlusJakartaSans_700Bold" }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <Pressable onPress={() => setAddOpen(false)} style={[styles.dialogBtn, { flex: 1, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line }]}>
              <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
            </Pressable>
            <Pressable onPress={addMember} disabled={addId.length < 3} style={{ flex: 1, borderRadius: 14, overflow: "hidden", opacity: addId.length < 3 ? 0.45 : 1 }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.dialogBtn}>
                <Txt weight="extrabold" size={13} color="#241A05">Ekle</Txt>
              </Gradient>
            </Pressable>
          </View>
        </View>
      </CenterModal>

      {!!toast && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.toast, { bottom: 24 + insets.bottom }]}>
          <Txt weight="bold" size={12} color="#fff">{toast}</Txt>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },

  kazancKart: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.gold + "3D", overflow: "hidden" },
  komisyonCip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1, borderColor: "rgba(255,255,255,.10)", backgroundColor: "rgba(255,255,255,.04)" },
  miniCip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", backgroundColor: "rgba(255,255,255,.04)" },
  bosKutu: { paddingVertical: 26, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,.08)", backgroundColor: "rgba(255,255,255,.03)" },
  saatGrafik: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 92 },
  saatYuva: { width: "100%", flex: 1, justifyContent: "flex-end", borderRadius: 3, backgroundColor: "rgba(255,255,255,.035)" },
  saatCubuk: { flex: 1, borderRadius: 3, backgroundColor: C.gold + "24" },
  hediyeSatiri: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 15, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", marginBottom: 8 },
  hediyeIkon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.gold + "33", backgroundColor: C.gold + "14" },
  statSerit: { flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,.12)" },
  statAyirici: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: "rgba(255,255,255,.12)" },
  cekSarma: { marginTop: 16, borderRadius: 14, overflow: "hidden" },
  cekBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13 },

  bolumBasi: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 11 },
  grafik: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, paddingHorizontal: 4 },
  cubukYuva: { width: "100%", maxWidth: 26, height: 92, justifyContent: "flex-end", borderRadius: 7, backgroundColor: "rgba(255,255,255,.035)" },
  cubuk: { flex: 1, borderRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 1, borderColor: "transparent" },

  ajansSatiri: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  komisyon: { alignItems: "center", paddingVertical: 5, paddingHorizontal: 11, borderRadius: 11, backgroundColor: C.gold + "14", borderWidth: 1, borderColor: C.gold + "3D" },

  ajansKart: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.gold + "3D", overflow: "hidden" },
  idCip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1, borderColor: C.gold + "33", backgroundColor: C.gold + "14" },
  siraCip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, borderWidth: 1, borderColor: C.gold + "33", backgroundColor: C.gold + "14" },

  ekleBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 13 },
  uyeSatiri: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", marginBottom: 9 },
  nokta: { width: 6, height: 6, borderRadius: 3 },
  cikarBtn: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.red + "14", borderWidth: 1, borderColor: C.red + "33" },

  dialog: { borderRadius: 24, padding: 20, backgroundColor: "#12111A", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  dialogIkon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "33" },
  girisKutu: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 16, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14 },
  dialogBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  toast: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: `${C.gold}55`, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
});
