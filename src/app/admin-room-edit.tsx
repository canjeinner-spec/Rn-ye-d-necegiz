import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KeyboardAware } from "@/components/KeyboardAware";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import {
  changeRoomPublicId, getActionHistory, getRoomForEdit, setRoomCover, setRoomFlagged, updateRoom,
  type AdminAction, type AdminRoomEdit,
} from "@/data/remote/adminRepo";
import { odaRozetAl, odaRozetVer, odaVerilenRozetler, rozetKatalogu, type RozetKatalogu } from "@/data/remote/roomsRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { RoomBadge, type RoomBadgeType } from "@/components/RoomBadges";
import { type Room } from "@/data/seed";
import { setCached } from "@/lib/cache";
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
const ISLEM_LABEL: Record<string, string> = {
  oda_guncelle: "Oda güncellendi",
  oda_id_degistir: "Oda ID değiştirildi",
  oda_kapak_degistir: "Kapak değiştirildi",
  oda_islem_isaretle: "İşlem yapıldı olarak işaretlendi",
  oda_islem_kaldir: "İşlem işareti kaldırıldı",
};

export default function AdminRoomEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ odaId?: string }>();
  const odaId = params.odaId ? parseInt(String(params.odaId), 10) : NaN;
  const isDev = useApp((s) => s.role) === "developer";
  const patchRoomByDbId = useApp((s) => s.patchRoomByDbId);

  const [r, setR] = useState<AdminRoomEdit | null>(null);
  // Rozetler (066): yalnızca "elle" kaynaklı olanlar verilebilir; kuralla
  // kazanılanlar odanın kendi verisinden hesaplanır, buradan verilemez.
  const [katalog, setKatalog] = useState<RozetKatalogu[]>([]);
  const [verilen, setVerilen] = useState<{ kod: string; ad: string; sebep: string | null; bitis: number | null }[]>([]);
  const rozetleriYukle = useCallback(async () => {
    if (Number.isNaN(odaId)) return;
    const [k, v] = await Promise.all([rozetKatalogu(), odaVerilenRozetler(odaId)]);
    setKatalog(k.filter((x) => x.kaynak === "elle"));
    setVerilen(v);
  }, [odaId]);
  useEffect(() => { rozetleriYukle(); }, [rozetleriYukle]);
  const [history, setHistory] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [ad, setAd] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [newId, setNewId] = useState("");
  const [islemSebep, setIslemSebep] = useState("");

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

  /**
   * İşlemi çalıştır, sonra STORE'a da yansıt.
   *
   * Eskiden yalnızca DB'ye yazılıp ekran yenileniyordu; uygulamanın geri
   * kalanı (profildeki "Odam" kartı, oda paneli, oda listesi önbelleği)
   * eski adı/ID'yi göstermeye devam ediyordu.
   */
  const run = async (fn: () => Promise<void>, ok: string, patch?: Partial<Room>) => {
    setBusy(true);
    try {
      await fn();
      if (patch) patchRoomByDbId(odaId, patch);
      setCached("rooms:list", undefined); // ana sayfa listesi tazelensin
      flash(ok);
      load();
    }
    catch (e) { flash((e as Error)?.message || "İşlem başarısız"); }
    finally { setBusy(false); }
  };

  // Kapak: yönetici galeriden seçer → storage'a yüklenir → odaya yazılır.
  const pickKapak = async () => {
    if (!r || busy) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
    if (res.canceled || !res.assets[0]?.base64) return;
    setBusy(true);
    try {
      const url = await uploadAvatar(res.assets[0].base64, res.assets[0].uri);
      await setRoomCover(r.id, url);
      patchRoomByDbId(odaId, { photo: url });
      setCached("rooms:list", undefined);
      flash("Kapak güncellendi"); load();
    } catch (e) { flash((e as Error)?.message || "Kapak yüklenemedi"); }
    finally { setBusy(false); }
  };

  const adDirty = r != null && (ad.trim() !== r.ad || (aciklama.trim() || "") !== (r.aciklama || ""));

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
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

            {/* İşlem işareti (054): işaretliyken oda sahibi hiçbir bilgiyi
                düzenleyemez ve odaya girenler uyarılır. */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>YÖNETİM İŞLEMİ</Txt>
            <View style={[styles.group, r.islemGordu && { borderColor: "rgba(251,113,133,.40)" }]}>
              <View style={{ padding: 13, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <View style={[styles.rowIkon, { backgroundColor: r.islemGordu ? "rgba(251,113,133,.14)" : "rgba(255,255,255,.05)" }]}>
                    <Icon name="ban" size={16} color={r.islemGordu ? "#FB7185" : C.dim} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="extrabold" size={12.5} color={r.islemGordu ? "#FB7185" : C.text}>
                      {r.islemGordu ? "Bu odaya işlem yapıldı" : "İşlem yapılmadı"}
                    </Txt>
                    <Txt size={10.5} color={C.dim} lh={1.4} style={{ marginTop: 2 }}>
                      {r.islemGordu
                        ? (r.islemSebep || "Sebep belirtilmedi")
                        : "İşaretlersen sahip düzenleyemez, girenler uyarılır."}
                    </Txt>
                  </View>
                </View>

                {r.islemGordu ? (
                  <Pressable disabled={busy} onPress={() => run(() => setRoomFlagged(r.id, false), "İşlem işareti kaldırıldı", { islemGordu: undefined, islemSebep: undefined })} style={[styles.kapakBtn, { backgroundColor: `${C.green}16`, borderColor: `${C.green}4D` }]}>
                    <Icon name="check" size={13} sw={2.5} color={C.green} />
                    <Txt weight="extrabold" size={12} color={C.green}>İşareti Kaldır</Txt>
                  </Pressable>
                ) : (
                  <>
                    <TextInput value={islemSebep} onChangeText={setIslemSebep} placeholder="Sebep (kullanıcıya gösterilir)" placeholderTextColor={C.dim2} style={styles.input} />
                    <Pressable disabled={busy} onPress={() => run(() => setRoomFlagged(r.id, true, islemSebep), "Oda işaretlendi", { islemGordu: true, islemSebep: islemSebep.trim() || undefined }).then(() => setIslemSebep(""))} style={[styles.kapakBtn, { backgroundColor: "#E5484D", borderColor: "#E5484D" }]}>
                      <Icon name="ban" size={13} color="#FFECEC" />
                      <Txt weight="extrabold" size={12} color="#FFECEC">İşlem Yapıldı Olarak İşaretle</Txt>
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {/* Kapak — sadece gösteriliyordu, değiştiren/kaldıran kontrol yoktu */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>ODA KAPAĞI</Txt>
            <View style={styles.group}><View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 13 }}>
              <View style={styles.kapakOnizleme}>
                {r.photo
                  ? <Image source={{ uri: r.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  : <View style={styles.kapakBos}><Icon name="camera" size={18} color={C.dim2} /></View>}
              </View>
              <View style={{ flex: 1, gap: 7 }}>
                <Pressable disabled={busy} onPress={pickKapak} style={[styles.kapakBtn, { backgroundColor: `${C.gold}16`, borderColor: `${C.gold}4D` }]}>
                  <Icon name="camera" size={13} color={C.gold2} />
                  <Txt weight="extrabold" size={12} color={C.gold2}>{r.photo ? "Kapağı Değiştir" : "Kapak Ekle"}</Txt>
                </Pressable>
                {!!r.photo && (
                  <Pressable disabled={busy} onPress={() => run(() => setRoomCover(r.id, null), "Kapak kaldırıldı", { photo: undefined })} style={[styles.kapakBtn, { backgroundColor: "rgba(251,113,133,.12)", borderColor: "rgba(251,113,133,.34)" }]}>
                    <Icon name="trash" size={13} color="#FB7185" />
                    <Txt weight="extrabold" size={12} color="#FB7185">Kapağı Kaldır</Txt>
                  </Pressable>
                )}
              </View>
            </View></View>

            {/*
              Rozetler (066).
              Yalnızca "elle" kaynaklı rozetler burada; haftalık şampiyon gibi
              kuralla kazanılanlar odanın kendi verisinden hesaplandığı için
              elle verilemez — verilebilseydi liste yalan söylerdi.
            */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>ODA ROZETLERİ</Txt>
            <View style={[styles.group, { padding: 12 }]}>
              {verilen.length > 0 ? (
                <View style={{ gap: 8, marginBottom: 12 }}>
                  {verilen.map((v) => (
                    <View key={v.kod} style={styles.rozetSatiri}>
                      <RoomBadge type={v.kod as RoomBadgeType} size={22} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt weight="extrabold" size={12} color={C.text}>{v.ad}</Txt>
                        <Txt size={9.5} color={C.dim} style={{ marginTop: 1 }}>
                          {v.bitis ? `${zaman(v.bitis)} tarihinde biter` : "Süresiz"}
                          {v.sebep ? ` · ${v.sebep}` : ""}
                        </Txt>
                      </View>
                      <Pressable
                        disabled={busy}
                        onPress={() => run(() => odaRozetAl(odaId, v.kod), "Rozet geri alındı").then(rozetleriYukle)}
                        hitSlop={8}
                      >
                        <Icon name="trash" size={14} color="#FB7185" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Txt size={11} color={C.dim2} style={{ marginBottom: 12 }}>Bu odaya elle verilmiş rozet yok.</Txt>
              )}

              <Txt weight="bold" size={9.5} color={C.dim} style={{ letterSpacing: 0.5, marginBottom: 8 }}>ROZET VER</Txt>
              <View style={styles.rozetIzgara}>
                {katalog
                  .filter((k) => !verilen.some((v) => v.kod === k.kod))
                  .map((k) => (
                    <Pressable
                      key={k.kod}
                      disabled={busy}
                      onPress={() => { haptic.light(); run(() => odaRozetVer(odaId, k.kod), `${k.ad} verildi`).then(rozetleriYukle); }}
                      style={styles.rozetAday}
                    >
                      <RoomBadge type={k.kod as RoomBadgeType} size={26} />
                      <Txt weight="semibold" size={9} color={C.dim} align="center" numberOfLines={2} style={{ marginTop: 4 }}>{k.ad}</Txt>
                    </Pressable>
                  ))}
              </View>
            </View>

            <Pressable onPress={() => { haptic.light(); router.navigate(`/admin-mesaj?tip=oda&odaId=${odaId}`); }} style={[styles.group, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, marginTop: 12 }]}>
              <Icon name="mega" size={15} color={C.gold2} /><Txt weight="bold" size={12.5} color={C.text} style={{ flex: 1 }}>Mesaj / Uyarı Gönder</Txt><Icon name="chev" size={13} color={C.dim2} />
            </Pressable>

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
              <Pressable disabled={busy || !adDirty || !ad.trim()} onPress={() => run(() => updateRoom(r.id, ad, aciklama), "Oda güncellendi", { name: ad.trim(), announce: aciklama.trim() || undefined })} style={[styles.saveBtn, { opacity: adDirty && ad.trim() ? 1 : 0.4 }]}>
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
                    <Pressable disabled={busy || !newId.trim()} onPress={() => run(() => changeRoomPublicId(r.id, newId), "Oda ID değişti", { id: newId.trim() }).then(() => setNewId(""))} style={[styles.actBtn, { opacity: newId.trim() ? 1 : 0.4 }]}><Txt weight="extrabold" size={12} color={C.gold2}>Kaydet</Txt></Pressable>
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
        </KeyboardAware>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 46 },
  chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  note: { marginBottom: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}44` },
  actBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` },
  lockedInfo: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line, marginTop: 8 },
  rowIkon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rozetSatiri: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)",
  },
  rozetIzgara: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rozetAday: {
    width: "22%", alignItems: "center", paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)",
  },
  kapakOnizleme: { width: 62, height: 62, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },
  kapakBos: { flex: 1, alignItems: "center", justifyContent: "center" },
  kapakBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  histRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 12, paddingHorizontal: 13 },
  hIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.05)" },
});
