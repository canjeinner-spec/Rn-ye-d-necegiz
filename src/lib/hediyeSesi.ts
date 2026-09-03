import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * Hediye sesini çalan TEK yer.
 *
 * ── ANDROID'DE SESİN BAŞI YENİYORDU ───────────────────────────────────────
 *
 * Belirti kullanıcıdan geldi ve teşhisi tek başına yaptı: "Noel Baba'da da
 * ho ho ho duyulmuyor, SONRAKİ o ses duyuluyor." Noel'de çanlar 1.05 saniyede
 * başlıyor — duyulan oydu. Hazine'de de şıkırtı sonradan geliyor. Diğer beş
 * hediyenin sesi 0.85-2.1 saniye ve enerjisi ilk saniyede toplandığı için
 * hiç duyulmuyordu. Yani "Android'de ses yok" değil, "Android sesin başını
 * yiyor" idi.
 *
 * SEBEP: `createAudioPlayer()` hemen dönüyor ama kaynak arka planda
 * yükleniyor. Yükleme bitmeden `play()` çağrılınca Android oynatmaya
 * hazırlandığı sürenin sesini kaçırıyor. iOS küçük bir paket dosyasını
 * neredeyse anında hazır ettiği için orada fark edilmiyordu.
 *
 * ÇÖZÜM: oynatıcılar ÖNCEDEN kuruluyor ve havuzda tutuluyor
 * (`sesleriOnYukle`, oda açılırken çağrılıyor). Hediye gönderilince yapılan
 * tek şey başa sarıp başlatmak. Yüklenmemiş bir oynatıcıya asla `play()`
 * denmiyor; hazır değilse `playbackStatusUpdate` bekleniyor.
 *
 * ── SES ODAĞI ─────────────────────────────────────────────────────────────
 *
 * `setAudioModeAsync` eskiden yalnız `playsInSilentMode` ile çağrılıyordu ve
 * o alan İOS'A ÖZEL. Android'e hiçbir şey söylenmiyordu; varsayılan davranış
 * özel ses odağı istemek ve kısa bir efekt için odak istemek Android'de
 * sorun çıkarabiliyor. `mixWithOthers` doğrusu — Expo'nun kendi belgesi
 * "Android'de odak İSTENMEZ, ses efektleri ve kısa klipler için en uygunu"
 * diyor. Agora sesli oda geldiğinde de doğru davranış bu: hediye sesi
 * konuşmayı kesmemeli.
 *
 * Mod ateşle-unut çağrılıyor. Bir ara sürümde oynatıcı bu sözün çözülmesini
 * BEKLİYORDU; söz gecikirse hediye tamamen sessiz kalıyordu.
 */

let modIstendi = false;

function sesModunuKur() {
  if (modIstendi) return;
  modIstendi = true;
  setAudioModeAsync({
    playsInSilentMode: true,           // iOS: telefon sessizdeyken de duyulsun
    interruptionMode: "mixWithOthers", // Android: ses odağı İSTEME
    shouldPlayInBackground: false,
    allowsRecording: false,
  }).catch((e) => console.warn("[hediye-ses] mod kurulamadi:", (e as Error)?.message || e));
}

/**
 * Kaynak -> oynatıcı havuzu.
 *
 * Oynatıcılar bilerek SÖKÜLMÜYOR. Her hediyede yeniden kurmak, her seferinde
 * yeniden yükleme beklemek ve sesin başını yeniden kaybetmek demekti.
 * Yedi hediye sesi toplam ~1.4 MB; oda ekranı zaten çok daha ağır şeyler
 * taşıyor.
 */
const havuz = new Map<number, AudioPlayer>();

function oynaticiAl(kaynak: number): AudioPlayer | null {
  const varOlan = havuz.get(kaynak);
  if (varOlan) return varOlan;
  try {
    const p = createAudioPlayer(kaynak);
    p.volume = 1;
    havuz.set(kaynak, p);
    return p;
  } catch (e) {
    console.warn("[hediye-ses] oynatici kurulamadi:", (e as Error)?.message || e);
    return null;
  }
}

/**
 * Sesleri önceden yükler. Oda açılırken bir kez çağrılıyor; ilk hediyede
 * yükleme beklemesi olmasın diye.
 */
export function sesleriOnYukle(kaynaklar: readonly number[]) {
  sesModunuKur();
  for (const k of kaynaklar) oynaticiAl(k);
}

/**
 * Sesi BAŞTAN çalar ve temizleme işlevi döndürür. Dönen işlev bileşen
 * sökülürken çağrılmalı — yalnız dinleyiciyi bırakır, oynatıcı havuzda kalır.
 */
export function hediyeSesiCal(kaynak: number): () => void {
  sesModunuKur();
  const p = oynaticiAl(kaynak);
  if (!p) return () => {};

  let abone: { remove(): void } | null = null;

  const bastanCal = () => {
    try {
      // Aynı hediye ikinci kez gönderilirse oynatıcı sonda kalmış olur.
      if (p.currentTime > 0.01) {
        p.seekTo(0).then(() => p.play(), () => p.play());
      } else {
        p.play();
      }
    } catch (e) {
      console.warn("[hediye-ses] play hatasi:", (e as Error)?.message || e);
    }
  };

  // YÜKLENMEMİŞ OYNATICIYA ASLA play() DEME — sesin başı orada kayboluyordu.
  if (p.isLoaded) {
    bastanCal();
  } else {
    abone = p.addListener("playbackStatusUpdate", (durum) => {
      if (!durum?.isLoaded) return;
      abone?.remove();
      abone = null;
      bastanCal();
    });
  }

  return () => {
    try { abone?.remove(); } catch { /* yoksay */ }
  };
}
