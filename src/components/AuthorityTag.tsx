import { View } from "react-native";

import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

/**
 * "Yetkili" rozeti — developer / süper admin için. Profildeki "Gizli" rozetiyle
 * aynı dilde ama turkuaz/mavimsi tonda. İsmin tam yanında gösterilir.
 */
export function AuthorityTag({ size = 9 }: { size?: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: C.teal + "1F",
        borderWidth: 1,
        borderColor: C.teal + "55",
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 8,
      }}
    >
      <Icon name="shield" size={size + 2} sw={2} color={C.teal} />
      <Txt weight="extrabold" size={size} color={C.teal}>
        Yetkili
      </Txt>
    </View>
  );
}
