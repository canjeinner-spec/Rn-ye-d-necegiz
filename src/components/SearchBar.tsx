import { Pressable, View } from "react-native";

import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

/**
 * Arama çubuğu (görünüm) — web mockup'taki `SearchBar`.
 * Tıklanınca arama ekranını açmak için onPress alır.
 */
export function SearchBar({ placeholder, onPress }: { placeholder: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        marginHorizontal: 18,
        marginVertical: 10,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 14,
        paddingVertical: 10.5,
        paddingHorizontal: 14,
      }}
    >
      <Icon name="search" size={16} color={C.dim2} />
      <Txt size={12.5} color={C.dim2}>
        {placeholder}
      </Txt>
    </Pressable>
  );
}
