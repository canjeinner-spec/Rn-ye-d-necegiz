import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Sheet } from "@/components/Sheet";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { getMyBalance, listMyLedger, type LedgerRow as LedgerData } from "@/data/remote/walletRepo";
import { getCached, setCached } from "@/lib/cache";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function ledgerZaman(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** İşlem satırı — gerçek defter kaydı (027_cuzdan). */
function RealLedgerRow({ tx }: { tx: LedgerData }) {
  const pos = tx.miktar > 0;
  const ton = tx.varlik === "elmas" ? "#22D3EE" : C.gold;
  return (
    <View style={styles.ledgerRow}>
      <View style={[styles.ledgerIcon, { backgroundColor: ton + "16", borderColor: ton + "38" }]}>
        {tx.varlik === "elmas" ? <DiamondBadge size={18} /> : <CoinBadge size={18} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="bold" size={12.5} color={C.text} numberOfLines={1}>{tx.sebep || (pos ? "Yükleme" : "Harcama")}</Txt>
        <Txt weight="semibold" size={10} color={C.dim2} style={{ marginTop: 2 }}>{ledgerZaman(tx.at)}</Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Txt weight="extrabold" size={13.5} color={pos ? "#6EE7B7" : "#FB7185"}>{pos ? "+" : "−"}</Txt>
        {tx.varlik === "elmas" ? <DiamondBadge size={13} /> : <CoinBadge size={13} />}
        <Txt weight="extrabold" size={13.5} color={pos ? "#6EE7B7" : "#FB7185"}>{Math.abs(tx.miktar).toLocaleString("tr-TR")}</Txt>
      </View>
    </View>
  );
}

/** İşlem listesi kabı — satırlar arası ince ayırıcıyla tek kart. */
function LedgerGroup({ children }: { children: React.ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={styles.ledgerGroup}>
      {items.map((c, i) => (
        <View key={i}>
          {i > 0 && <View style={styles.ledgerDivider} />}
          {c}
        </View>
      ))}
    </View>
  );
}

function StatCard({ label, sub, accent, children }: { label: string; sub: string; accent: string; children: React.ReactNode }) {
  return (
    <View style={[styles.statCard, { borderColor: accent + "30" }]}>
      <Gradient colors={[accent + "1A", "transparent"]} deg={160} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Txt weight="bold" size={9.5} color={C.dim} style={{ letterSpacing: 0.4 }}>{label.toUpperCase()}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>{children}</View>
      <Txt weight="semibold" size={9.5} color={C.dim2} style={{ marginTop: 4 }}>{sub}</Txt>
    </View>
  );
}

/** Hiç işlem yokken — sahte örnek satırlar yerine dürüst boş durum. */
function BosDefter() {
  return (
    <View style={styles.bos}>
      <View style={styles.bosIkon}>
        <Icon name="wallet" size={22} color={C.gold} />
      </View>
      <Txt weight="displayBold" size={14} color="#fff" style={{ marginTop: 13 }}>Henüz işlem yok</Txt>
      <Txt size={11.5} color={C.dim} align="center" lh={1.5} style={{ marginTop: 7, maxWidth: 250 }}>
        Elmas yüklediğinde veya hediye gönderdiğinde işlemlerin burada listelenir.
      </Txt>
    </View>
  );
}

/** Hızlı işlem düğmesi — emoji yerine ikon setinden. */
function Quick({ icon, label, tint, onPress, children }: { icon?: IconName; label: string; tint: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={[styles.quick, { borderColor: tint + "3D" }]}>
      <Gradient colors={[tint + "1F", "transparent"]} deg={160} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.quickIcon, { backgroundColor: tint + "1A", borderColor: tint + "3D" }]}>
        {children ?? (icon ? <Icon name={icon} size={18} color={tint} /> : null)}
      </View>
      <Txt weight="extrabold" size={11} color={tint}>{label}</Txt>
    </Pressable>
  );
}

