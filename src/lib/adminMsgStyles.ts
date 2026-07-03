import { StyleSheet } from "react-native";
import { C } from "@/theme/colors";

/** Duyuru / mesaj / banner yönetim ekranlarının ortak görsel dili. */
export const adminStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 62 },
  chip: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", justifyContent: "center" },
  note: { marginBottom: 4, marginTop: 8, paddingVertical: 9, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  preview: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.04)" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 12, backgroundColor: C.gold2, marginTop: 20 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}44` },
  empty: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line },
});
