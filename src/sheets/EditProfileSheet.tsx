import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Alan } from "@/components/Alan";
import { CenterModal } from "@/components/CenterModal";
import { Txt } from "@/components/Txt";
import { updateMyProfile } from "@/data/remote/profileRepo";
import { Icon } from "@/icons/Icon";
import { kullaniciAdiKontrol } from "@/lib/authValidation";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * Profil düzenleme.
 *
 * İki sorun vardı:
 *   • Güvenlik: tek kural "2-24 karakter"di. `admin`, `destek`, `..`, `@@@`
 *     gibi adlar kabul ediliyordu — üstelik kayıt ekranı 20 karakterle
 *     sınırlıyken burası 24'e izin veriyordu. Artık ikisi de aynı kaynağı
 *     kullanıyor: lib/authValidation → kullaniciAdiKontrol.
 *   • Kaydetme sırası: yerel ad DB'ye yazmadan ÖNCE güncelleniyordu; ad
 *     alınmışsa ekranda yeni ad görünüyor ama DB'de eski ad kalıyordu.
 *     Artık önce DB, sonra ekran.
 */
export function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const userName = useApp((s) => s.userName);
  const userBio = useApp((s) => s.userBio);
  const setUserName = useApp((s) => s.setUserName);
  const setUserBio = useApp((s) => s.setUserBio);
  const [n, setN] = useState(userName);
  const [b, setB] = useState(userBio);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dokunuldu, setDokunuldu] = useState(false);

  useEffect(() => {
    if (visible) { setN(userName); setB(userBio); setErr(null); setDokunuldu(false); }
  }, [visible, userName, userBio]);

  const adSonuc = kullaniciAdiKontrol(n);
  const adHata = dokunuldu && n.trim().length > 0 && !adSonuc.ok ? adSonuc.hata : null;
  const degisti = n.trim() !== userName || b.trim() !== (userBio || "");
  const kaydedilebilir = adSonuc.ok && degisti && !saving;

  const save = async () => {
    if (!kaydedilebilir) return;
    const name = n.trim();
    const bio = b.trim();
    setErr(null);

    // Önce kalıcı yazma; ekran ancak başarılıysa güncellenir.
    if (isSupabaseConfigured && useApp.getState().session) {
      setSaving(true);
      try {
        await updateMyProfile({ kullanici_adi: name, biyografi: bio || null });
      } catch (e: any) {
        const m = (e?.message || "").toLowerCase();
        setErr(m.includes("duplicate") || m.includes("unique") ? "Bu kullanıcı adı alınmış." : "Kaydedilemedi, tekrar dene.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    haptic.success();
    setUserName(name);
    setUserBio(bio);
    onClose();
  };

  return (
    <CenterModal visible={visible} onClose={onClose}>
      <View style={styles.dialog}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <View style={styles.basIkon}>
            <Icon name="edit" size={17} color={C.gold2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight="displayBold" size={16.5} color="#fff">Profili Düzenle</Txt>
            <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>Bu bilgileri herkes görür</Txt>
          </View>
        </View>

        <Alan
          etiket="KULLANICI ADI"
          deger={n}
          degistir={(s) => setN(s.slice(0, 20))}
          placeholder="gece_yildizi"
          hata={adHata}
          odakDegisti={(o) => { if (!o) setDokunuldu(true); }}
          ustBosluk={18}
          solRozet={<Txt weight="extrabold" size={15} color={C.dim2} style={{ marginRight: 5 }}>@</Txt>}
          sagRozet={<Txt weight="bold" size={10.5} color={n.length >= 18 ? C.gold : C.dim2}>{n.length}/20</Txt>}
        />
        {!adHata && (
          <Txt size={9.5} color={C.dim2} lh={1.5} style={{ marginTop: 7 }}>
            3-20 karakter · harfle başlar · harf, rakam, nokta ve alt çizgi
          </Txt>
        )}

        <Alan
          etiket="BİYOGRAFİ"
          deger={b}
          degistir={(s) => setB(s.slice(0, 120))}
          placeholder="Kendinden kısaca bahset"
          cokSatir
          ustBosluk={16}
        />
        <Txt weight="bold" size={9.5} color={b.length >= 110 ? C.gold : C.dim2} align="right" style={{ marginTop: 6 }}>{b.length}/120</Txt>

        {err ? (
          <View style={styles.hataKutu}>
            <Icon name="warn" size={14} color={C.red} />
            <Txt weight="semibold" size={11} color={C.red} lh={1.45} style={{ flex: 1 }}>{err}</Txt>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          <Pressable onPress={onClose} disabled={saving} style={[styles.btn, { flex: 1, backgroundColor: C.kontrol, borderWidth: 1, borderColor: C.line }]}>
            <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
          </Pressable>
          <Pressable onPress={save} disabled={!kaydedilebilir} style={{ flex: 1, borderRadius: 14, overflow: "hidden", opacity: kaydedilebilir ? 1 : 0.45 }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
              {saving ? <ActivityIndicator color="#241A05" /> : <Txt weight="extrabold" size={13} color="#241A05">Kaydet</Txt>}
            </Gradient>
          </Pressable>
        </View>
      </View>
    </CenterModal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: 24, padding: 20, backgroundColor: "#12111A", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  basIkon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "33" },
  hataKutu: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, padding: 11, borderRadius: 13, backgroundColor: C.red + "14", borderWidth: 1, borderColor: C.red + "33" },
  btn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
