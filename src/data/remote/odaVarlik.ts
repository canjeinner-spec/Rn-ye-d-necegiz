import { supabase } from "@/lib/supabase";

/**
 * Odalardaki canlı kişi sayısı — tek bir Realtime presence kanalından.
 *
 * NEDEN: `odalar.aktif_katilimci_sayisi` istemci tarafından yazılıyordu ve üç
 * zayıf halkası vardı:
 *   1. Odadaki istemci yazmayı beceremezse sayı 0 kalıyor → oda listede yok.
 *   2. Uygulama zorla kapanırsa 0 yazılmıyor → boş oda listede asılı kalıyor.
 *   3. Karşı tarafın ayrıca listeyi tazelemesi gerekiyor.
 * Sonuç: "arkadaşım odasındayken ben göremiyorum" ve "kimse yokken oda listede
 * duruyor" aynı anda oluyordu.
 *
 * Presence bunların üçünü de kökten çözer: bağlantı düşünce sunucu kişiyi
 * kendiliğinden düşürür (kalp atışı gerekmez), sayı herkese aynı anda yayılır
 * ve hiçbir şey veritabanına yazılmaz.
 *
 * Tek kanal kullanıyoruz (`oda-varlik`): oda başına kanal açsaydık liste
 * ekranı 50 kanala birden abone olmak zorunda kalırdı.
 */

const KANAL = "oda-varlik";

/** uid -> içinde bulunduğu oda. Aynı kullanıcı iki cihazdaysa tek sayılır. */
type VarlikYuku = { uid: number; oda: number };

let kanal: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
let benimOdam: { uid: number; oda: number } | null = null;
const dinleyiciler = new Set<(sayilar: Map<number, number>) => void>();
let sonSayilar = new Map<number, number>();

function sayilariHesapla(): Map<number, number> {
  const m = new Map<number, number>();
  if (!kanal) return m;
  const durum = kanal.presenceState() as Record<string, VarlikYuku[]>;
  const gorulen = new Set<string>();
  for (const yuk of Object.values(durum)) {
    for (const p of yuk) {
      if (p?.uid == null || p?.oda == null) continue;
      const anahtar = `${p.uid}:${p.oda}`;
      if (gorulen.has(anahtar)) continue; // aynı kullanıcı iki cihazda
      gorulen.add(anahtar);
      m.set(p.oda, (m.get(p.oda) ?? 0) + 1);
    }
  }
  return m;
}

function kanaliAc() {
  const sb = supabase;
  if (!sb || kanal) return;
  kanal = sb.channel(KANAL, { config: { presence: { key: String(benimOdam?.uid ?? Math.random()) } } });
  kanal.on("presence", { event: "sync" }, () => {
    sonSayilar = sayilariHesapla();
    for (const d of dinleyiciler) d(sonSayilar);
  });
  kanal.subscribe(async (durum) => {
    if (durum === "SUBSCRIBED" && benimOdam) await kanal?.track(benimOdam).catch(() => {});
  });
}

function kanaliKapat() {
  const sb = supabase;
  if (!sb || !kanal) return;
  if (dinleyiciler.size > 0 || benimOdam) return; // hâlâ gerekli
  sb.removeChannel(kanal);
  kanal = null;
  sonSayilar = new Map();
}

/** Odaya girdim — herkes beni bu odada saysın. */
export function varlikBildir(uid: number, odaId: number) {
  benimOdam = { uid, oda: odaId };
  if (!kanal) kanaliAc();
  else kanal.track(benimOdam).catch(() => {});
}

/** Odadan çıktım. Bağlantı kopsa sunucu zaten düşürür; bu temiz çıkış. */
export function varliktanCik() {
  benimOdam = null;
  kanal?.untrack().catch(() => {});
  kanaliKapat();
}

/**
 * Oda sayılarını dinle. Geri çağrı hemen bir kez de çalışır ki ekran boş
 * başlamasın.
 */
export function odaSayilariniDinle(cb: (sayilar: Map<number, number>) => void): () => void {
  dinleyiciler.add(cb);
  kanaliAc();
  cb(sonSayilar);
  return () => {
    dinleyiciler.delete(cb);
    kanaliKapat();
  };
}
