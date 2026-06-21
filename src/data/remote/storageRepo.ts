import { requireSupabase } from "@/lib/supabase";

const BUCKET = "avatars";

/**
 * Yerel görseli (ImagePicker base64) Supabase Storage'a yükler, herkese açık
 * URL döndürür. Dosya yolu: <auth_uid>/<timestamp>.<ext> (RLS: kendi klasörün).
 */
export async function uploadAvatar(base64: string, uri: string): Promise<string> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Oturum yok.");

  const extRaw = (uri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
  const ext = extRaw === "png" ? "png" : extRaw === "webp" ? "webp" : "jpg";
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const path = `${auth.user.id}/${Date.now()}.${ext}`;

  const bytes = base64ToBytes(base64);
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;

  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** base64 → Uint8Array (RN'de güvenilir; Blob yerine byte yükleriz). */
function base64ToBytes(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  let len = clean.length * 0.75;
  if (clean[clean.length - 1] === "=") len--;
  if (clean[clean.length - 2] === "=") len--;

  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = lookup[clean.charCodeAt(i)];
    const e2 = lookup[clean.charCodeAt(i + 1)];
    const e3 = lookup[clean.charCodeAt(i + 2)];
    const e4 = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < len) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < len) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}
