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
  // Argümansız makeRedirectUri ortama göre doğru adresi üretir:
  //  • Expo Go → exp://<host>/--/  (dev-build → rnyednecegiz://)
  // Bu adres Supabase → Authentication → URL Configuration → Redirect URLs
  // listesine eklenmeli, yoksa Supabase "Site URL" (localhost) fallback yapar.
  const redirectTo = makeRedirectUri();
  console.log("[auth] Google redirectTo:", redirectTo); // Supabase'e eklenecek adres

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

  // exp:// şeması URL() ile bazen düzgün ayrışmaz; query+fragment'tan elle çıkar.
  const errDesc = extractParam(res.url, "error_description") || extractParam(res.url, "error");
  if (errDesc) throw new Error(decodeURIComponent(errDesc.replace(/\+/g, " ")));

  // implicit akış: token'lar deep-link'te döner → doğrudan oturum kur.
  const access_token = extractParam(res.url, "access_token");
  const refresh_token = extractParam(res.url, "refresh_token");
  if (access_token && refresh_token) {
    const { data: sess, error: setErr } = await sb.auth.setSession({ access_token, refresh_token });
    if (setErr) throw setErr;
    return sess;
  }

  // (yedek) PKCE code dönerse onu da işle.
  const code = extractParam(res.url, "code");
  if (code) {
    const { data: sess, error: exErr } = await sb.auth.exchangeCodeForSession(code);
    if (exErr) throw exErr;
    return sess;
  }

  throw new Error("Google oturum bilgisi alınamadı.");
}

/** Bir URL'deki query veya fragment parametresini şemadan bağımsız çıkarır. */
function extractParam(rawUrl: string, key: string): string | null {
  const m = rawUrl.match(new RegExp("[?#&]" + key + "=([^&]+)"));
  return m ? m[1] : null;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
