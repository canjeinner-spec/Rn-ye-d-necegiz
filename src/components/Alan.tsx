import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

/**
 * Etiketli metin alanı — odaklanınca çerçeve altına döner, hata varsa kırmızı.
 *
 * Giriş/kayıt ekranı için yazıldı, profil düzenlemede de aynısı gerekince
 * buraya taşındı. Bileşen DOSYA SEVİYESİNDE tanımlı olmalı: bir ekranın
 * içinde tanımlanırsa her render'da yeni bir tip olur, TextInput yeniden
 * kurulur ve kullanıcı yazarken odak kaybolur.
 */
export function Alan(p: {
  etiket: string;
  deger: string;
  degistir: (s: string) => void;
  placeholder: string;
  hata?: string | null;
  gizli?: boolean;
  gorunur?: boolean;
  gozBas?: () => void;
  klavye?: "default" | "email-address";
  solRozet?: ReactNode;
  sagRozet?: ReactNode;
  odakDegisti?: (odak: boolean) => void;
  /** Çok satırlı (biyografi gibi) — yükseklik sabit yerine minimum olur. */
  cokSatir?: boolean;
  ustBosluk?: number;
}) {
  const [odak, setOdak] = useState(false);
  const cerceve = p.hata ? C.red : odak ? C.gold : "rgba(255,255,255,.12)";

  return (
    <View style={{ marginTop: p.ustBosluk ?? 15 }}>
      <Txt weight="bold" size={10} color={odak ? C.gold2 : C.dim} style={{ letterSpacing: 0.7 }}>{p.etiket}</Txt>
      <View style={[styles.alan, p.cokSatir && styles.alanCok, { borderColor: cerceve }]}>
        {p.solRozet}
        <TextInput
          value={p.deger}
          onChangeText={p.degistir}
          placeholder={p.placeholder}
          placeholderTextColor={C.dim2}
          secureTextEntry={!!p.gizli && !p.gorunur}
          keyboardType={p.klavye ?? "default"}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={p.cokSatir}
          onFocus={() => { setOdak(true); p.odakDegisti?.(true); }}
          onBlur={() => { setOdak(false); p.odakDegisti?.(false); }}
          style={[styles.alanInput, p.cokSatir && styles.alanInputCok]}
        />
        {p.sagRozet}
        {p.gozBas && (
          <Pressable onPress={p.gozBas} hitSlop={10} style={{ paddingLeft: 10 }}>
            <Icon name="eye" size={17} color={p.gorunur ? C.gold : C.dim2} />
          </Pressable>
        )}
      </View>
      {p.hata ? <Txt weight="semibold" size={10.5} color={C.red} lh={1.45} style={{ marginTop: 7 }}>{p.hata}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  alan: { flexDirection: "row", alignItems: "center", height: 50, marginTop: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.kontrol },
  alanCok: { height: undefined, minHeight: 92, alignItems: "flex-start", paddingVertical: 12 },
  alanInput: { flex: 1, padding: 0, color: C.text, fontSize: 15, fontFamily: "PlusJakartaSans_700Bold" },
  alanInputCok: { fontSize: 14, lineHeight: 20, textAlignVertical: "top" },
});
