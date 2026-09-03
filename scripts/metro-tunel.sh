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

echo "[1/5] Eski Metro ve bu projenin tuneli kapatiliyor..."
# SADECE bu projenin surecleri; baska projelerin tuneline dokunma.
powershell.exe -NoProfile -Command "
  Get-CimInstance Win32_Process |
    Where-Object { \$_.CommandLine -like '*expo/bin/cli*start*' -or
                   (\$_.Name -eq 'cloudflared.exe' -and \$_.CommandLine -like '*Rn-ye-d-necegiz*') } |
    ForEach-Object { taskkill /PID \$_.ProcessId /T /F 2>&1 | Out-Null }
" >/dev/null 2>&1
sleep 2

echo "[2/5] Tunel aciliyor..."
rm -f "$TUNEL_LOG"
( cd "$KOK" && nohup "$CF" tunnel --url http://localhost:8081 --no-autoupdate > "$TUNEL_LOG" 2>&1 & )
ADRES=""
for _ in $(seq 1 60); do
  ADRES="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNEL_LOG" 2>/dev/null | head -1)"
  [ -n "$ADRES" ] && break
done
[ -n "$ADRES" ] || { echo "HATA: tunel adresi alinamadi, bkz $TUNEL_LOG"; exit 1; }
echo "      $ADRES"

echo "[3/5] Metro baslatiliyor..."
rm -f "$METRO_LOG"
ANA="${ADRES#https://}"
( cd "$KOK" \
  && EXPO_PACKAGER_PROXY_URL="$ADRES" REACT_NATIVE_PACKAGER_HOSTNAME="$ANA" \
     nohup node node_modules/expo/bin/cli start --port 8081 ${1:-} > "$METRO_LOG" 2>&1 & )
for _ in $(seq 1 600); do
  grep -qE 'Waiting on|Logs for your project' "$METRO_LOG" 2>/dev/null && break
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
