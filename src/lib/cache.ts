import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Uygulama geneli "cache-first" (stale-while-revalidate) veri katmanı.
 *
 * Amaç: ekranlar açılınca son bilinen veriyi ANINDA göstersin (boş→dolu
 * titremesi yok), arkada sessizce tazelesin. Ağ round-trip'i ms'e inemez ama
 * algılanan gecikme ~sıfır olur. Kalıcı (persist) anahtarlar AsyncStorage'a
 * yazılır → soğuk açılışta bile son veri hemen görünür.
 */

const mem = new Map<string, unknown>();
const PREFIX = "cache:";

/** Bellekteki anlık değeri döndürür (yoksa undefined). Prefetch için de yazılır. */
export function getCached<T>(key: string): T | undefined {
  return mem.get(key) as T | undefined;
}
export function setCached<T>(key: string, value: T, persist = false): void {
  mem.set(key, value);
  if (persist) AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)).catch(() => {});
}

/**
 * TÜM önbelleği siler — bellek ve kalıcı (AsyncStorage) taraf.
 *
 * NEDEN GEREKLİ: önbellek kullanıcıya özel veri tutuyor (ziyaretçiler,
 * envanter, rozetler, bakiye). Çıkışta temizlenmiyordu; aynı telefonda
 * başka bir hesapla girildiğinde ÖNCEKİ kullanıcının verisi bir an
 * görünüyordu — "cache-first" davranışı gereği ekran onu ANINDA çiziyor.
 * Anahtarları kullanıcıya göre isimlendirmek de olurdu ama o zaman her yeni
 * anahtarda aynı şeyi hatırlamak gerekir; çıkışta silmek tek yerde durur.
 */
export function cacheTemizle(): void {
  mem.clear();
  AsyncStorage.getAllKeys()
    .then((k) => AsyncStorage.multiRemove(k.filter((x) => x.startsWith(PREFIX))))
    .catch(() => { /* sessiz — bellek zaten temizlendi */ });
}

/** Arka planda veriyi çekip cache'i doldurur (başlangıç prefetch'i için). */
export async function prefetch<T>(key: string, fetcher: () => Promise<T>, persist = false): Promise<void> {
  try { setCached(key, await fetcher(), persist); } catch { /* sessiz */ }
}

async function hydrate<T>(key: string): Promise<T | undefined> {
  if (mem.has(key)) return mem.get(key) as T;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (raw != null) { const v = JSON.parse(raw) as T; mem.set(key, v); return v; }
  } catch { /* sessiz */ }
  return undefined;
}

type Options = { persist?: boolean; enabled?: boolean };

/**
 * Cache-first veri kancası. Dönen `data` önce cache'ten (anında), sonra taze
 * fetch ile güncellenir. Ekran her odaklandığında (useFocusEffect) revalidate
 * eder. `loading` yalnızca hiç veri yokken true olur (aksi halde eski veriyi
 * gösterip sessizce tazeleriz).
 */
export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: Options = {},
): { data: T | undefined; loading: boolean; refresh: () => void } {
  const { persist = false, enabled = true } = opts;
  const [data, setData] = useState<T | undefined>(() => getCached<T>(key));
  const [loading, setLoading] = useState(getCached<T>(key) === undefined);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const revalidate = useCallback(async () => {
    if (!enabled) return;
    try {
      const fresh = await fetcherRef.current();
      setCached(key, fresh, persist);
      setData(fresh);
    } catch (e) {
      // Eski veriyi koruyoruz (ekran boşalmasın) ama ARTIK SESSİZ DEĞİL:
      // liste güncellenmiyor gibi görünen her durumun altında bu vardı.
      console.warn("[cache]", key, (e as Error)?.message || e);
    } finally {
      setLoading(false);
    }
  }, [key, persist, enabled]);

  // İlk mount: AsyncStorage'dan seed (bellek boşsa) + revalidate.
  useEffect(() => {
    let alive = true;
    if (getCached<T>(key) === undefined) {
      hydrate<T>(key).then((v) => { if (alive && v !== undefined) { setData(v); setLoading(false); } });
    }
    return () => { alive = false; };
  }, [key]);

  // Her odaklanışta taze çek (arka planda).
  useFocusEffect(useCallback(() => { revalidate(); }, [revalidate]));

  return { data, loading, refresh: revalidate };
}
