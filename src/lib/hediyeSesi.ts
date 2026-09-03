import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

/**
 * Hediye sesini çalan TEK yer.
 *
 * ANDROID'DE SES HİÇ ÇIKMIYORDU. Kod iki bileşende kopyaydı ve ikisi de aynı
 * iki hatayı yapıyordu:
 *
 *   1) SES ODAĞI. `setAudioModeAsync` yalnız `playsInSilentMode` ile
 *      çağrılıyordu ve o alan İOS'A ÖZEL — Android tarafına hiçbir şey
 *      söylenmiyordu. Varsayılan davranış özel (exclusive) ses odağı istemek;
 *      kısa bir efekt için odak istemek Android'de sessizlikle sonuçlanabiliyor.
 *      Doğrusu `mixWithOthers`: Expo'nun kendi belgesi "Android'de odak
 *      İSTENMEZ, ses efektleri ve kısa klipler için en uygunu" diyor. İleride
 *      Agora sesli oda açıkken de doğru davranış bu — hediye sesi konuşmayı
 *      kesmemeli.
 *
 *   2) YÜKLENMEDEN ÇALMA. `createAudioPlayer()` hemen dönüyor ama kaynak
 *      arka planda yükleniyor. iOS küçük bir paket dosyasını neredeyse anında
 *      hazır ediyor, Android etmiyor — yükleme bitmeden gelen `play()` sessizce
 *      düşüyor. Artık hem hemen deneniyor hem de `playbackStatusUpdate` ile
 *      yükleme bitince tekrar deneniyor.
 *
 * Ses modu bir kez kuruluyor; sonraki çağrılar beklemiyor.
 */

let modSozu: Promise<void> | null = null;

function sesModunuKur(): Promise<void> {
  if (!modSozu) {
    modSozu = setAudioModeAsync({
      playsInSilentMode: true,           // iOS: telefon sessizdeyken de duyulsun
      interruptionMode: "mixWithOthers", // Android: ses odağı İSTEME
      shouldPlayInBackground: false,
      allowsRecording: false,
    }).then(
      () => undefined,
      () => undefined, // hata olsa da çalmayı dene, sessiz kalmaktan iyidir
    );
  }
  return modSozu;
}

/**
 * Sesi çalar ve TEMİZLEME işlevi döndürür. Dönen işlev bileşen sökülürken
 * çağrılmalı; yoksa oynatıcı nesnesi sızar.
 */
export function hediyeSesiCal(kaynak: number): () => void {
  let oynatici: AudioPlayer | null = null;
  let abone: { remove(): void } | null = null;
  let iptal = false;

  const dene = () => {
    if (iptal || !oynatici) return;
    try { if (!oynatici.playing) oynatici.play(); } catch { /* yoksay */ }
  };

  sesModunuKur().then(() => {
    if (iptal) return;
    try {
      oynatici = createAudioPlayer(kaynak);
      oynatici.volume = 1;
      // İki yol: iOS'ta genelde ilki yeter, Android'de ikincisi yakalar.
      dene();
      abone = oynatici.addListener("playbackStatusUpdate", (durum) => {
        if (durum?.isLoaded) dene();
      });
    } catch { /* ses olmasın, efekt yine oynasın */ }
  });

  return () => {
    iptal = true;
    try { abone?.remove(); } catch { /* yoksay */ }
    try { oynatici?.remove(); } catch { /* yoksay */ }
  };
}
