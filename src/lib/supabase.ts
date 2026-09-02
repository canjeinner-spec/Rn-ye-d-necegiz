import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * Env değişkenleri `.env` içinde (gitignore) tanımlanır; Expo bunları
 * `process.env.EXPO_PUBLIC_*` olarak otomatik enjekte eder:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
 *
 * Env yoksa client null olur ve uygulama mevcut mock akışına düşer
 * (kademeli geçiş — hiçbir şey bozulmaz). `isSupabaseConfigured` ile kontrol et.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * `expo-router`'ın statik web export'u (app.json → web.output:"static") Metro
 * içinde bir Node/SSR geçişi çalıştırır; bu ortamda `window` yok.
 * `AsyncStorage`'ın web implementasyonu bunu varsaymadan `window`'a dokunup
 * `ReferenceError: window is not defined` fırlatıyor ve bu, dev sunucusunun
 * tamamen çökmesine yol açıyordu. SSR geçişinde no-op bir depoya düş.
 */
const ssrSafeStorage = {
  getItem: (key: string) => (typeof window === "undefined" ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => (typeof window === "undefined" ? Promise.resolve() : AsyncStorage.setItem(key, value)),
  removeItem: (key: string) => (typeof window === "undefined" ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: ssrSafeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // Expo Go'da PKCE code-verifier saklama "invalid flow state" hatası
        // veriyordu; implicit akışta token'lar deep-link'te döner ve
        // setSession ile doğrudan oturum kurulur (authRepo.signInWithGoogle).
        flowType: "implicit",
      },
    })
  : null;

/**
 * Her dinleyiciye BENZERSİZ Realtime kanal adı.
 *
 * `supabase.channel(ad)` aynı adla çağrılınca VAR OLAN kanalı döndürüyor.
 * Abone olmuş bir kanala sonradan `on("postgres_changes", ...)` eklemek
 * ise hata fırlatıyor:
 *   cannot add `postgres_changes` callbacks ... after `subscribe()`
 *
 * İki yerde patlıyordu: oda listesi ile "Odam" ekranı aynı sabit adı
 * paylaşıyordu (ikincisi açılınca çöküyordu), ve ekranlar hızlı yeniden
 * kurulunca eski kanal daha kapanmadan aynı ad isteniyordu. Abonelik
 * kanal adına değil tablo/filtreye bağlı olduğu için benzersiz ad hiçbir
 * şey kaybettirmiyor.
 */
let kanalSayaci = 0;
export const benzersizKanalAdi = (taban: string) =>
  `${taban}-${++kanalSayaci}-${Math.random().toString(36).slice(2, 7)}`;

/** Guard: yapılandırılmamışsa anlaşılır hata fırlatır (repo katmanında kullanılır). */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase yapılandırılmamış. .env içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlayın.",
    );
  }
  return supabase;
}
