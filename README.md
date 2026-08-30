# Aron Chat

Türkçe sesli sohbet odası uygulaması — React Native / Expo SDK 54 /
expo-router / Zustand / Supabase.

## Önce bunları oku

| Dosya | Ne için |
|---|---|
| **`PROJE_DURUMU.md`** | Projenin tamamı: mimari, ekranlar, ortam kısıtları, ne bitti ne bitmedi, açık hatalar. **Yeni bir oturuma başlarken önce bu.** |
| **`db/SEMA_DOKUMU.md`** | Canlı veritabanı dökümü: 104 tablo, 838 sütun, 131 fonksiyon, 23 enum. **Migration yazmadan önce zorunlu.** |
| `db/migrations/` | Sıralı SQL dosyaları. Hangisinin uygulandığı `PROJE_DURUMU.md` §10'da. |

Temel şemanın (kullanicilar, odalar, hediyeler, cuzdanlar…) repoda kaynak
dosyası **yok**; doğrudan Supabase'te kurulu. Neyin zaten var olduğunu
bilmeden migration yazmak çakışma üretiyor — nitekim üretti.

## Çalıştırma

⚠️ **Bu makine bir bulut sunucusu (AWS).** Telefon yerel ağa ulaşamaz, QR kod
çalışmaz. Tünel zorunlu.

```powershell
# 1) Tünel (ayrı kabuk)
& ".\.tools\cloudflared.exe" tunnel --url http://localhost:8081 --no-autoupdate
#    çıktıdan https://<ad>.trycloudflare.com adresini al

# 2) Metro (ayrı kabuk)
$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:Path"
$env:EXPO_PACKAGER_PROXY_URL = "https://<ad>.trycloudflare.com"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "<ad>.trycloudflare.com"
node .\node_modules\expo\bin\cli start --clear
```

**Telefonda:** Expo Go → *Enter URL manually* → `exp://<ad>.trycloudflare.com`
(QR'a bakma, o hâlâ ulaşılamayan yerel adresi gösterir.)

İlk bundle ~50 sn. Expo Go ~15 sn'de vazgeçtiği için ikisini önden ısıtmak
gerekiyor:

```bash
curl -s -o /dev/null "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src%2Fapp&transform.reactCompiler=true&unstable_transformProfile=hermes-stable"
# aynısını platform=android ile tekrarla
```

## Tip kontrolü

`npx` PATH'te değil:

```bash
node ./node_modules/typescript/bin/tsc --noEmit
```

## Yapı

```
src/app/          expo-router ekranları  (room.tsx oda sahnesi)
src/components/   paylaşılan bileşenler
src/sheets/       alttan açılan paneller
src/data/remote/  Supabase erişim katmanı (*Repo.ts)
src/store/        Zustand (appStore.ts)
db/migrations/    sıralı SQL
```

## Dil

Kod yorumları, commit mesajları ve arayüz **Türkçe**. Commit mesajlarında
diakritik kullanılmıyor (ASCII).
