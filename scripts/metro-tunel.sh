#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# metro-tunel.sh — tüneli + Metro'yu kurar ve paketi ÖNCEDEN ISITIR.
#
# NEDEN VAR: bu makine bir bulut sunucusu (AWS), telefon aynı ağda değil,
# tünel zorunlu. Cloudflare hızlı tünelinin origin yanıtı için ~100 saniyelik
# sınırı var. Metro `--clear` ile başladığında ilk paket derlemesi 100-140
# saniye sürüyor; telefon o pakedi tünelden isteyince Cloudflare 524 dönüyor
# ve uygulama AÇILIŞTA TAKILIYOR. Kullanıcı uygulamayı öldürüp açınca Metro
# derlemeyi bitirmiş oluyor ve anında geliyor — "kapatıp açınca düzeliyor"
# belirtisinin tamamı bu.
#
# ÇÖZÜM: paketi tünelden değil LOCALHOST'tan ısıtıyoruz. Localhost'ta
# Cloudflare sınırı yok, derleme ne kadar sürerse sürsün tamamlanıyor.
# Telefon bağlandığında tünel yalnızca SICAK paket servis ediyor.
#
# KULLANIM:  bash scripts/metro-tunel.sh [--clear]
# ---------------------------------------------------------------------------
set -u
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CF="$KOK/.tools/cloudflared.exe"
LOG_DIR="${METRO_LOG_DIR:-$KOK/scratchpad}"
mkdir -p "$LOG_DIR"
TUNEL_LOG="$LOG_DIR/tunel.log"
METRO_LOG="$LOG_DIR/metro2.log"
export PATH="/c/Program Files/nodejs:/c/Program Files/Git/cmd:$PATH"

[ -x "$CF" ] || { echo "HATA: cloudflared yok: $CF"; exit 1; }

# --- Tunel KORUNUR, yalniz Metro yeniden baslatilir ---------------------
# Tunel http://localhost:8081'e bakiyor. Metro ayni portta yeniden
# baslayinca tunel calismaya devam eder; adresi degistirmenin hicbir
# sebebi yok. Ilk surum her seferinde tuneli de olduruyordu ve adres
# degisiyordu: telefondaki kayitli adres olu kaliyor, Cloudflare
# "Error 1016 / origin DNS" (HTTP 530) donuyordu. Bir kez yasandi.
# --tunel-yenile ile bilerek yeni adres alinabilir.
YENILE=0
for a in "$@"; do [ "$a" = "--tunel-yenile" ] && YENILE=1; done

echo "[1/5] Eski Metro kapatiliyor..."
powershell.exe -NoProfile -Command "
  Get-CimInstance Win32_Process |
    Where-Object { \$_.CommandLine -like '*expo/bin/cli*start*' } |
    ForEach-Object { taskkill /PID \$_.ProcessId /T /F 2>&1 | Out-Null }
" >/dev/null 2>&1
if [ "$YENILE" = "1" ]; then
  echo "      --tunel-yenile: bu projenin tuneli de kapatiliyor"
  powershell.exe -NoProfile -Command "
    Get-CimInstance Win32_Process |
      Where-Object { \$_.Name -eq 'cloudflared.exe' -and \$_.CommandLine -like '*Rn-ye-d-necegiz*' } |
      ForEach-Object { taskkill /PID \$_.ProcessId /T /F 2>&1 | Out-Null }
  " >/dev/null 2>&1
fi
sleep 2

# Bu projenin tuneli hala ayaktaysa YENIDEN KURMA — adres korunsun.
ADRES=""
TUNEL_VAR=$(powershell.exe -NoProfile -Command "
  @(Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'cloudflared.exe' -and \$_.CommandLine -like '*Rn-ye-d-necegiz*' }).Count
" 2>/dev/null | tr -d '\r ')
MEVCUT="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNEL_LOG" 2>/dev/null | head -1)"
if [ "${TUNEL_VAR:-0}" -ge 1 ] && [ -n "$MEVCUT" ]; then
  echo "[2/5] Mevcut tunel KORUNUYOR — adres degismiyor."
  ADRES="$MEVCUT"
else
  echo "[2/5] Tunel aciliyor..."
  rm -f "$TUNEL_LOG"
  ( cd "$KOK" && nohup "$CF" tunnel --url http://localhost:8081 --no-autoupdate > "$TUNEL_LOG" 2>&1 & )
fi
# NOT: bu bekleme dongulerinde GECIKME sart. Ilk surumde yoktu; 60 tekrar
# milisaniyede tukeniyor ve "adres alinamadi" diye pes ediliyordu — tunel
# aslinda ayaktaydi, yalnizca adresini henuz basmamisti.
while [ -z "$ADRES" ]; do
  for _ in $(seq 1 60); do
    ADRES="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNEL_LOG" 2>/dev/null | head -1)"
    [ -n "$ADRES" ] && break
    sleep 1
  done
  break
done
[ -n "$ADRES" ] || { echo "HATA: tunel adresi alinamadi, bkz $TUNEL_LOG"; exit 1; }
echo "      $ADRES"

echo "[3/5] Metro baslatiliyor..."
rm -f "$METRO_LOG"
ANA="${ADRES#https://}"
( cd "$KOK" \
  && EXPO_PACKAGER_PROXY_URL="$ADRES" REACT_NATIVE_PACKAGER_HOSTNAME="$ANA" \
     nohup node node_modules/expo/bin/cli start --port 8081 ${1:-} > "$METRO_LOG" 2>&1 & )
for _ in $(seq 1 180); do
  grep -qE 'Waiting on|Logs for your project' "$METRO_LOG" 2>/dev/null && break
  sleep 1
done
grep -qE 'Waiting on|Logs for your project' "$METRO_LOG" || { echo "HATA: Metro hazir olmadi, bkz $METRO_LOG"; exit 1; }
echo "      hazir"

echo "[4/5] Paket ISITILIYOR (localhost uzerinden — Cloudflare sinirina takilmasin)."
echo "      Soguk derleme 2-3 dakika surebilir, BEKLE. Bu adim atlanirsa"
echo "      telefonda acilis takilir."
Q_ORTAK="dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src%2Fapp&transform.reactCompiler=true&unstable_transformProfile=hermes-stable"
for PLAT in android ios; do
  KOD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 900 \
    "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=$PLAT&$Q_ORTAK")
  echo "      $PLAT: HTTP $KOD"
done

echo "[5/5] Tunelden dogrulama (sicak olmali, <5sn)..."
for PLAT in android ios; do
  curl -s -o /dev/null -w "      $PLAT: kod=%{http_code} sure=%{time_total}s\n" --max-time 120 \
    "$ADRES/node_modules/expo-router/entry.bundle?platform=$PLAT&$Q_ORTAK"
done

echo
echo "==================================================================="
echo " Expo Go > Enter URL manually:"
echo "   exp://$ANA"
echo " Metro logu: $METRO_LOG"
echo "==================================================================="
