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
  // Expo Go'da bu adres pakete göre değişir (tünel açıldıkça alt alan adı da
  // değişir). Supabase'in izin listesinde OLMAYAN bir adres gönderildiğinde
  // Supabase sessizce "Site URL"e (varsayılan: localhost) düşer ve tarayıcı
  // orada takılı kalır. Değeri log'a basıyoruz ki listeye ne eklenmesi
  // gerektiği Metro çıktısından görülebilsin.
  console.log("[auth] Google redirectTo:", redirectTo);

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Google giriş URL'i alınamadı.");

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== "success" || !res.url) {
    // Kullanıcı gerçekten iptal etmiş olabilir; ama tarayıcı localhost'ta
    // takılıp kaldıysa sebep neredeyse her zaman izin listesidir.
    throw new Error(
      `Google girişi tamamlanamadı. Tarayıcı "${redirectTo}" adresine geri dönmedi. ` +
        "Bu adres Supabase → Authentication → URL Configuration → Redirect URLs " +
        "listesinde değilse Supabase Site URL'e (localhost) düşer ve sayfa orada kalır.",
    );
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

export type AccountBan = { sebep: string | null; bitis: number | null };

/** Kendi aktif hesap (uygulama) yasağım (yoksa null). bitis: epoch ms | null(kalıcı). */
export async function getMyAccountBan(): Promise<AccountBan | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("benim_hesap_yasagim");
  if (error) {
    // RPC yoksa (035 çalıştırılmadı) yasak yok say ama uyar → sessiz kilit olmasın
    console.warn("[hesapYasak] benim_hesap_yasagim RPC hatası:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { sebep: row.sebep ?? null, bitis: row.bitis ? new Date(row.bitis).getTime() : null };
}

/** Hesabı kalıcı olarak sil (kullanicilar + auth.users satırı). Geri alınamaz. */
export async function deleteAccount(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("hesabimi_sil");
  if (error) throw error;
  await signOut();
}
