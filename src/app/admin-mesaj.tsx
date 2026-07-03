import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import {
  sendToRoom, sendToUser, type AnnounceKanal, type MesajTur,
} from "@/data/remote/announceRepo";
import { getRoomForEdit, getUserDetail, searchRooms, searchUsers, type AdminRoomHit } from "@/data/remote/adminRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { type PublicProfile } from "@/data/remote/profileRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { adminStyles as s } from "@/lib/adminMsgStyles";

type Hedef = { id: number; ad: string; alt?: string; foto?: string };

export default function AdminMesaj() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tip?: string; userId?: string; odaId?: string }>();
  const tip: "kisi" | "oda" = params.tip === "oda" ? "oda" : "kisi";

  const [hedef, setHedef] = useState<Hedef | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hedef[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  const [tur, setTur] = useState<MesajTur>("mesaj");
  const [kanal, setKanal] = useState<AnnounceKanal>("sistem");
  const [baslik, setBaslik] = useState("");
  const [icerik, setIcerik] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2600); };

  // param ile önceden seçili hedef
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const uid = params.userId ? Number(params.userId) : NaN;
    const oid = params.odaId ? Number(params.odaId) : NaN;
    if (tip === "kisi" && Number.isFinite(uid)) {
      getUserDetail(uid).then((d) => { if (d) setHedef({ id: uid, ad: d.name, alt: d.publicId ? `#${d.publicId}` : undefined, foto: d.photo || undefined }); }).catch(() => {});
    } else if (tip === "oda" && Number.isFinite(oid)) {
      getRoomForEdit(oid).then((r) => { if (r) setHedef({ id: oid, ad: r.ad, alt: r.publicId ? `#${r.publicId}` : undefined, foto: r.photo }); }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // arama (debounce)
  useEffect(() => {
    if (hedef || !q.trim() || !isSupabaseConfigured) { setResults([]); return; }
    setSearching(true);
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        if (tip === "kisi") {
          const rs = await searchUsers(q.trim());
          if (my === seq.current) setResults(rs.map((u: PublicProfile) => ({ id: u.id, ad: u.kullanici_adi, alt: `#${u.public_id}`, foto: u.profil_resmi || undefined })));
        } else {
          const rs = await searchRooms(q.trim());
          if (my === seq.current) setResults(rs.map((r: AdminRoomHit) => ({ id: r.id, ad: r.ad, alt: r.publicId ? `#${r.publicId}` : undefined, foto: r.photo })));
        }
      } catch { if (my === seq.current) setResults([]); }
      finally { if (my === seq.current) setSearching(false); }
    }, 320);
    return () => clearTimeout(t);
  }, [q, hedef, tip]);

  const pickFoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.85, base64: true });
      if (!res.canceled && res.assets[0]?.base64) setFoto(await uploadAvatar(res.assets[0].base64, res.assets[0].uri));
    } catch { flash("Foto yüklenemedi"); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!hedef) return flash(tip === "kisi" ? "Önce kullanıcı seç" : "Önce oda seç");
    if (!baslik.trim() || !icerik.trim() || busy) return flash("Başlık ve metin gerekli");
    setBusy(true);
    try {
      if (tip === "kisi") {
        await sendToUser(hedef.id, kanal, baslik, icerik, tur, foto || undefined, bildirim);
      } else {
        await sendToRoom(hedef.id, baslik, icerik, tur, bildirim);
      }
      haptic.light();
      setBaslik(""); setIcerik(""); setFoto(null);
      flash(tur === "uyari" ? "Uyarı gönderildi" : "Mesaj gönderildi");
    } catch (e) { flash((e as Error)?.message || "Gönderilemedi"); }
    finally { setBusy(false); }
  };

  const baslikMetin = tip === "kisi" ? "Kişiye Mesaj / Uyarı" : "Odaya Mesaj / Uyarı";
  const canSend = !!hedef && !!baslik.trim() && !!icerik.trim() && !busy;

  return (
    <View style={s.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name={tip === "kisi" ? "user" : "users"} size={17} color={C.gold} /><Txt weight="displayBold" size={16} color="#fff">{baslikMetin}</Txt>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!!note && <View style={s.note}><Txt weight="bold" size={11.5} color={C.gold2} align="center">{note}</Txt></View>}

          {/* Hedef */}
          <Txt weight="bold" size={10.5} color={C.dim} style={s.lbl}>{tip === "kisi" ? "KİM" : "HANGİ ODA"}</Txt>
          {hedef ? (
            <View style={styles.hedefRow}>
              <Portrait name={hedef.ad} size={38} photo={hedef.foto} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{hedef.ad}</Txt>
                {!!hedef.alt && <Txt size={10.5} color={C.dim} numberOfLines={1}>{hedef.alt}</Txt>}
              </View>
              <Pressable onPress={() => { setHedef(null); setQ(""); }} style={styles.clearBtn}><Txt weight="bold" size={10.5} color={C.dim}>Değiştir</Txt></Pressable>
            </View>
          ) : (
            <>
              <View style={styles.search}>
                <Icon name="search" size={15} color={C.dim2} />
                <TextInput value={q} onChangeText={setQ} autoCapitalize="none" placeholder={tip === "kisi" ? "İsim veya ID ara" : "Oda adı veya ID ara"} placeholderTextColor={C.dim2} style={styles.searchInput} />
                {searching ? <ActivityIndicator size="small" color={C.dim} /> : !!q && <Pressable onPress={() => setQ("")}><Icon name="x" size={14} color={C.dim} /></Pressable>}
              </View>
              {results.length > 0 && (
                <View style={[s.group, { marginTop: 10 }]}>
                  {results.map((r, i) => (
                    <View key={r.id}>
                      {i > 0 && <View style={s.divider} />}
                      <Pressable onPress={() => { haptic.light(); setHedef(r); setResults([]); }} style={styles.resRow}>
                        <Portrait name={r.ad} size={34} photo={r.foto} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>{r.ad}</Txt>
                          {!!r.alt && <Txt size={10.5} color={C.dim} numberOfLines={1}>{r.alt}</Txt>}
                        </View>
                        <Icon name="chev" size={15} color={C.dim2} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Tür */}
          <Txt weight="bold" size={10.5} color={C.dim} style={s.lbl}>TÜR</Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([["mesaj", "Mesaj", C.gold2], ["uyari", "Uyarı", "#FB7185"]] as const).map(([k, ad, col]) => {
              const on = tur === k;
              return (
                <Pressable key={k} onPress={() => setTur(k)} style={[styles.turChip, on && { backgroundColor: col + "18", borderColor: col + "66" }]}>
                  <Icon name={k === "uyari" ? "flag" : "mega"} size={14} color={on ? col : C.dim} />
                  <Txt weight="bold" size={11.5} color={on ? col : C.dim}>{ad}</Txt>
                </Pressable>
              );
            })}
          </View>

          {/* Kanal (yalnız kişi) */}
          {tip === "kisi" && (
            <>
              <Txt weight="bold" size={10.5} color={C.dim} style={s.lbl}>KANAL (DM RESMÎ HESABI)</Txt>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(["aron", "sistem"] as const).map((k) => (
                  <Pressable key={k} onPress={() => setKanal(k)} style={[s.chip, kanal === k && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                    <Txt weight="bold" size={10.5} color={kanal === k ? C.gold2 : C.dim}>{k === "aron" ? "Aron (Resmî)" : "Sistem"}</Txt>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Mesaj */}
          <Txt weight="bold" size={10.5} color={C.dim} style={s.lbl}>{tur === "uyari" ? "UYARI" : "MESAJ"}</Txt>
          <View style={s.group}><View style={{ padding: 12, gap: 10 }}>
            <TextInput value={baslik} onChangeText={setBaslik} placeholder="Başlık" placeholderTextColor={C.dim2} style={s.input} />
            <TextInput value={icerik} onChangeText={setIcerik} placeholder={tur === "uyari" ? "Uyarı metni" : "Mesaj metni"} placeholderTextColor={C.dim2} multiline style={[s.input, { minHeight: 90, textAlignVertical: "top" }]} />
            {tip === "kisi" && (
              <>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Pressable disabled={busy} onPress={pickFoto} style={[s.chip, { flexDirection: "row", gap: 5 }]}>
                    <Icon name="camera" size={12} color={C.gold2} /><Txt weight="bold" size={10.5} color={C.gold2}>{foto ? "Foto değiştir" : "Foto ekle (ops.)"}</Txt>
                  </Pressable>
                  {!!foto && <Pressable onPress={() => setFoto(null)}><Icon name="x" size={14} color="#FB7185" /></Pressable>}
                </View>
                {!!foto && <View style={s.preview}><Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" /></View>}
              </>
            )}
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={12} color={C.text}>Bildirim olarak da gönder</Txt>
                <Txt size={10} color={C.dim} style={{ marginTop: 1 }}>{tip === "kisi" ? "Kişinin bildirim çanına düşer" : "Oda sahibinin bildirim çanına düşer"}</Txt>
              </View>
              <Switch value={bildirim} onValueChange={setBildirim} trackColor={{ true: C.gold, false: "rgba(255,255,255,.15)" }} thumbColor="#fff" />
            </View>
          </View></View>

          <Pressable disabled={!canSend} onPress={send} style={[s.sendBtn, { opacity: canSend ? 1 : 0.45 }, tur === "uyari" && { backgroundColor: "#FB7185" }]}>
            {busy ? <ActivityIndicator color="#241A05" /> : <><Icon name="send" size={14} color="#241A05" /><Txt weight="extrabold" size={13} color="#241A05">{tur === "uyari" ? "Uyarı Gönder" : "Mesaj Gönder"}</Txt></>}
          </Pressable>
          <Txt size={9.5} color={C.dim2} lh={1.4} style={{ marginTop: 10 }}>
            {tip === "kisi"
              ? `Kişinin DM'deki ${kanal === "aron" ? "Aron (resmî)" : "Sistem"} hesabında${bildirim ? " ve bildirim çanında" : ""} görünür.`
              : `Oda sahibine iletilir${bildirim ? " (bildirimli)" : ""}; o an odada olanlar canlı sistem baloncuğu görür.`}
          </Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: C.text, fontSize: 13.5, fontFamily: "PlusJakartaSans_500Medium", padding: 0 },
  hedefRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14 },
  resRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12 },
  clearBtn: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line },
  turChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
});
