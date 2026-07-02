import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import {
  changePublicId, getAdminCounts, getUserDetail, grantBalance, micBan, micUnban,
  resetPassword, searchUsers, setPlatformRole, type AdminUserDetail,
} from "@/data/remote/adminRepo";
import { listReports, setReportStatus, type ReportRow } from "@/data/remote/reportRepo";
import { type PublicProfile } from "@/data/remote/profileRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function zaman(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const ROLE_LABEL: Record<string, string> = { user: "Kullanıcı", developer: "Geliştirici", super_admin: "Süper Yönetici" };

// ============================================================================
// Kullanıcı Detay Sheet — panelin kalbi (arama sonucu / rapor hedefi buraya açar)
// ============================================================================
function UserDetailSheet({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const router = useRouter();
  const myRole = useApp((s) => s.role);
  const isDev = myRole === "developer";
  const [d, setD] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // aksiyon girdileri
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"elmas" | "altin">("elmas");
  const [banReason, setBanReason] = useState("");
  const [banMin, setBanMin] = useState<number | null | "manual">(60);
  const [banManual, setBanManual] = useState("");
  const [newId, setNewId] = useState("");
  const [newPw, setNewPw] = useState("");

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2200); };
  const load = useCallback(() => {
    if (userId == null) return;
    setLoading(true);
    getUserDetail(userId).then(setD).catch((e) => flash(e?.message || "Yüklenemedi")).finally(() => setLoading(false));
  }, [userId]);
  useEffect(() => { if (userId != null) { setD(null); setAmount(""); setBanReason(""); setNewId(""); setNewPw(""); load(); } }, [userId, load]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); flash(ok); load(); }
    catch (e) { flash((e as Error)?.message || "İşlem başarısız"); }
    finally { setBusy(false); }
  };

  const doGrant = (sign: 1 | -1) => {
    const n = parseInt(amount, 10);
    if (!n || n <= 0 || !d) return flash("Geçerli miktar gir");
    run(() => grantBalance(d.id, asset, sign * n, "Yönetici işlemi"), `${asset === "elmas" ? "Elmas" : "Altın"} ${sign > 0 ? "eklendi" : "düşüldü"}`).then(() => setAmount(""));
  };
  const doBan = () => {
    if (!d) return;
    const mins = banMin === "manual" ? parseInt(banManual, 10) : banMin;
    if (banMin === "manual" && (!mins || mins <= 0)) return flash("Süre gir (dakika)");
    run(() => micBan(d.id, banReason.trim() || null, mins as number | null), "Mic yasağı verildi").then(() => setBanReason(""));
  };

  return (
    <Sheet visible={userId != null} onClose={onClose}>
      {loading || !d ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator color={C.gold} /></View>
      ) : (
        <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* başlık */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Portrait name={d.name} size={54} photo={d.photo} ring={d.rol === "user" ? undefined : C.gold} glow={d.rol !== "user"} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="displayBold" size={16} color="#fff" numberOfLines={1}>{d.name}</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                <Txt weight="semibold" size={11} color={C.dim}>ID: {d.publicId}</Txt>
                <View style={styles.rolePill}><Txt weight="extrabold" size={9} color={C.gold2}>{ROLE_LABEL[d.rol] || d.rol}</Txt></View>
              </View>
            </View>
          </View>

          {/* özet */}
          <View style={styles.summary}>
            <View style={styles.sumCol}><DiamondBadge size={15} /><Txt weight="displayBold" size={15} color="#fff">{d.elmas.toLocaleString("tr-TR")}</Txt></View>
            <View style={styles.sumDiv} />
            <View style={styles.sumCol}><CoinBadge size={15} /><Txt weight="displayBold" size={15} color="#fff">{d.altin.toLocaleString("tr-TR")}</Txt></View>
            <View style={styles.sumDiv} />
            <View style={styles.sumCol}><Txt weight="displayBold" size={15} color="#5EEAD4">LV.{d.level}</Txt></View>
            <View style={styles.sumDiv} />
            <View style={styles.sumCol}><Txt weight="displayBold" size={15} color={d.raporSayisi > 0 ? "#FB7185" : "#fff"}>{d.raporSayisi}</Txt><Txt size={8.5} color={C.dim2}>rapor</Txt></View>
          </View>

          {isDev && d.email && (
            <View style={styles.infoRow}><Txt weight="bold" size={10.5} color={C.dim2}>E-POSTA</Txt><Txt size={12} color={C.text} style={{ marginTop: 2 }}>{d.email}</Txt></View>
          )}

          {!!note && <View style={styles.note}><Txt weight="bold" size={11.5} color={C.gold2} align="center">{note}</Txt></View>}

          {/* Mic yasağı */}
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>MİKROFON YASAĞI</Txt>
          {d.micBanned ? (
            <View style={styles.group}>
              <View style={styles.gRow}>
                <View style={{ flex: 1 }}>
                  <Txt weight="extrabold" size={12.5} color="#FB7185">Yasaklı</Txt>
                  <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>
                    {d.micBitis ? `Bitiş: ${zaman(d.micBitis)}` : "Kalıcı"}{d.micSebep ? ` · ${d.micSebep}` : ""}
                  </Txt>
                </View>
                <Pressable disabled={busy} onPress={() => run(() => micUnban(d.id), "Yasak kaldırıldı")} style={[styles.chip, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}>
                  <Txt weight="bold" size={10.5} color={C.green}>Kaldır</Txt>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.group}>
              <View style={{ padding: 12, gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {([["30dk", 30], ["1s", 60], ["1g", 1440], ["7g", 10080], ["Kalıcı", null], ["Manuel", "manual"]] as const).map(([lb, v]) => (
                    <Pressable key={lb} onPress={() => setBanMin(v as number | null | "manual")} style={[styles.chip, banMin === v && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                      <Txt weight="bold" size={10.5} color={banMin === v ? C.gold2 : C.dim}>{lb}</Txt>
                    </Pressable>
                  ))}
                </View>
                {banMin === "manual" && (
                  <TextInput value={banManual} onChangeText={setBanManual} keyboardType="number-pad" placeholder="Dakika" placeholderTextColor={C.dim2} style={styles.input} />
                )}
                <TextInput value={banReason} onChangeText={setBanReason} placeholder="Sebep (opsiyonel)" placeholderTextColor={C.dim2} style={styles.input} />
                <Pressable disabled={busy} onPress={doBan} style={styles.dangerBtn}>
                  <Icon name="micoff" size={14} color="#FB7185" />
                  <Txt weight="extrabold" size={12} color="#FB7185">Mikrofon Yasağı Ver</Txt>
                </Pressable>
              </View>
            </View>
          )}

          {/* Bakiye işlemi */}
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>BAKİYE İŞLEMİ</Txt>
          <View style={styles.group}>
            <View style={{ padding: 12, gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(["elmas", "altin"] as const).map((a) => (
                  <Pressable key={a} onPress={() => setAsset(a)} style={[styles.chip, { flexDirection: "row", gap: 5 }, asset === a && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                    {a === "elmas" ? <DiamondBadge size={13} /> : <CoinBadge size={13} />}
                    <Txt weight="bold" size={10.5} color={asset === a ? C.gold2 : C.dim}>{a === "elmas" ? "Elmas" : "Altın"}</Txt>
                  </Pressable>
                ))}
                <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Miktar" placeholderTextColor={C.dim2} style={[styles.input, { flex: 1, marginTop: 0 }]} />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable disabled={busy} onPress={() => doGrant(1)} style={[styles.actBtn, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}>
                  <Icon name="plus" size={13} sw={2.5} color={C.green} /><Txt weight="extrabold" size={12} color={C.green}>Ver</Txt>
                </Pressable>
                <Pressable disabled={busy} onPress={() => doGrant(-1)} style={[styles.actBtn, { backgroundColor: "rgba(251,113,133,.1)", borderColor: "rgba(251,113,133,.3)" }]}>
                  <Icon name="x" size={13} color="#FB7185" /><Txt weight="extrabold" size={12} color="#FB7185">Al</Txt>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Genel işlemler */}
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>İŞLEMLER</Txt>
          <View style={styles.group}>
            <Pressable onPress={() => { router.navigate(`/user-profile?publicId=${encodeURIComponent(d.publicId)}&name=${encodeURIComponent(d.name)}`); onClose(); }} style={styles.opRow}>
              <Icon name="user" size={15} color={C.text} /><Txt weight="bold" size={12.5} color={C.text} style={{ flex: 1 }}>Profili Gör</Txt><Icon name="chev" size={13} color={C.dim2} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable onPress={() => run(() => setPlatformRole(d.id, d.rol === "user" ? "developer" : "user"), "Rol güncellendi")} style={styles.opRow}>
              <Icon name="crown" size={15} color={C.gold} /><Txt weight="bold" size={12.5} color={C.text} style={{ flex: 1 }}>Rol: {ROLE_LABEL[d.rol]}</Txt>
              <Txt size={10} color={C.dim2}>{d.rol === "user" ? "→ Geliştirici yap" : "→ Kullanıcı yap"}</Txt>
            </Pressable>
          </View>

          {/* developer-özel: ID + şifre */}
          {isDev && (
            <>
              <Txt weight="bold" size={10.5} color={C.gold} style={styles.lbl}>GELİŞTİRİCİ İŞLEMLERİ</Txt>
              <View style={styles.group}>
                <View style={{ padding: 12, gap: 8 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput value={newId} onChangeText={setNewId} placeholder={`Yeni ID (mevcut: ${d.publicId})`} placeholderTextColor={C.dim2} style={[styles.input, { flex: 1, marginTop: 0 }]} />
                    <Pressable disabled={busy || !newId.trim()} onPress={() => run(() => changePublicId(d.id, newId), "ID değişti").then(() => setNewId(""))} style={[styles.actBtn, { flex: 0, paddingHorizontal: 16, opacity: newId.trim() ? 1 : 0.4 }]}>
                      <Txt weight="extrabold" size={12} color={C.gold2}>Kaydet</Txt>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput value={newPw} onChangeText={setNewPw} placeholder="Yeni şifre (≥6)" placeholderTextColor={C.dim2} secureTextEntry style={[styles.input, { flex: 1, marginTop: 0 }]} />
                    <Pressable disabled={busy || newPw.length < 6} onPress={() => run(() => resetPassword(d.id, newPw), "Şifre sıfırlandı").then(() => setNewPw(""))} style={[styles.actBtn, { flex: 0, paddingHorizontal: 16, opacity: newPw.length >= 6 ? 1 : 0.4 }]}>
                      <Txt weight="extrabold" size={12} color={C.gold2}>Sıfırla</Txt>
                    </Pressable>
                  </View>
                </View>
              </View>
            </>
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      )}
    </Sheet>
  );
}

// ============================================================================
export default function AdminScreen() {
  const router = useRouter();
  const [mainTab, setMainTab] = useState(0); // 0: Raporlar, 1: Kullanıcı
  const [repTab, setRepTab] = useState(0); // 0: bekleyen, 1: tümü
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [counts, setCounts] = useState<{ bekleyen: number; kullanici: number } | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  // arama
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const reload = useCallback(() => {
    if (!isSupabaseConfigured) return;
    listReports().then(setReports).catch((e) => console.warn("[admin] raporlar:", e?.message || e));
    getAdminCounts().then(setCounts).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // arama (debounce)
  useEffect(() => {
    if (!isSupabaseConfigured || q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchUsers(q.trim()).then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const shown = repTab === 0 ? reports.filter((r) => r.durum === "bekliyor") : reports;
  const markReviewed = (r: ReportRow) => {
    haptic.success();
    setReports((rs) => rs.map((x) => (x.id === r.id ? { ...x, durum: "incelendi" } : x)));
    setCounts((c) => (c ? { ...c, bekleyen: Math.max(0, c.bekleyen - 1) } : c));
    setReportStatus(r.id, "incelendi").catch(() => reload());
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="gear" size={17} color={C.gold} />
            <Txt weight="displayBold" size={16} color="#fff">Yönetim</Txt>
          </View>
        </View>

        <View style={styles.mainTabs}>
          {["Raporlar", "Kullanıcı"].map((t, i) => (
            <Pressable key={t} onPress={() => { haptic.select(); setMainTab(i); }} style={styles.mainTab}>
              <Txt weight={mainTab === i ? "extrabold" : "medium"} size={14} color={mainTab === i ? "#fff" : "rgba(255,255,255,.42)"}>{t}</Txt>
              {mainTab === i && <Gradient colors={[C.gold, "#C8922B"]} deg={90} style={styles.mainTabUnderline} />}
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[styles.statCard, { borderColor: `${C.red}2E` }]}>
              <Txt weight="displayBold" size={22} color={counts && counts.bekleyen > 0 ? "#FB7185" : C.text}>{counts?.bekleyen ?? "—"}</Txt>
              <Txt weight="bold" size={10.5} color={C.dim} style={{ marginTop: 3 }}>Bekleyen rapor</Txt>
            </View>
            <View style={styles.statCard}>
              <Txt weight="displayBold" size={22} color={C.text}>{counts?.kullanici ?? "—"}</Txt>
              <Txt weight="bold" size={10.5} color={C.dim} style={{ marginTop: 3 }}>Kayıtlı kullanıcı</Txt>
            </View>
          </View>

          {mainTab === 0 ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 10 }}>
                <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, flex: 1 }}>RAPORLAR</Txt>
                {(["Bekleyen", "Tümü"] as const).map((t, i) => (
                  <Pressable key={t} onPress={() => { haptic.select(); setRepTab(i); }} style={[styles.chip, repTab === i && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                    <Txt weight="bold" size={10.5} color={repTab === i ? C.gold2 : C.dim}>{t}</Txt>
                  </Pressable>
                ))}
              </View>

              {shown.length === 0 ? (
                <View style={styles.empty}>
                  <Icon name="check" size={18} sw={2.5} color={C.green} />
                  <Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>{repTab === 0 ? "Bekleyen rapor yok — her şey yolunda." : "Henüz hiç rapor yok."}</Txt>
                </View>
              ) : (
                <View style={styles.group}>
                  {shown.map((r, i) => (
                    <View key={r.id}>
                      {i > 0 && <View style={styles.divider} />}
                      <View style={styles.row}>
                        <View style={[styles.rowIcon, { backgroundColor: r.tip === "kullanici" ? "rgba(251,113,133,.12)" : `${C.purple2}1A` }]}>
                          <Icon name={r.tip === "kullanici" ? "blockuser" : "mic"} size={15} color={r.tip === "kullanici" ? "#FB7185" : C.purple2} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>{r.hedef}</Txt>
                            <Txt weight="bold" size={10.5} color="#FB7185">{r.neden}</Txt>
                            {r.durum === "incelendi" && <View style={styles.donePill}><Txt weight="extrabold" size={8.5} color={C.green}>İNCELENDİ</Txt></View>}
                          </View>
                          {!!r.detay && <Txt size={10.5} color={C.dim} lh={1.4} style={{ marginTop: 2 }}>{r.detay}</Txt>}
                          <Txt size={9.5} color={C.dim2} style={{ marginTop: 3 }}>{r.raporlayan} raporladı · {zaman(r.at)}</Txt>
                          <View style={{ flexDirection: "row", gap: 6, marginTop: 7 }}>
                            {r.durum === "bekliyor" && (
                              <Pressable onPress={() => markReviewed(r)} style={[styles.actChip, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}>
                                <Icon name="check" size={11} sw={2.5} color={C.green} /><Txt weight="bold" size={10} color={C.green}>İncelendi</Txt>
                              </Pressable>
                            )}
                            {r.tip === "kullanici" && r.hedefKullaniciId != null && (
                              <Pressable onPress={() => { haptic.light(); setDetailId(r.hedefKullaniciId); }} style={styles.actChip}>
                                <Icon name="user" size={11} color={C.gold} /><Txt weight="bold" size={10} color={C.gold}>Kullanıcı</Txt>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={[styles.search, { marginTop: 18 }]}>
                <Icon name="search" size={15} color={C.dim2} />
                <TextInput value={q} onChangeText={setQ} autoCapitalize="none" placeholder="İsim veya ID ara" placeholderTextColor={C.dim2} style={styles.searchInput} />
                {searching ? <ActivityIndicator size="small" color={C.dim} /> : !!q && <Pressable onPress={() => setQ("")}><Icon name="x" size={14} color={C.dim} /></Pressable>}
              </View>
              {results.length > 0 ? (
                <View style={[styles.group, { marginTop: 12 }]}>
                  {results.map((u, i) => (
                    <View key={u.public_id}>
                      {i > 0 && <View style={styles.divider} />}
                      <Pressable onPress={() => { haptic.light(); setDetailId(u.id); }} style={styles.userRow}>
                        <Portrait name={u.kullanici_adi} size={44} photo={u.profil_resmi || undefined} ring={u.ekonomi_rolu !== "user" ? C.gold : undefined} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{u.kullanici_adi}</Txt>
                          <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>ID: {u.public_id}{u.seviye_id ? ` · LV.${u.seviye_id}` : ""}</Txt>
                        </View>
                        <Icon name="chev" size={15} color={C.dim2} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : q.trim().length >= 2 && !searching ? (
                <Txt size={12} color={C.dim} align="center" style={{ paddingVertical: 40 }}>Eşleşen kullanıcı yok.</Txt>
              ) : (
                <Txt size={11.5} color={C.dim2} align="center" style={{ paddingVertical: 40 }}>İsim ya da ID ile kullanıcı ara; işlem için dokun.</Txt>
              )}
            </>
          )}

          <Txt size={10} color={C.dim2} lh={1.5} style={{ marginTop: 14 }}>
            Ham veri ve acil müdahale için Supabase Studio'yu da kullanabilirsin; bu ekran günlük moderasyon içindir.
          </Txt>
        </ScrollView>
      </SafeAreaView>

      <UserDetailSheet userId={detailId} onClose={() => { setDetailId(null); reload(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  mainTabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)", paddingHorizontal: 18, marginTop: 4 },
  mainTab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  mainTabUnderline: { position: "absolute", bottom: -1, width: 30, height: 3, borderRadius: 3 },
  statCard: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 46 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 13 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
  donePill: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: `${C.green}14`, borderWidth: 1, borderColor: `${C.green}44` },
  actChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  empty: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line },
  search: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontWeight: "600", padding: 0 },
  // detay sheet
  rolePill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}44` },
  summary: { flexDirection: "row", marginTop: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: C.line, paddingVertical: 12 },
  sumCol: { flex: 1, alignItems: "center", gap: 3 },
  sumDiv: { width: StyleSheet.hairlineWidth, backgroundColor: C.line },
  infoRow: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: C.line },
  note: { marginTop: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  gRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  opRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  input: { marginTop: 0, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.3)" },
});
