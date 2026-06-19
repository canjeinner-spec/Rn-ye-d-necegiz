/**
 * ARON CHAT renk paleti — web mockup'taki `C` objesinden birebir taşındı.
 * Siyah-altın premium tema.
 */
export const C = {
  bg: "#08080C",
  card: "#131319",
  card2: "#17171F",
  line: "rgba(255,255,255,.07)",
  gold: "#E8B341",
  gold2: "#F5CE6E",
  purple: "#8B5CF6",
  purple2: "#A78BFA",
  green: "#34D399",
  red: "#F87171",
  text: "#F4F2EE",
  dim: "#8E8C99",
  dim2: "#5C5A66",
} as const;

export type ColorKey = keyof typeof C;
