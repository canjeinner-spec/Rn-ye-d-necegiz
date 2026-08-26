/**
 * ARON CHAT renk paleti — WePlay referanslı AÇIK tema.
 *
 * Değerler WePlay 3.8.3 APK'sının kaynaklarından çıkarıldı
 * (res/values/colors.xml): gri sayfa zemini + beyaz yüzeyler, tek canlı
 * aksan (cyan), üç kademeli gri metin.
 *
 * ÖNEMLİ — anahtar adları eski koyu temadan korundu (gold/purple/teal gibi)
 * ki 42 ekran tek seferde kırılmasın. Adlar artık rengi tarif etmiyor,
 * ROLÜ tarif ediyor:
 *   gold/gold2   → birincil aksan (WePlay'de cyan)
 *   purple/purple2 → aksan koyu tonu / bağlantı-aksiyon metni
 *   teal/teal2   → aksan yardımcı tonları
 * Ekranlar tek tek yenilendikçe aşağıdaki SEMANTİK adlara geçilecek;
 * eski adlar geçiş bitince kaldırılacak.
 *
 * Oda içi KOYU kalır (WePlay'de de öyle: oda ikonları beyaz) → `Room`.
 */
export const C = {
  // ── Zemin & yüzey ────────────────────────────────────────────────
  /** Sayfa zemini — gri (WePlay: activity_background) */
  bg: "#F4F4F4",
  /** Kart / liste satırı — beyaz */
  card: "#FFFFFF",
  /** İkincil yüzey (ayar bloğu vb.) */
  card2: "#F7F7F7",
  /** Ayırıcı çizgi & kenarlık */
  line: "#DEDEE0",

  // ── Aksan (marka) ────────────────────────────────────────────────
  /** Birincil aksan — WePlay cyan */
  gold: "#00CCF9",
  /** Aksan açık/parlak ton (seçili durum) */
  gold2: "#30D5F9",
  /** Aksan koyu ton (basılı hâl) */
  purple: "#00AAD7",
  /** Bağlantı / aksiyon metni */
  purple2: "#00AAD7",
  /** Aksan yardımcı — açık zemin dolgusu */
  teal: "#D4F3FC",
  /** Aksan yardımcı — pasif/devre dışı */
  teal2: "#A3F2FF",

  // ── Durum ────────────────────────────────────────────────────────
  green: "#33CC64",
  red: "#F54550",

  // ── Metin ────────────────────────────────────────────────────────
  /** Birincil metin */
  text: "#333333",
  /** İkincil metin (açıklama, gövde) */
  dim: "#666666",
  /** Üçüncül metin (zaman damgası, pasif etiket) */
  dim2: "#AAABB3",
} as const;

export type ColorKey = keyof typeof C;

/**
 * Yeni kodun kullanacağı SEMANTİK adlar. Üsttekilerle aynı değerler —
 * amaç, ekranlar yenilenirken "gold" gibi yanıltıcı adlardan kurtulmak.
 */
export const Ui = {
  // zemin
  pageBg: "#F4F4F4",
  pageBgAlt: "#EEF3F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F7F7F7",
  border: "#DEDEE0",
  /** Gruplar arası gri boşluk (WePlay grouped-list dili) */
  groupGap: "#F4F4F4",

  // aksan
  accent: "#00CCF9",
  accentBright: "#30D5F9",
  accentPressed: "#00AAD7",
  accentSoft: "#D4F3FC",
  accentDisabled: "#A3F2FF",
  onAccent: "#FFFFFF",

  // metin
  textPrimary: "#333333",
  textSecondary: "#666666",
  textTertiary: "#AAABB3",
  textTips: "#999CB4",
  textHeading: "#1B1D38",
  textDisabled: "#E6E7EC",
  /** Büyük ekran başlığı (WePlay 26dp bold) */
  textTitle: "#4A4A4A",

  // durum
  success: "#33CC64",
  danger: "#F54550",
  warning: "#FFA500",
  /** Sayısal değer vurgusu (sıralama puanı vb.) */
  value: "#FF8D17",
  /** "Şu an oynuyor" göstergesi */
  live: "#2AD44E",

  // gri tonlar
  gray300: "#D8D8D8",
  gray400: "#CCCCCC",
  gray500: "#999999",
} as const;

/**
 * ODA İÇİ — koyu kalır. WePlay'de oda arayüzü koyu zemin/görsel üzerine
 * beyaz ince-çizgi ikonlarla kurulu.
 */
export const Room = {
  bg: "#1B1D38",
  /** Arka plan görselinin üstüne binen karartma */
  overlay: "rgba(0,0,0,.50)",
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,.72)",
  textFaint: "rgba(255,255,255,.45)",
  /** Koltuk boş hâli */
  seatEmpty: "rgba(255,255,255,.16)",
  /** Koltuk kilitli hâli */
  seatLocked: "rgba(255,255,255,.10)",
  accent: "#00CCF9",
} as const;
