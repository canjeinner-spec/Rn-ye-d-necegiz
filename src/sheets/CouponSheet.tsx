import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { CenterModal } from "@/components/CenterModal";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * Hediye kuponu.
 *
 * ⚠️ Kupon sistemi henüz YOK — ne tablo var ne doğrulama RPC'si.
 * Eskiden "ARON" ile başlayan HER kod kabul ediliyor ve
 * "500 altın + 7 gün VIP hesabına tanımlandı" yazıyordu. Hiçbir şey
 * tanımlanmıyordu; kullanıcı ödül aldığını sanıyordu.
 *
 * Ekran duruyor (giriş alanı, doğrulama biçimi) ama artık ödül verildiğini
 * İDDİA ETMİYOR: kodu alıyor ve sistemin henüz açık olmadığını söylüyor.
 * Backend gelince `submit` içindeki tek satır gerçek RPC ile değişecek.
 */
export function CouponSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [durum, setDurum] = useState<null | "yakinda" | "bicim">(null);

  const gecerliBicim = /^[A-Z0-9-]{4,}$/.test(code.trim().toUpperCase());

  const submit = () => {
    if (code.trim().length < 4) return;
    if (!gecerliBicim) { haptic.warning(); setDurum("bicim"); return; }
    haptic.warning();
    setDurum("yakinda");
  };
  const close = () => { setCode(""); setDurum(null); onClose(); };

  return (
    <CenterModal visible={visible} onClose={close}>
      <View style={styles.dialog}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <View style={styles.basIkon}>
            <Icon name="ticket" size={18} color={C.gold2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight="displayBold" size={16.5} color="#fff">Hediye Kuponu</Txt>
            <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>Kodunu gir, ödülünü al</Txt>
          </View>
        </View>

        {durum === "yakinda" ? (
          <View style={{ alignItems: "center", paddingTop: 18, paddingBottom: 2 }}>
            <View style={styles.bilgiIkon}>
              <Icon name="clipboard" size={22} color={C.gold} />
            </View>
            <Txt weight="displayBold" size={15.5} color="#fff" align="center" style={{ marginTop: 13 }}>
              Kupon sistemi henüz açık değil
            </Txt>
            <Txt size={12} color={C.dim} align="center" lh={1.55} style={{ marginTop: 8 }}>
              Kodun kaydedilmedi. Kupon kullanımı açıldığında buradan
              kullanabileceksin.
            </Txt>
            <Pressable onPress={close} style={{ alignSelf: "stretch", marginTop: 20, borderRadius: 14, overflow: "hidden" }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                <Txt weight="extrabold" size={13.5} color="#241A05">Tamam</Txt>
              </Gradient>
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              value={code}
              onChangeText={(t) => { setCode(t); setDurum(null); }}
              placeholder="ARON-XXXX-XXXX"
              placeholderTextColor={C.dim2}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.input, { borderColor: durum === "bicim" ? C.red : C.gold + "3D" }]}
            />
            {durum === "bicim" && (
              <Txt size={11} color={C.red} align="center" style={{ marginTop: 9 }}>
                Kod yalnızca harf, rakam ve tire içerebilir.
              </Txt>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable onPress={close} style={[styles.btn, styles.notrBtn]}>
                <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={code.trim().length < 4}
                style={{ flex: 1.4, borderRadius: 14, overflow: "hidden", opacity: code.trim().length < 4 ? 0.45 : 1 }}
              >
                <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                  <Txt weight="extrabold" size={13.5} color="#241A05">Kuponu Kullan</Txt>
                </Gradient>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </CenterModal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: 24, padding: 22, backgroundColor: "#181620", borderWidth: 1, borderColor: C.gold + "2E" },
  basIkon: {
    width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "44",
  },
  bilgiIkon: {
    width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
    backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "3D",
  },
  input: {
    width: "100%", marginTop: 16,
    backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 15,
    color: C.text, fontSize: 15, textAlign: "center", letterSpacing: 2, fontWeight: "700",
  },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  notrBtn: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
});
