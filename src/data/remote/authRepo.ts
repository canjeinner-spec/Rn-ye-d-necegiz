import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { type Session } from "@supabase/supabase-js";

import { requireSupabase, supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/** Aktif oturumu döndürür (yoksa null). */
export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Oturum değişimini dinler; cleanup fonksiyonu döndürür. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** E-posta + şifre ile kayıt. Supabase doğrulama e-postası gönderir. */
export async function signUpWithEmail(email: string, password: string) {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

/** E-posta + şifre ile giriş. */
export async function signInWithEmail(email: string, password: string) {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

/**
 * Google ile giriş — Expo (auth-session) akışı.
 * Tarayıcı açar, dönüşte PKCE code'unu oturuma çevirir.
 */
export async function signInWithGoogle() {
  const sb = requireSupabase();
  const redirectTo = makeRedirectUri({ scheme: "rnyednecegiz" });

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Google giriş URL'i alınamadı.");

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== "success" || !res.url) {
    throw new Error("Google girişi iptal edildi.");
  }

  const code = new URL(res.url).searchParams.get("code");
  if (!code) throw new Error("Google yetki kodu bulunamadı.");

  const { data: sess, error: exErr } = await sb.auth.exchangeCodeForSession(code);
  if (exErr) throw exErr;
  return sess;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
