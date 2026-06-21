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

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
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

/** Guard: yapılandırılmamışsa anlaşılır hata fırlatır (repo katmanında kullanılır). */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase yapılandırılmamış. .env içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlayın.",
    );
  }
  return supabase;
}
