import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";

import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

/**
 * ID'nin yanındaki kopyalama düğmesi.
 *
 * Uygulamada birkaç yerde kopyalama ikonu vardı ama hiçbiri panoya bir şey
 * yazmıyordu — bazıları tıklanabilir bile değildi, biri de panoya
 * dokunmadan "Kopyalandı" yazıyordu. Hepsi artık bunu kullanıyor.
 */
export function KopyaBtn({ deger, size = 12, etiket = true }: { deger?: string | number | null; size?: number; etiket?: boolean }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (deger === null || deger === undefined || deger === "") return null;

  const kopyala = async () => {
    haptic.success();
    try { await Clipboard.setStringAsync(String(deger)); } catch { /* pano yoksa sessiz geç */ }
    setKopyalandi(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setKopyalandi(false), 1400);
  };

  return (
    <Pressable onPress={kopyala} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon
        name={kopyalandi ? "check" : "copy"}
        size={size}
        sw={kopyalandi ? 3 : undefined}
        color={kopyalandi ? C.green : C.dim2}
      />
      {etiket && kopyalandi && <Txt weight="bold" size={9.5} color={C.green}>Kopyalandı</Txt>}
    </Pressable>
  );
}
