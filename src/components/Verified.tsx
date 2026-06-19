import { Gradient } from "@/theme/Gradient";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

export function Verified() {
  return (
    <Gradient
      colors={[C.gold, "#B8862B"]}
      deg={135}
      style={{ width: 13, height: 13, borderRadius: 6.5, alignItems: "center", justifyContent: "center" }}
    >
      <Txt weight="extrabold" size={8} color="#241A05">
        ✓
      </Txt>
    </Gradient>
  );
}