export default function WalletScreen() {
  const router = useRouter();
  const isStreamer = useApp((s) => s.isStreamer);
  const [tab, setTab] = useState(0);
  const [stub, setStub] = useState<string | null>(null);

  // Gerçek bakiye + işlem defteri (027_cuzdan); cache-first (son değeri anında
  // göster, arkada tazele) — bakiye 0'dan dolmaz, son bilinen görünür.
  const [bal, setBal] = useState<{ elmas: number; altin: number }>(() => getCached("wallet:bal") ?? { elmas: 0, altin: 0 });
  const [ledger, setLedger] = useState<LedgerData[]>(() => getCached<LedgerData[]>("wallet:ledger") ?? []);
  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured) return;
      let alive = true;
      getMyBalance().then((b) => { if (alive) { setBal(b); setCached("wallet:bal", b, true); } }).catch(() => {});
      listMyLedger().then((l) => { if (alive) { setLedger(l); setCached("wallet:ledger", l, true); } }).catch(() => {});
      return () => { alive = false; };
    }, []),
  );
  const altin = bal.altin;
  const diamonds = bal.elmas;

  return (
    <View style={styles.root}>
      {/* Uygulamanın siyah-altın teması. Ekran daha önce mor/camgöbeğiydi
          (#1A1430 zemin, mor sekmeler, camgöbeği kart) ve temadan kopuktu. */}
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={180} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1F", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Cüzdan</Txt>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setStub("Cüzdan Kuralları")} style={styles.rulesBtn}>
            <Txt weight="bold" size={11.5} color={C.dim}>Kurallar</Txt>
          </Pressable>
        </View>

        <Tabs items={["Genel", "İşlem Geçmişi"]} active={tab} set={setTab} fill pad={16} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              {/* Bakiye kartı — siyah cam + altın kenar ve tepede ince parıltı. */}
              <View style={styles.hero}>
                <Gradient colors={["rgba(232,179,65,.16)", "rgba(232,179,65,.04)", "transparent"]} deg={155} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <View style={styles.heroSheen} pointerEvents="none" />
                <View style={styles.heroGlow} pointerEvents="none" />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Icon name="wallet" size={14} color={C.gold2} />
                  <Txt weight="bold" size={10.5} color={C.gold2} style={{ letterSpacing: 0.6 }}>ELMAS BAKİYEM</Txt>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginTop: 10 }}>
                  <DiamondBadge size={32} />
                  <Txt weight="displayBold" size={38} color="#fff">{diamonds.toLocaleString("tr-TR")}</Txt>
                </View>

                <View style={styles.heroDivider} />
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <CoinBadge size={15} />
                    <Txt weight="extrabold" size={13} color="#FEF3C7">{altin.toLocaleString("tr-TR")}</Txt>
                    <Txt weight="semibold" size={10.5} color={C.dim}>altın</Txt>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Txt weight="semibold" size={10} color={C.dim2}>Hediye ve mağaza için</Txt>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                {isStreamer ? (
                  <>
                    <StatCard label="Coin Kazancı" sub="Hediyelerden kazanıldı" accent={C.gold}>
                      <CoinBadge size={17} />
                      <Txt weight="displayBold" size={19} color="#fff">{altin.toLocaleString("tr-TR")}</Txt>
                    </StatCard>
                    {/* Ödeme/çekim sistemi henüz yok — uydurma tutar yerine "—". */}
                    <StatCard label="Çekilebilir" sub="Ödeme sistemi yakında" accent="#34D399">
                      <Txt weight="displayBold" size={19} color={C.dim}>—</Txt>
                    </StatCard>
                  </>
                ) : (
                  <>
                    <StatCard label="Elmas" sub="Harcanabilir" accent="#22D3EE">
                      <DiamondBadge size={17} />
                      <Txt weight="displayBold" size={19} color="#fff">{diamonds.toLocaleString("tr-TR")}</Txt>
                    </StatCard>
                    <StatCard label="Altın" sub="Oda & etkinlik" accent={C.gold}>
                      <CoinBadge size={17} />
                      <Txt weight="displayBold" size={19} color="#fff">{altin.toLocaleString("tr-TR")}</Txt>
                    </StatCard>
                  </>
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Quick label="Elmas Yükle" tint="#22D3EE" onPress={() => { haptic.light(); router.navigate("/diamond-load"); }}>
                  <DiamondBadge size={20} />
                </Quick>
                {isStreamer && (
                  <Quick icon="bank" label="Para Çek" tint="#6EE7B7" onPress={() => { haptic.light(); router.navigate("/withdraw"); }} />
                )}
                <Quick icon="clipboard" label="Faturalar" tint={C.gold2} onPress={() => { haptic.light(); setStub("Faturalar"); }} />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 22, marginBottom: 10 }}>
                <Txt weight="displayBold" size={13.5} color="#fff">Son İşlemler</Txt>
                <View style={{ flex: 1 }} />
                {ledger.length > 3 && (
                  <Pressable onPress={() => setTab(1)} hitSlop={8}>
                    <Txt weight="bold" size={11.5} color={C.gold2}>Tümü ›</Txt>
                  </Pressable>
                )}
              </View>
              {/* Kayıt yokken sahte örnek işlemler basılıyordu ve "Genel"
                  sekmesinde bunun örnek olduğuna dair hiçbir not yoktu. */}
              {ledger.length > 0 ? (
                <LedgerGroup>{ledger.slice(0, 4).map((tx) => <RealLedgerRow key={tx.id} tx={tx} />)}</LedgerGroup>
              ) : (
                <BosDefter />
              )}
            </>
          ) : ledger.length > 0 ? (
            <LedgerGroup>{ledger.map((tx) => <RealLedgerRow key={tx.id} tx={tx} />)}</LedgerGroup>
          ) : (
            <BosDefter />
          )}
        </ScrollView>
      </SafeAreaView>

      <Sheet visible={!!stub} onClose={() => setStub(null)} contentStyle={{ alignItems: "center" }}>
        <View style={styles.bosIkon}>
          <Icon name="clipboard" size={22} color={C.gold} />
        </View>
        <Txt weight="displayBold" size={14.5} color="#fff" style={{ marginTop: 13 }}>{stub}</Txt>
        <Txt size={11.5} color={C.dim} align="center" lh={1.5} style={{ marginTop: 7, marginBottom: 6, maxWidth: 250 }}>
          Bu bölüm yakında açılacak.
        </Txt>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 240 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  rulesBtn: { height: 30, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 6, backgroundColor: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4 },
  tabInner: { paddingVertical: 9, alignItems: "center", borderRadius: 11 },
  hero: { borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.gold + "3D", backgroundColor: "rgba(18,15,24,.72)", overflow: "hidden" },
  heroSheen: { position: "absolute", top: 0, left: 26, right: 26, height: 1, backgroundColor: "rgba(255,255,255,.30)" },
  heroGlow: { position: "absolute", right: -46, top: -56, width: 170, height: 170, borderRadius: 85, backgroundColor: C.gold + "1F" },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.13)", marginTop: 16, marginBottom: 12 },
  statCard: { flex: 1, minWidth: 0, borderRadius: 18, padding: 14, borderWidth: 1, backgroundColor: "rgba(255,255,255,.04)", overflow: "hidden" },
  quick: { flex: 1, alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1, backgroundColor: "rgba(255,255,255,.04)", overflow: "hidden" },
  quickIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  ledgerGroup: { borderRadius: 18, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", overflow: "hidden" },
  ledgerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 13 },
  ledgerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.08)", marginLeft: 65 },
  ledgerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  bos: { alignItems: "center", paddingVertical: 34, paddingHorizontal: 18, borderRadius: 18, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  bosIkon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "3D" },
});
