import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import {
  changeRoomPublicId, getActionHistory, getRoomForEdit, updateRoom,
  type AdminAction, type AdminRoomEdit,
} from "@/data/remote/adminRepo";
import { Icon } from "@/icons/Icon";
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
const ISLEM_LABEL: Record<string, string> = { oda_guncelle: "Oda güncellendi", oda_id_degistir: "Oda ID değiştirildi" };

export default function AdminRoomEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ odaId?: string }>();
  const odaId = params.odaId ? parseInt(String(params.odaId), 10) : NaN;
  const isDev = useApp((s) => s.role) === "developer";

  const [r, setR] = useState<AdminRoomEdit | null>(null);
  const [history, setHistory] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [ad, setAd] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [newId, setNewId] = useState("");

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2400); };
  const load = useCallback(() => {
    if (!Number.isFinite(odaId)) { setErr("Oda bulunamadı."); setLoading(false); return; }
    setLoading(true); setErr(null);
    Promise.all([
      getRoomForEdit(odaId).then((d) => { if (d) { setR(d); setAd(d.ad); setAciklama(d.aciklama || ""); } else setErr("Oda bulunamadı."); }),
      getActionHistory("oda", odaId).then(setHistory).catch(() => setHistory([])),
    ]).catch((e) => setErr((e as Error)?.message || "Bilgi alınamadı.")).finally(() => setLoading(false));
  }, [odaId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); flash(ok); load(); }
    catch (e) { flash((e as Error)?.message || "İşlem başarısız"); }
    finally { setBusy(false); }
  };

  const adDirty = r != null && (ad.trim() !== r.ad || (aciklama.trim() || "") !== (r.aciklama || ""));

  return (
    <View style={styles.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="edit" size={16} color={C.gold} />
            <Txt weight="displayBold" size={16} color="#fff">Oda Düzenleme</Txt>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.gold} /></View>
        ) : err || !r ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 }}>
            <Icon name="warn" size={26} color="#FB7185" />
            <Txt size={12.5} color={C.dim} align="center" lh={1.5}>{err || "Oda bulunamadı."}</Txt>
            <Pressable onPress={load} style={[styles.chip, { paddingHorizontal: 18 }]}><Txt weight="bold" size={12} color={C.gold2}>Tekrar dene</Txt></Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {!!note && <View style={styles.note}><Txt weight="bold" size={11.5} color={C.gold2} align="center">{note}</Txt></View>}

            {/* Üst kimlik */}
            <View style={[styles.group, { padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }]}>
              <Portrait name={r.ad} size={48} photo={r.photo} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="displayBold" size={15} color="#fff" numberOfLines={1}>{r.ad}</Txt>
                <Txt weight="semibold" size={11} color={C.dim} style={{ marginTop: 2 }}>ID: {r.publicId} · Sahip: {r.hostName}</Txt>
                <Txt size={10} color={C.dim2} style={{ marginTop: 2 }}>{r.uyeSayisi} üye · {r.aktifKatilimci} aktif · {r.herkeseAcik ? "Herkese açık" : "Özel"}</Txt>
              </View>
            </View>

            {/* Oda bilgileri */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>ODA BİLGİLERİ</Txt>
            <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
              <View style={{ gap: 6 }}>
                <Txt weight="bold" size={10} color={C.dim2}>ODA ADI</Txt>
                <TextInput value={ad} onChangeText={setAd} placeholder="Oda adı" placeholderTextColor={C.dim2} style={styles.input} />
              </View>
              <View style={{ gap: 6 }}>
                <Txt weight="bold" size={10} color={C.dim2}>AÇIKLAMA</Txt>
                <TextInput value={aciklama} onChangeText={setAciklama} placeholder="Açıklama (opsiyonel)" placeholderTextColor={C.dim2} multiline style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]} />
              </View>
              <Pressable disabled={busy || !adDirty || !ad.trim()} onPress={() => run(() => updateRoom(r.id, ad, aciklama), "Oda güncellendi")} style={[styles.saveBtn, { opacity: adDirty && ad.trim() ? 1 : 0.4 }]}>
                <Icon name="check" size={14} sw={2.5} color={C.gold2} /><Txt weight="extrabold" size={12.5} color={C.gold2}>Değişiklikleri Kaydet</Txt>
              </Pressable>
            </View></View>

            {/* Oda ID — developer */}
            {isDev ? (
              <>
                <Txt weight="bold" size={10.5} color={C.gold} style={styles.lbl}>GELİŞTİRİCİ — ODA ID</Txt>
                <View style={styles.group}><View style={{ padding: 12, gap: 8 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput value={newId} onChangeText={setNewId} placeholder={`Mevcut: ${r.publicId}`} placeholderTextColor={C.dim2} style={[styles.input, { flex: 1 }]} />
                    <Pressable disabled={busy || !newId.trim()} onPress={() => run(() => changeRoomPublicId(r.id, newId), "Oda ID değişti").then(() => setNewId(""))} style={[styles.actBtn, { opacity: newId.trim() ? 1 : 0.4 }]}><Txt weight="extrabold" size={12} color={C.gold2}>Kaydet</Txt></Pressable>
                  </View>
                  <Txt size={9.5} color={C.dim2} lh={1.4}>Oda ID benzersiz olmalı; değişince eski bağlantılar bu ID'yi bulamaz.</Txt>
                </View></View>
              </>
            ) : (
              <View style={styles.lockedInfo}><Icon name="lock" size={14} color={C.dim2} /><Txt size={11} color={C.dim} style={{ flex: 1 }} lh={1.4}>Oda ID düzenleme yalnızca geliştirici (developer) yetkisindedir.</Txt></View>
            )}

            {/* İşlem geçmişi */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>İŞLEM GEÇMİŞİ ({history.length})</Txt>
            {history.length > 0 ? (
              <View style={styles.group}>
                {history.map((h, i) => (
                  <View key={h.id}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.histRow}>
                      <View style={styles.hIcon}><Icon name="clipboard" size={14} color={C.dim} /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt weight="bold" size={12.5} color={C.text}>{ISLEM_LABEL[h.islem] || h.islem}</Txt>
                        {!!h.detay && <Txt size={10.5} color={C.dim} lh={1.4} style={{ marginTop: 2 }}>{h.detay}</Txt>}
                        <Txt size={9.5} color={C.dim2} style={{ marginTop: 3 }}>{h.actorName}{h.actorRol ? ` · ${ROLE_LABEL[h.actorRol] || h.actorRol}` : ""} · {zaman(h.at)}</Txt>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.lockedInfo}><Icon name="clipboard" size={14} color={C.dim2} /><Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Bu odaya henüz yönetici işlemi uygulanmamış.</Txt></View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 46 },
  chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  note: { marginBottom: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}44` },
  actBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` },
  lockedInfo: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line, marginTop: 8 },
  histRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 12, paddingHorizontal: 13 },
  hIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.05)" },
});
