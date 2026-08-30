# Proje Durumu — Aron Chat (Rn-ye-d-necegiz)

> **Bu dosyanın amacı:** Yeni bir AI sohbeti/oturumu başlatıldığında sıfırdan
> keşfe gerek kalmadan buradan devam edebilmek. Aşağısı projenin tamamının
> (frontend + backend + DB + ortam kısıtları + hedefler) döküm halidir.
> **Yeni sohbete bu dosyayı oku diye söyle, ya da içeriğini yapıştır.**
>
> Son güncelleme: bu dosyanın en altındaki "Şu An Kaldığımız Yer" bölümüne bak.

---

## 1) Proje Nedir

Türkçe bir **sesli sohbet odası (voice chat room) + sosyal akış** mobil
uygulaması — Clubhouse/Bigo/Yalla tarzı: kullanıcılar oda kurar, mikrofon
sırasına girer, hediye gönderir (ekonomi), profil/seviye/rozet sistemi,
DM, akış (feed), arkadaşlık, bildirimler, ve tam bir **yönetim paneli**
(developer/super_admin rolleri: kullanıcı yönetimi, oda yönetimi, denetim
izi, yasaklama, ekonomi müdahalesi, duyuru sistemi).

- **Repo:** `canjeinner-spec/Rn-ye-d-necegiz` (GitHub)
- **Geliştirme dalı:** `claude/metro-recovery-1xc2kq` (tüm işler bu dalda,
  henüz `main`'e merge edilmedi / PR açılmadı)
- **Dil:** Tüm kod, DB, commit mesajları **Türkçe** (snake_case DB, Türkçe
  değişken/tablo adları — bu bilinçli bir proje kararı, İngilizceye çevirme)

## 2) Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Mobil framework | Expo SDK ^54, React Native 0.81.5, Expo Router ~6.0.24 |
| Dil | TypeScript |
| State | Zustand (`src/store/appStore.ts` — tek merkezi store) |
| Backend | **Supabase** (Postgres + Auth + Realtime + Storage) |
| Supabase client | `@supabase/supabase-js` ^2.108.2 |
| Animasyon | react-native-reanimated ~4.1.1 |
| Liste/scroll native | react-native-screens ~4.16 (New Architecture açık) |
| Glass/blur | expo-blur, expo-glass-effect (iOS 26 Liquid Glass) |
| Bottom sheet | @gorhom/bottom-sheet |

## 3) Supabase Bağlantı Bilgileri

`.env` dosyasında (repoya commit edilmiyor, `.gitignore`'da — ama proje
sahibi olarak buraya not düşülüyor, bu **anon/publishable** anahtar,
istemciye gömülmesi güvenli tasarım gereği):

```
EXPO_PUBLIC_SUPABASE_URL=https://spsdbadmwnxofxotngqv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ONy5NfEra-Q9OK-fVKUUSw_PZDZL0ri
```

Proje ref'i: **`spsdbadmwnxofxotngqv`**. Supabase paneline
(supabase.com/dashboard) bu proje ref'iyle giriş yapılır. `service_role`
(secret) anahtar hiçbir yerde repoda tutulmuyor — SQL Editor'dan manuel
migration çalıştırılıyor (bkz. §6).

Yeni bir ortamda ilk kurulum: `.env.example`'ı `.env` olarak kopyala, yukarıdaki
değerleri gir.

## 4) Mimari / Klasör Yapısı

```
src/
  app/                  → Expo Router sayfaları (dosya = rota). 48 ekran.
    (tabs)/             → Alt tab bar: index (Odalar/Home), rank, feed, dm, profile
    admin*.tsx          → Yönetim paneli ekranları (10+ dosya, developer/super_admin)
    room.tsx            → Oda içi ekranı (sesli sohbet, mic, chat, hediye)
    onboarding.tsx       → Kayıt/giriş (telefon+kod / e-posta / Google)
    ...                  → Diğer tüm ekranlar (wallet, dm-chat, vip, store, vb.)
  sheets/               → Modal/bottom-sheet bileşenleri (ProfileCard, GiftSheet, vb.)
  components/           → Paylaşılan UI (BottomNav, Sheet, CenterModal, KeyboardAware, vb.)
  data/
    remote/             → Supabase repo katmanı (15 dosya) — TÜM DB erişimi buradan
    schema.ts           → Şema-birebir frontend tipleri
  store/appStore.ts     → Tek merkezi Zustand store (auth, rol, hesap yasağı, vb.)
  lib/features.ts       → MVP feature flag'leri (bkz. §7)
  theme/                → Renkler, gradient, glass panel
db/
  migrations/           → 001–048 sıralı SQL migration'lar (idempotent, tekrar
                           çalıştırılabilir — CREATE OR REPLACE / IF NOT EXISTS)
  HEPSI_020_048.sql     → 020'den 048'e kadar TEK YAPIŞTIRMA birleşik dosya
  SON_035_036_037.sql   → Sadece 035-036-037 için ayrı çalıştırma dosyası
  schema_v7_eklentileri.sql → v7 temel şemaya (Supabase'te zaten var, bu repoda
                           dosyası yok) eklenen ilk ek tablolar/kolonlar
```

**Önemli mimari kural:** Hiçbir ekran doğrudan `supabase.from(...)` çağırmaz;
her şey `src/data/remote/*Repo.ts` üzerinden gider (adminRepo, roomsRepo,
walletRepo, dmRepo, feedRepo, vb.). Yeni bir DB özelliği eklerken önce ilgili
repo dosyasına fonksiyon eklenir, sonra ekran ona bağlanır.

**Auth/rol modeli:** `appStore.ts` tek kaynak. `role` alanı `user | developer |
super_admin`. `hesapYasak` state'i doluysa tam ekran engel + force logout
(`enforceAccountBan()`). Realtime ile yasaklamalar anlık algılanır (037
migration).

## 5) Yapılanlar — Kronolojik Büyük Fazlar

Tüm commit geçmişi `git log --oneline --reverse` ile eksiksiz görülebilir.
Özet fazlar (eskiden yeniye):

1. **Frontend mockup (ilk faz):** Tüm ekranlar sahte/mock veriyle inşa edildi
   — oda listesi, oda içi, akış, profil, DM, ekonomi ekranları (cüzdan,
   mağaza, VIP, para çek), sosyal (arkadaşlar, ziyaretçiler, etkinlikler,
   davet), görevler, seviye, özel ID, yayıncı paneli, admin ekranları iskeleti.
2. **Backend Faz 0-1:** Supabase iskelesi, Auth (e-posta + Google OAuth,
   Expo Go uyumlu PKCE akışı), profil senkronu.
3. **Faz 2 (Odalar & Akış):** Gerçek oda listesi/açma, akış paylaşım/beğeni/
   yorum/yanıt/sabitleme/silme (hepsi DB'ye bağlı, SECURITY DEFINER RPC'lerle
   soft-delete).
4. **Faz 3 (Sosyal):** Gerçek DM + Realtime, bildirimler (Realtime), takip
   sistemi, ziyaretçiler.
5. **Faz 4 (Oda içi canlı):** Gerçek oda sohbeti + presence (Realtime),
   mikrofon sırası (broadcast, host onayı).
6. **Ekonomi temeli:** Gerçek cüzdan (elmas + altın), XP/seviye sistemi.
7. **Moderasyon "dilim 1-18" serisi** (en büyük blok): oda üyeliği/rolleri,
   kalıcı oda yasaklama, rapor sistemi (kullanıcı/oda/mesaj şikayeti), in-app
   yönetim paneli, platform mic-yasağı, admin kullanıcı arama/detay, rapor
   detayı (oda katılımcı anlık görüntüsü + giriş/çıkış kaydı), akış içerik
   denetimi, **denetim izi (audit log)**, varlık dondurma (elmas/altın),
   **hesap yasağı** (tam ekran engel + force logout + Realtime canlı tespit),
   e-posta değiştirme, oda düzenleme (ad/açıklama/ID — developer yetkisiyle).
8. **Stabilizasyon:** Auth güvenilirliği (tek kaynak state + root AuthGate),
   cache-first veri katmanı (tüm ekranlara yayıldı, gecikme azaltma), canlı
   ban tespiti sağlamlaştırma.
9. **Oda içi düzenleme + duyuru sistemi:** Oda tema/kapak/isim/duyuru kalıcı
   + gerçek parola (hash'li), **duyuru & sistem mesajı altyapısı** (dinamik
   banner + DM resmi/sistem hesabı), banner'lar tam sayfa premium şablona
   (duyuru/bakım/etkinlik JSONB içerik) çevrildi, **kişiye & odaya özel
   mesaj/uyarı** (hedefli sistem mesajı) eklendi.
10. **Tab bar cilası + Android klavye düzeltmesi (en son iş, bu oturumda):**
    - Sekmeler arası hızlı geçişte **siyah ekran bug'ı** giderildi
      (`animation:"fade"` → `"shift"` + `freezeOnBlur:false`,
      `src/app/(tabs)/_layout.tsx`).
    - **iOS 26 Liquid Glass** tab bar (`expo-glass-effect`'in `GlassView`'i,
      `isLiquidGlassAvailable()` ile güvenli fallback → Android/eski iOS'ta
      eski BlurView kapsül aynen kalıyor). Altın kapsül tasarımı korunuyor.
      (`src/components/BottomNav.tsx`)
    - **Android klavye input'u kapatma sorunu** düzeltildi — kök neden: Expo
      SDK 54 edge-to-edge varsayılanıyla `KeyboardAvoidingView`
      `behavior={undefined}` Android'de artık işlevsiz kalıyordu. Yeni
      paylaşılan **`src/components/KeyboardAware.tsx`** (`behavior:"padding"`)
      yazıldı ve şu dosyalara uygulandı: dm-chat, room, support, withdraw,
      onboarding, `CenterModal`, `Sheet` (→ SecuritySheet vb.), `ProfileCard`,
      admin-user-edit, admin-room-edit. `feed.tsx`'te satır-içi yorum
      input'ları için `automaticallyAdjustKeyboardInsets`.
    - Commit: `3f592d4` (push'landı).

## 6) Veritabanı — Migration Listesi (db/migrations/, 001-059)

Hepsi **idempotent** (`CREATE OR REPLACE`, `IF NOT EXISTS`) — tekrar
çalıştırmak zarar vermez. Sırayla çalıştırılmalı (numaraya göre).

| # | Dosya | Ne yapar |
|---|---|---|
| 001-020 | auth_bridge, ensure_profile, rooms_rls, storage_avatars, feed_rls, feed_likes_comments, feed_post_manage, post/comment_delete_rpc, dm_rls, room_chat(+fix), notifications, reply_notif, owner_comment_delete, clean_public_ids, follow, visitors, block, delete_account | Temel auth/profil/oda/akış/DM/bildirim/takip/engelleme altyapısı |
| 021 | oda_uyeleri | Oda üyeliği + oda içi roller |
| 022 | oda_yasaklari | Kalıcı oda yasaklama |
| 023 | raporlar | Şikayet/rapor sistemi |
| 024-025 | platform_rol, rol_enum_degerleri | Platform rolleri (user/developer/super_admin) |
| 026 | xp | Seviye/XP sistemi |
| 027 | cuzdan | Gerçek cüzdan (elmas + altın) |
| 028 | mic_yasak | Platform mic-yasağı |
| 029 | admin_kullanici | Admin kullanıcı arama/detay RPC'leri |
| 030 | sikayet_katilimci | Rapor anındaki oda katılımcı anlık görüntüsü |
| 031 | admin_icerik | Akış içerik denetimi (admin gönderi sil) |
| 032 | oda_hareket | Oda giriş/çıkış log'u |
| 033 | yonetici_islem | **Denetim izi (audit log)** — kim/hedef/işlem/ne zaman |
| 034 | dondurma | Elmas/altın varlık dondurma |
| 035 | hesap_yasak | **Hesap yasağı** (tam ekran engel + force logout) |
| 036 | oda_yonet | Oda düzenleme (ad/açıklama/ID, developer yetkisi) |
| 037 | realtime_yasak | Yasak tablolarını Realtime yayınına ekler (canlı ban tespiti) |
| 038 | admin_kimlik | Rol atama developer-only; ad/avatar düzenleme tüm yöneticiler |
| 039 | oda_ayar | Oda parolası (gerçek, hash'li, pgcrypto) + odalar Realtime |
| 040 | oda_grant_fix | `odalar` UPDATE grant'ını yeniden assert eder (tema/kapak fix) |
| 041 | duyuru_sistem | Sistem duyuruları (DM resmi/sistem kanalı) + banner altyapısı |
| 042 | banner_sablon | Banner'lar tam sayfa premium şablon (JSONB içerik) |
| 043 | hedefli_mesaj | Kişiye/odaya özel sistem mesajı/uyarı (hedefli) |
| 044 | ozel_id | **Özel ID sistemi** — `ozel_id`/`ozel_id_tip`/`ozel_id_tema`/`beta_tester`/`premium_hak`; `ozel_id_ayarla/kaldir` (entitlement+basamak+benzersizlik zorlar), `admin_hak_ata` |
| 045 | public_id_9hane | `yeni_public_id()` → 9 hane (özel ID ≤7 nadir kalsın) |
| 046 | beta_kapsul_dm | Beta + özel-id yok → otomatik hedefli Sistem DM hatırlatması (bir kez) |
| 047 | ozel_id_admin | `admin_kullanici_haklar` (oku) — admin-user'da beta/premium hak ver-al |
| 049 | rozet_sistemi | Rozet kataloğu (62 rozet) + `rozet_metrikleri` + `rozetleri_degerlendir/ver/al` + `kullanici_rozetleri_getir` ✅ |
| 050 | rozet_kusanma | `kullanicilar.kusanilan_rozet` + `profiller` view + oda/başarı kategori ayrımı + `rozet_kusan/kaldir` ✅ |
| 051 | rozet_kusanma_kurallari | Seviye rozetlerini sunucuda reddeder ⏳ **BEKLİYOR** |
| 052 | oda_vitrin | `odalar.resmi` + `gunluk_sira` (Daily Top) + `oda_vitrin_ayarla` (yalnız yönetici) ✅ |
| 053 | admin_oda_kapak | `admin_oda_kapak_ayarla` — yönetici oda kapağını değiştirir/kaldırır ⏳ **BEKLİYOR** |
| 054 | oda_islem_isareti | `odalar.islem_gordu/islem_sebep/islem_tarihi` + `admin_oda_islem_isaretle`; **`odalar_update` RLS'i işaretli odada sahibi engeller**; `admin_oda_getir` DROP+yeniden ⏳ **BEKLİYOR** |
| 048 | hesap_yasak_dm | `hesap_yasak_ver/kaldir` OR REPLACE → yasak verilince/kalkınca hedefe kalıcı **Sistem DM'i** (sebep+süre; yasaklı ancak yasağı kalkınca görür) + bildirim |

**Birleşik dosyalar:**
- `HEPSI_020_048.sql` — 020'den 048'e kadar hepsi tek yapıştırmada (025 önce,
  tek başına çalıştırılmalı — enum değeri ekleme kısıtı).
- `SON_035_036_037.sql` — sadece bu üçü ayrı çalıştırmak için.

**Temel şema (bu repoda dosyası yok, Supabase'te zaten kurulu):** `kullanicilar`,
`odalar`, `gonderiler` (akış), vb. — `schema_v7_eklentileri.sql` bunların
üstüne ek kolon/tablo ekliyor (feed, etkinlik, görev, kupon, özel ID,
arkadaşlık için).

## 7) Feature Flag'leri (`src/lib/features.ts`) — 28 Ağustos'ta HEPSİ AÇILDI

Bayrakların **hepsi artık `true`** (28 Ağustos, kullanıcı isteği: "clientten
gizlediğimiz her şeyi aktif eder misin"). Ekranlar/rotalar zaten yerindeydi,
yalnızca girişleri gizliydi.

```
roomGift · streamerPanel · giftHistory · giftCoupon · store · vip
rankTab · inventory · friends · events · notifications · visitors
profileGift · dmGift            → 14 bayrak, tamamı true
```

> **⚠️ Açık olmak, gerçek olmak değil.** Aşağıdakiler artık **görünür ve
> gezilebilir** ama arkalarında ne tablo ne RPC var — gerçek bir iş yapmazlar:
>
> | Bölüm | Durum |
> |---|---|
> | store / vip / inventory | sabit ürün listeleri; satın alma yok |
> | agency-panel (yayıncı) | sabit kazanç/ajans sayıları |
> | gift-history | sabit geçmiş |
> | friends / events | `data/friends.ts`, `data/events.ts` (sabit) |
> | rank sekmesi | `data/seed.ts` → RANKS / AGENCY_RANKS / STREAMER_RANKS |
> | hediye gönderme (roomGift / dmGift / profileGift) | animasyon oynar ama **bakiye düşmez**, alıcıya bir şey geçmez, kayıt tutulmaz |
> | giftCoupon | kupon tablosu yok; ekran artık ödül verdiğini iddia etmiyor |
>
> **Gerçek olan:** `visitors` (visitRepo) ve `notifications` (Faz 3).

Gerçeğe bağlamak için sırasıyla: hediye kataloğu + bakiyeden düşen **atomik**
gönderim RPC'si → envanter tablosu → ajans/yayıncı tabloları → sıralama
görünümleri (materialized view + zamanlanmış yenileme).

## 8) Bilinen Ortam Kısıtları + Tünel

> ### ⚠️ ORTAM DEĞİŞTİ — bu bölümün altı ESKİ ortama ait
>
> Proje artık **bulut sandbox'ta değil**, bir **Windows makinesinde** çalışıyor
> (aşağıda görüleceği gibi bu makine de uzak bir bulut sunucusu — telefon
> aynı ağda DEĞİL).
> **Proje yolu:** `C:\Users\Administrator\Desktop\Rn-ye-d-necegiz`
> (28 Ağustos'ta `C:\dev\Rn-ye-d-necegiz`'den taşındı; `C:\dev` boş kaldı.)
>
> **⚠️ BU MAKİNE BİR BULUT SUNUCUSU — tünel ZORUNLU** (28 Ağustos'ta anlaşıldı).
> Dış IP `13.62.50.3` (AWS Stockholm); yerel adres `172.31.21.78` bir VPC
> adresi ve telefonun oraya ulaşması **fiziksel olarak mümkün değil** — QR
> kod çalışmaz. Expo Go host'a erişemeyince sol altta **"Downloading..."
> yazıp donar**; bu belirtiyi görürsen sebep budur, Metro'da sorun yoktur.
> (Burada önceden "telefon aynı ağdaysa QR yeterli" yazıyordu — yanlıştı.)
>
> **Çalıştırma — üç adım (ilk ikisi ayrı kabuklarda):**
> ```powershell
> # 1) Tünel — cloudflared artık kalıcı: .tools\cloudflared.exe (.gitignore'da)
> & "$env:USERPROFILE\Desktop\Rn-ye-d-necegiz\.tools\cloudflared.exe" tunnel --url http://localhost:8081 --no-autoupdate
> #    çıktıdan https://<ad>.trycloudflare.com adresini oku
>
> # 2) Metro — tünel adresiyle
> $env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:Path"
> cd "$env:USERPROFILE\Desktop\Rn-ye-d-necegiz"
> $env:EXPO_PACKAGER_PROXY_URL = "https://<ad>.trycloudflare.com"
> $env:REACT_NATIVE_PACKAGER_HOSTNAME = "<ad>.trycloudflare.com"
> npx expo start --clear
> ```
> **3) Telefonda:** Expo Go → "Enter URL manually" → `exp://<ad>.trycloudflare.com`
> QR'a bakma, o hâlâ ulaşılamayan yerel adresi gösterir. İlk bundle ~60 sn
> (1074 modül, 5.8 MB), sonrası hızlı. **Adres her yeni tünelde değişir** —
> quick tunnel kalıcı ad vermez.
>
> **PATH sorunu:** `npx`, `git`, `node` PATH'te **değil**. Her yeni kabukta:
> ```powershell
> $env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:Path"
> ```
> **Tip kontrolü:** `node node_modules\typescript\bin\tsc --noEmit`
> (`npx tsc` çalışmaz.)
>
> **Port 8081 doluysa** — Metro'nun ölü süreçleri kalabiliyor:
> ```powershell
> Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*Rn-ye-d-necegiz*" } |
>   ForEach-Object { "PID {0}  {1}" -f $_.ProcessId, $_.Name }
> taskkill /PID <metro-pid> /T /F
> ```
> Metro `expo start` → `cmd` → `node .../expo/bin/cli` → 3 × `jest-worker`
> zinciri açar; `/T` hepsini birden kapatır. **Klasörü taşımadan/silmeden önce
> Metro'yu kapat** — açıkken dosya kilidi verir (28 Ağustos'ta taşırken yaşandı).
>
> **Bu makinede tünel denemeleri (28 Ağustos):**
>
> | Yöntem | Sonuç |
> |---|---|
> | `EXPO_FORCE_WEBCONTAINER_ENV=1` (Bolt) | ❌ **502.** Aşağıda "çalışıyor" yazan bu yöntem YEREL makinede çalışmıyor: değişken Expo'ya "tüneli platform sağlıyor" dedirtiyor, ama burada sağlayan yok. `Get-NetTCPConnection -OwningProcess` ile bakıldı — Metro'nun **hiç giden bağlantısı yoktu.** |
> | `npx expo start --tunnel` (ngrok) | ❌ `CommandError: TypeError: Cannot read properties of undefined (reading 'body')` — iki kez. `@expo/ngrok` kurulu ama çalışmıyor. Kullanıcı "ngrok deneme" dedi. |
> | **cloudflared quick tunnel** | ✅ **Tek çalışan yöntem.** 28 Ağustos'ta `.tools\cloudflared.exe` olarak kalıcı indirildi (52 MB, sürüm 2026.8.2). `.gitignore`'da — repoya girmiyor (`7bbfbaa`). |
>
> Komutlar için yukarıdaki "Çalıştırma — üç adım" bloğuna bak. Ortam
> değişkenleri sistemde kalıcı **değil**, her yeni kabukta yeniden verilir.

**Aşağısı, proje bulut sandbox'ta geliştirilirken geçerliydi — tarihsel kayıt:**

Proje **Expo SDK 54** ile başlatıldı ve **Claude Code on the web** (bulut
sandbox) üzerinde geliştiriliyordu. Kullanıcının fiziksel telefonu o sandbox'a
**tünel olmadan doğrudan bağlanamıyordu**. İki mekanizma denenmişti:

### ✅ ÇALIŞAN komut — "Bolt" (Expo'nun kendi WebSocket tüneli)

```bash
EXPO_FORCE_WEBCONTAINER_ENV=1 npx expo start
```

**`--tunnel` bayrağına GEREK YOK** — `EXPO_FORCE_WEBCONTAINER_ENV=1` tek
başına yeterli (nedeni aşağıda). Bu ortamda **doğrulandı ve çalışıyor**:
- Metro şunu basıyor: `Waiting on http://<rastgele-alt-alan-adı>.boltexpo.dev`
- O alt alan adına gerçek `curl` isteği → **200 OK, ~180ms**.
- Gerçek uygulama bundle'ı (6.2MB) o URL üzerinden **2 saniyede** indi —
  uçtan uca doğrulandı, sadece "URL basıyor" değil, gerçekten çalışıyor.
- Expo Go'da açılacak bağlantı: Metro'nun bastığı `http://` adresindeki
  şemayı `exp://` yap → **`exp://<alt-alan-adı>.boltexpo.dev`**
  (her yeni `expo start` çalıştırmasında alt alan adı DEĞİŞİR, o session'da
  Metro'nun bastığı satırdan oku).

**"Bolt" tam olarak nedir:** ngrok değil — Expo CLI'nin kendi içinde gizli
bir mekanizma. `@expo/cli`'nin `BundlerDevServer.js` dosyasında:
```js
if (hostType === 'tunnel' && ...) { tünel başlat }
else if (envIsWebcontainer()) { tünel başlat }   // ← --tunnel'dan BAĞIMSIZ çalışır!
...
this.tunnel = envIsWebcontainer()
  ? new AsyncWsTunnel(...)   // "Bolt" — wss://boltexpo.dev
  : new AsyncNgrok(...);     // varsayılan — ngrok
```
`envIsWebcontainer()` → `EXPO_FORCE_WEBCONTAINER_ENV=1` env değişkeniyle
tetiklenir ve `--tunnel` bayrağından TAMAMEN BAĞIMSIZ olarak da tüneli
başlatır (`else if` kolu). Normalde StackBlitz gibi tarayıcı-içi WebContainer
ortamları için var; ngrok binary/hesap gerektirmiyor, bu yüzden kısıtlı ağlarda
ilk denenecek/tercih edilecek yöntem.

### ❌ ÇALIŞMAYAN komut — ngrok (Expo'nun varsayılanı)

```bash
npx expo start --tunnel
```
"ngrok tunnel took too long to connect" hatasıyla düşer ve **Metro'yu da
beraberinde götürür**. Kök neden: sandbox'ın zorunlu egress proxy'si ngrok'un
sertifika-pinning'ini desteklemiyor (`/root/.ccr/README.md` açıkça
"desteklenmiyor, atlatmaya çalışma" diyor). **Bolt çalıştığı için buna hiç
gerek yok, bu komutu bir daha deneme.**

### Özet — üç komut, ne zaman hangisi

```bash
# Telefonla/cihazla dışarıdan bağlanmak için — BUNU KULLAN:
EXPO_FORCE_WEBCONTAINER_ENV=1 npx expo start

# Sadece bu sandbox içi hızlı doğrulama (tsc/bundle), dışarıdan görünmez:
npx expo start --clear

# ngrok — bu sandbox'ta ÇALIŞMAZ, denemeye gerek yok (Bolt zaten çalışıyor):
npx expo start --tunnel
```

Kullanıcının kendi bilgisayarında çalıştırırken (`claude --teleport` ya da
`git pull` sonrası) zorunlu egress proxy'si olmadığı için ngrok (`--tunnel`,
varsayılan) da sorunsuz çalışır — orada Bolt'a gerek yok, ama Bolt komutu
oradan da çalışır (evrensel, Expo'nun resmi CLI'sinde yerleşik).

## 9) Ertelenen / Bilinçli Olarak Yapılmayan İşler

- **Oda ekonomisi (harcanan altın + oda sıralaması):** Gifting/hediye→altın
  harcama sistemi tamamen mock olduğu için ERTELENDİ. Gerçek hediye→oda→altın
  defteri kurulunca (yukarıdaki feature flag'ler açılınca) eklenecek.
- **XP/seviye kuralları:** Temel XP sistemi var (026 migration) ama detaylı
  kurallar (hangi aksiyon kaç XP verir vb.) kullanıcı kararını bekliyor
  (dilim 6 notunda belirtilmiş, hâlâ açık).
- Yukarıdaki §7'deki tüm `false` feature flag'ler = bilinçli olarak MVP
  dışında bırakılan, ama kodu hazır duran özellikler.

## 9.5) Rozet Sistemi (Premium PNG Setleri) — Güncel Durum

Tüm rozetler kullanıcının **kendi ürettiği gerçek sanat eseri** (GPT görselleri),
Node+pngjs ile piksel-hassas kırpılıp `assets/badges/` altına konur. **ASLA
elle SVG çizilmez** — kullanıcı bunu açıkça reddetti.

### Klasör düzeni (`assets/badges/`)
- `level/` (6): level_bronze/silver/gold/platinum/diamond/legendary — seviye rütbeleri.
- `role/` (7): developer, super_admin, admin, moderator, streamer, vip, vip_hukumdar.
- `special/` (1): beta_tester.
- `room/` (36): hiyerarşik oda rozetleri (weekly_champion, room_owner, legendary…).
- `idcard/` (25): **kapsül** tema kartları (bronze…star) — 6-7 hane özel ID.
- `premium/` (60): **premium** hazır banner'lar (ID baked) — ≤5 hane özel ID.
- `nameplate/` (30): eski nameplate çerçeveleri — özel ID'de artık KULLANILMIYOR.

### Aşama 1 — level/role/special NORMALİZE edildi (BU OTURUM)
Sorun: her rozetin içeriği tuval içinde farklı boyut/konumdaydı (dolgu %74–100,
dikey merkez 0.44–0.54) → "bazı büyük bazı küçük, VIP bir tık üstte". Çözüm:
`scratchpad/normalize-badges.js` her PNG'yi gerçek içerik bbox'ına trim eder,
ortalar, uzun kenarı tuvalin **%90'ına** ölçekler. Sonuç: hepsi merkez
(0.500, 0.500), tek standart dolgu. **Bu script yalnızca level/role/special'a
uygulandı; oda rozetleri (room/) kullanıcı isteğiyle şimdilik dokunulmadı.**
Yeni bir sheet kırpılırsa bu normalize adımı standart olmalı.

### Aşama 2 — Özel ID nameplate sistemi (BU OTURUM — TEMEL kuruldu)
- Kaynak: 6×5 = 30 çerçeve sheet'i (`9b259511-…png`, 1672×941).
- Kırpma: `scratchpad/nameplates/crop.js` — **kenar flood-fill** ile yalnızca
  dış siyah boşluğu şeffaf yapar (luminance chroma-key DEĞİL — o, iç koyu
  paneli delerdi). En-boy korunur (~3:1), genişlik 1000px'e normalize.
- Bileşen: `src/components/IdNameplate.tsx` — `<IdNameplate frame text width/>`
  çerçeveyi çizer + metni iç panele oturtur (`adjustsFontSizeToFit`, displayBold,
  gölge). İç panel dikdörtgeni frame'e göre oran olarak tanımlı; soldaki
  madalyonlu 5 çerçevede (01,02,03,11,23) metin sağa kayar.
- **YAPILACAK (sonraki oturum):** (a) her frame için iç-panel oranlarını cihazda
  görüp ince ayarla; (b) DB'ye "atanan nameplate" kolonu + admin-user'da atama
  UI; (c) profil/ID gösteriminde nameplate'i bağla. Şu an sadece `preview.tsx`
  galerisinde 30'u da örnek metinle görünüyor.

### Aşama 2b — ÖZEL ID HİYERARŞİSİ (BU OTURUM — NİHAİ DURUM)
Basamak sayısına göre iki katman (+düz). `src/data/specialId.ts` +
`src/components/OzelId.tsx` + `src/components/PremiumBanner.tsx`:

- **PREMIUM (≤5 hane):** 60 **hazır banner** — ÖZEL ID + numara GÖRSELE **baked**
  (üzerine yazı yazılmıyor). Kullanıcı **listeden seçer** (hakkı varsa).
  `assets/badges/premium/premium_01..60.png`. Bileşen `PremiumBanner frame width`
  + `PREMIUM_FRAMES` (60) + `PREMIUM_NUM` (baked numaralar, kopyalama/bilgi için).
  Kaynak `3346a73d-…png` (1536×1024, 6×10). Kırpma `scratchpad/premium/crop.js`:
  flood BG_T=22 (sadece siyah) + küçük-bileşen filtresi (kanat uçları KORUNUR).
- **KAPSÜL (6-7 hane):** 25 kart teması — amblem + temanın rengiyle **birebir
  uyumlu** hap içinde ID. `IdKapsul theme id` + `OZEL_ID_TEMA_RENK` (25 renk elle).
  `assets/badges/idcard/*.png` (900px). Kırpma `scratchpad/idcards/crop.js`:
  flood BG_T=**20** (koyu çerçeveler şeytan/gölge/doğa YENMEZ), luminance rampası
  YOK (yarı-saydamlık olmasın), küçük-bileşen filtresi (ayraç noktaları) +
  `cardBottom` (etiket kesimi). Kaynak `4aaa47e0-…png`.
- **8+ hane:** düz numara. (Yeni kayıtlar 9+ hane olacak — YAPILACAK.)
- Yardımcılar: `ozelIdTier(id)`, `idBasamak(id)`, `OZEL_ID_KARTLARI` (25),
  `OZEL_ID_KART_ADI`, `OZEL_ID_TEMA_RENK`. Eşik: `OZEL_ID_KART_MAX=5`,
  `OZEL_ID_KAPSUL_MAX=7`. **Not:** eski pazar/tier (super/t1/t2, THRONE_*) KORUNDU.
- **appStore (demo — DB alanı YOK, sonraki iş):** `ozelId` (numara) +
  `ozelIdTip` ("premium"/"kapsul") + `ozelIdTema` (banner ya da kart anahtarı) +
  `setOzelIdKimlik(id,tip,tema)`.
- `OzelIdGosterim id tip tema` → premium: PremiumBanner görseli · kapsul: IdKapsul.
- **special-id.tsx** `KapsulBolumu`: tip seç → Kapsül: ID gir (6-7) + kart teması ·
  Premium: listeden banner seç (ID baked). Canlı önizleme + **Onayla** →
  `setOzelIdKimlik`. Zaten varsa **Değiştir/Kaldır**. Eski "Özel ID Havuzu"
  (sabit chip'ler) KALDIRILDI.
- **profile.tsx:** düz "ID:" satırı yerine **özel ID** (premium width 88 /
  kapsül size 8) + kopyalama ikonu; tıkla → **OzelIdInfoModal** (bilgi penceresi,
  sayfaya gitmez). `betaTester && özel-id yok` → yönlendirme banner'ı →
  `/special-id` (alınca kaybolur). **Ajans rozeti** vitrinden kaldırıldı.
- **Sağ '>' oku** → `/user-profile?self=1` (kendi profilini PUBLIC görünümde
  önizle). user-profile **self** modda: aksiyon barı gizli, ajans/streamer rozeti
  yok, **yetki rozeti** (developer/super_admin) DB `ekonomi_rolu`'ndan (self için
  store rolü) EN BAŞTA, düz ID yerine özel ID.

### Aşama 3 — Bilgi pencereleri (BU OTURUM — NİHAİ)
- `BadgeInfoModal.tsx` (PngBadge tıkla) + `OzelIdInfoModal.tsx` (özel ID tıkla):
  liquid-glass, **baya saydam**, küçük (rozete göre boyut), **buton YOK**;
  birkaç saniye (`AUTO_MS`) ya da **herhangi dokunuşta** kapanır; **FadeIn ile
  aydınlanarak** açılır, Modal fade ile **kararak** kapanır. Font/metne dokunulmadı.
- `PngBadge` kendi kendine tıklanabilir; `src/data/badgeInfo.ts` metin kaynağı.

### Artık KULLANILMAYAN (özel ID için) — temizlenebilir
- `assets/badges/nameplate/` (30) + `IdNameplate.tsx`: premium 60 baked banner'a
  geçince özel ID'de kullanımdan kalktı; yalnızca `preview.tsx` galerisinde duruyor.
- `OzelIdKart` bileşeni (kart üstüne ID plakası): premium için artık yok; kart
  GÖRSELİ sadece kapsül tema-seçici thumbnail'lerinde + IdKapsul ambleminde.

### Aşama 2c — ÖZEL ID DB KALICILIĞI (BU OTURUM — backend bağlandı)
Frontend demo'su gerçek DB'ye bağlandı. Migration'lar (kullanıcı Supabase SQL
Editor'ünde çalıştırır; birleşik: `HEPSI_020_046.sql`):
- **`044_ozel_id.sql`:** `kullanicilar`'a `ozel_id` (benzersiz, kısmi index) +
  `ozel_id_tip` (CHECK premium/kapsul) + `ozel_id_tema` + `beta_tester` +
  `premium_hak`. `profiller` view'i özel ID kolonlarıyla yeniden. RPC'ler:
  `ozel_id_ayarla(id,tip,tema)` (SECURITY DEFINER — **entitlement + basamak +
  benzersizlik ZORLAR**: premium→premium_hak & ≤5 hane, kapsul→beta/premium & 6-7
  hane, ID hem public_id hem ozel_id'de benzersiz), `ozel_id_kaldir()`,
  `admin_hak_ata(hedef,alan,deger)` (yalnız yönetici + `_yonetici_log`).
- **`045_public_id_9hane.sql`:** `yeni_public_id()` → 9 hane (backfill YOK). 9+ ile
  ≤7 çakışmaz → arama iki kolonu da eşler.
- **`046_beta_kapsul_dm.sql`:** `beta_kapsul_hatirlatildi` bayrağı +
  `beta_kapsul_hatirlat()` RPC → beta && özel-id yok && daha atılmadıysa
  `sistem_duyurulari`'na hedefli 'sistem' mesajı (kullanıcının **Sistem DM**
  thread'inde görünür, 043 mekanizması) + bildirim; bir kez.
- **Repo (`profileRepo.ts`):** Profile/PublicProfile'a özel-id kolonları;
  `setOzelId/clearOzelId/betaKapsulHatirlat` RPC sarmalayıcıları; `searchProfiles`
  artık `ozel_id`'yi de arıyor.
- **Store:** `loadProfile` özel-id + beta_tester + premium_hak DB'den okur;
  beta+özel-id yoksa `betaKapsulHatirlat()` çağırır. `premiumHak` state eklendi.
- **special-id:** claim **yetki-kilitli** — hak yoksa "Özel ID hakkın yok",
  yalnız hak edilen tip sekmesi; Onayla → `setOzelId` RPC (hata gösterir); Kaldır
  → `clearOzelId`. Profildeki beta yönlendirme banner'ı **fallback** olarak kaldı.
- **Admin atama (TAMAM):** `047_ozel_id_admin.sql` `admin_kullanici_haklar` (oku)
  + 044 `admin_hak_ata` (yaz); `adminRepo.getUserHaklar/setUserHak`;
  `admin-user-edit` Kimlik bölümünde **"ÖZEL ID HAKLARI"** — Beta Tester /
  Premium Hak ver-al toggle'ları (yönetici). Birleşik: `HEPSI_020_047.sql`.
- **KALAN (küçük):** ✅ profildeki "Demo · Beta Tester" toggle'ı `2a8400b`'de
  kaldırıldı (artık DB'den geliyor). Açık kalan: Sistem DM mesajına tıklayınca
  /special-id derin-linki (şimdilik profil banner'ı yönlendiriyor).

## 10) Şu An Kaldığımız Yer

> **Son güncelleme: 30 Ağustos 2026 (oturum sonu)** · Dal `claude/metro-recovery-1xc2kq`
> · **origin'e PUSH EDİLMEDİ** · güncel commit için `git log --oneline -5`
> · Dal `claude/metro-recovery-1xc2kq` · **origin’e PUSH EDİLMEDİ**
> (yerel commit’ler; şema dökümü için `db/SEMA_DOKUMU.md`’ye bak)

### 🔴 AÇIK HATA — oda listede görünmüyor (30 Ağustos, ÇÖZÜLMEDİ)

**Belirti (kullanıcının gördüğü):**
- Kendi odasında dururken oda listede yok.
- Arkadaşı odasındayken o da listede görünmüyor.
- Bazen tersi: kimse yokken oda listede asılı kalıyor.
- "Odam" bölümünde, odanın içindeyken bile "boş" yazıyor.

**Kanıt (Metro logundan, teşhis satırları hâlâ kodda):**
```
[liste] db=7 oda; online: 5:1 9:0 8:0 7:0 6:0 3:0 2:0   ← uid 9 odasındayken
[liste] db=7 oda; online: 9:0 8:0 7:0 6:0 5:0 3:0 2:0   ← çıkınca
```
Yani DB sayacı uid 9 için DOĞRU yazılıyor. Ama sonraki turlarda yedi odanın
hepsi 0 göründü — arkadaşın (uid 11) odasındayken bile. `[sayac]` hata satırı
hiç çıkmadı, yani yazma çağrısı patlamıyor.

**Kök sebep hipotezi (doğrulanmadı):**
Liste "içinde kimse olmayan odayı gösterme" kuralını uyguluyor
(`(tabs)/index.tsx` → `gorunur`, `r.online > 0`). Kendi odanı görmek için
odadan çıkman gerekiyor, çıkış anında oda gerçekten boşalıyor → hiç
göremiyorsun. Bu kısım tasarım sonucu, hata değil. Ama **arkadaşın odasının
görünmemesi** bununla açıklanmıyor; orası hâlâ açık.

**Denenen ve YETMEYEN çözümler (sırayla):**
1. `065` — `odalar` Realtime yayınına alındı, liste anlık tazeleniyor.
   Doğrulandı (`Subscribed to PostgreSQL`) ama sorunu çözmedi.
2. Sahibe istisna: "kendi odan boşken de sana görünsün". Kullanıcı istemedi
   (boş oda listede durmasın dedi), **geri alındı**.
3. `src/data/remote/odaVarlik.ts` — kişi sayısını DB sayacı yerine tek bir
   Realtime presence kanalından saymak. **Bu da çözmedi**; kullanıcı "bu sefer
   listede hiç görünmüyor" dedi.

**ŞU ANKİ TEHLİKELİ DURUM — ilk iş bu:**
Sistem **yarı taşınmış**. Kişi sayısı iki ayrı kaynaktan geliyor:
- `odalar.aktif_katilimci_sayisi` — `room.tsx` içindeki presence sync hâlâ
  `odaKatilimciYaz` ile yazıyor (giriş/çıkışta).
- `odaVarlik.ts` presence kanalı — `(tabs)/index.tsx` bunu okuyup `online`
  alanının üzerine yazıyor.

İkisi çelişince hangisinin kazandığı belirsiz. **Önce birine karar verilmeli**,
sonra diğeri tamamen sökülmeli. Aksi halde her düzeltme kararsız davranır.

**Sonraki oturum için öneri:**
1. `odaVarlik.ts`ın gerçekten çalışıp çalışmadığını ölç: presence kanalına
   `console.log` koy, iki cihazda `presenceState()` ne dönüyor bak. Kanal
   hiç `SUBSCRIBED` oluyor mu? `track` gidiyor mu?
2. Çalışıyorsa DB sayacını (`odaKatilimciYaz` çağrılarını + 057) tamamen sök.
   Çalışmıyorsa `odaVarlik.ts`ı sil, sayaca dön ve arkadaşın odasının neden
   görünmediğini ayrıca kovala.
3. Ürün kararı: "boş odayı gösterme" kuralı iki kez sorun çıkardı. Boş odalar
   ayrı bir sekmede ("Tümü") gösterilsin mi, tartışılmalı.

**"Odam boş yazıyor" ayrı bir uç:** `getMyRoom` DB sayacını okuyor
(`aktif_katilimci_sayisi`), presence'ı bilmiyor. Hangi kaynağa karar verilirse
orası da ona bağlanmalı.

---

### ⚠️ Çalıştırılmayı bekleyen migration'lar

Canlı veritabanı 30 Ağustos'ta yoklandı. Bekleyenler:

| Dosya | Ne yapıyor | Durum |
|---|---|---|
| `053_admin_oda_kapak.sql` | `admin_oda_kapak_ayarla` — yönetici oda kapağını değiştirir/kaldırır | ❌ **eksik** → kapak düğmeleri hata verir |
| — | 066 dahil hepsi uygulandı | ✅ |

051-052, 054-066 **uygulandı** (30 Ağustos). Yalnızca **053 eksik**. `fn_kaynak` düşürüldü.
065 Realtime aboneliğiyle doğrulandı ("Subscribed to PostgreSQL").
063+064 sonrası anon erişimi ölçüldü: hediye/sıralama/görev/cüzdan RPC'lerinin
hepsi ve `hediyeler`/`esyalar`/`gorevler` tabloları **kapalı** (42501).

> **YETKİ KURALI — pahalıya patlayan ders:** PostgreSQL yeni fonksiyona
> **PUBLIC**'e EXECUTE verir ve `anon` PUBLIC'in içindedir. Yani
> `REVOKE ... FROM anon` tek başına KAPATMAZ — rolün kendi grant'ını siler,
> PUBLIC'ten geleni değil. Her yeni fonksiyonda önce
> `REVOKE ALL ... FROM PUBLIC`, sonra hedef role `GRANT`.
> 064 tam olarak bu yüzden gerekti (`_enum_etiket`, `_enum_liste`,
> `_siralama_baslangic`, `_bugun_tr` açık kalmıştı).

> **Kritik kural:** Client kodunu uygulanmamış migration'a bağlama. Daha önce
> `kusanilan_rozet` DB'de yokken SELECT'e eklendi ve **tüm profil okumaları**
> `42703` ile çöktü. Bu yüzden `roomsRepo.odalariGetir` artık kendini koruyor:
> yeni kolonlar yoksa temel kolonlara düşüp çalışmaya devam ediyor.

### 28 Ağustos — ilk yarı (gece 03:00–05:00)

**Referans:** WePlay (oda sahnesi) ve Yalla (üst bar) ekran görüntüleri.

**Oda ekranı**
- Mikrofon sırası ayrı sayfaya alındı (`sheets/MicQueueSheet.tsx`); FAB ikonu
  mikrofon → **el kaldırma** (`hand`), bekleyen sayısı rozetiyle.
- Koltuk ölçüleri WePlay'den ölçülüp **orana** çevrildi: çap = sütunun %51'i,
  sahip = koltuğun 1.5 katı (WePlay 1.65 ama bizde isim+etiket var). Izgaranın
  14pt yatay dolgusu kaldırıldı — sıkışıklığın asıl sebebi buydu.
- **Oda sahibi başka koltuğa oturamaz** (üç yol da kapatıldı).
- Üst bardaki geri oku kaldırıldı (güç düğmesi zaten "Küçült" sunuyor).
- Oda çipi Yalla'ya göre: sol kenara yapışık, solu köşeli/sağı oval, yumuşak
  saydam; içine **kazanılmış oda rozetleri** eklendi.
- **Tema odaya hiç uygulanmıyordu** — zemin sabit gri gradyandı, `Scene`
  yalnızca 36px'lik çipte kullanılıyordu. Zemin artık `<Scene>` + perde.
- Mikrofon-kapalı rozeti avatarın ortasının altındaydı → sağ alt köşe.

**Oda profili paneli** — tek akan sayfa oldu (kutu-içinde-kutu bitti). Sabit
`ROOM_LV=29 / 13.490 XP / "Dil: Türkçe"` verileri silindi. Oda sahibi satırı
eklendi. Oda fotoğrafı her yerde 1:1 avatar gibi ele alınıyor.

**Profil kartı** — herkese aynı sabit rozetleri gösteriyordu
(`CARD_BADGES` = developer+VIP+ajans). Gerçek profil çekiliyor; seviye artık
profildeki gibi rütbe rozeti (avatardaki "LV" çipi kaldırıldı).

**Sahte veri temizliği:** "959 oda", LV.28/ID 1149663822 varsayılanları,
"cinsiyeti boş olana Erkek / ülkesi boş olana Türkiye", cüzdanda "12.4K/860",
yayıncı "$142.50/$92.40", DM rozetinde sabit "3", akışta koşulsuz nokta,
`live: true` sabiti, "Arkadaşlar" satırı — hepsi gerçek veriye bağlandı ya da
kaldırıldı. **Hâlâ sahte:** `data/tasks.ts` (görev sistemi yok), oda rozetleri
(`Room.badges` yalnız mock), "Normal Hediyeler: 4.926" (flag kapalı).

**Oda listesi**
- **Sekmeler hiçbir şey yapmıyordu** (dördü aynı listeydi) → gerçekten
  filtreliyor. Yeni set: **Keşfet · Popüler · Yeni · Resmî**.
- Sıralama: resmî → Daily Top (1,2,…) → normal.
- Görünürlük (istisnasız): **gizli/kilitli, yasaklandığım, işlem görmüş, boş**
  odalar listelenmez.
- Sekme çubuğu banner'ın altına alındı; banner çerçevesi artık **fotoğrafın
  kendi oranını** alıyor (sabit orana sığdırma denemeleri hep kırpıyordu).

**Tema birliği (siyah-altın):** cüzdan (mordu), profil (mor-kahve kapak),
görevler (mor), özel ID (kahve), 9 admin ekranı (kahve) → hepsi temaya çekildi.
Emoji temizliği: 🏦🧾🎖️⚠️🔒✓💎❧☙◆◇↻ → ikon setine.

**Sekme bileşeni** (`components/Tabs.tsx`): çizgi artık **kayıyor**, yeni
`fill` modu. Cüzdan/görevler/özel ID/yönetimdeki "segment buton" geçişleri
bununla değiştirildi. Alt sekme çubuğunda da gösterge kayıyor + ikon büyüyor.

**Özel ID / taht kartı:** taç ve kanatlar emojiydi ve negatif konumlarla
üst üste biniyordu → taç ikon madalyonu olarak kendi boşluğunda.

**Kopyalama:** dört kopyalama ikonu vardı, **hiçbiri panoya yazmıyordu**.
`expo-clipboard` kuruldu, ortak `components/KopyaBtn.tsx`.

**Yönetim (admin)**
- Kullanıcı yönetimi baştan tasarlandı: dört bölüm ayrı sayfaydı → **sekmeli**.
  Tek `chip` stili hem seçim hem aksiyon için kullanılıyordu → `Secim` /
  `Aksiyon` / `Anahtar` diye üçe ayrıldı. Ceza süreleri sabit 3 sütunlu ızgara.
- **Onay pencereleri**: hesap yasağı, mikrofon yasağı, şifre sıfırlama —
  üçü de tek dokunuşla çalışıyordu.
- Ara kullanıcı özet ekranı silindi (`admin-user.tsx`); doğrudan sekmeli ekran.
- Oda rapor detayı: rapor belirgin kart, tam genişlikte **Odaya Uyarı** +
  **İncelendi** (rapordan çıkmadan uyarı gönderme yoktu).
- Yönetici oda düzenlemesi **store'a yansımıyordu** → `patchRoomByDbId`.
  Oda kapağı yalnızca gösteriliyordu → `053` + kontroller.

**"Bu odaya işlem yapıldı" (054)** — yönetici işlemi yalnız loga yazılıyordu;
sahip işlem görmüş odayı serbestçe düzenleyebiliyor, giren uyarı görmüyordu.
Artık: DB'de kalıcı işaret, **RLS ile sahibin UPDATE'i engelleniyor**, oda
yönetiminde kilit + kırmızı uyarı, listede filtre, **girişte uyarı**.

**Odaya giriş perdesi** (`components/RoomEntryGate.tsx`): "Odaya giriliyor…"
+ işlem görmüş odada uyarı ("hemen ayrılmazsanız hesabınız da cezai işlem
görebilir") + Ayrıl / Riski kabul et.

### Yeni dosyalar (bu oturum)

```
src/sheets/MicQueueSheet.tsx      src/components/KopyaBtn.tsx
src/components/RoomEntryGate.tsx  db/migrations/052,053,054
```
**Silinen:** `src/app/admin-user.tsx` · **Yeni paket:** `expo-clipboard ~8.0.8`
**Yeni ikonlar:** `hand`, `bank`, `wallet`

### 28 Ağustos — ikinci yarı (10:55–12:35)

**Gizlenen her şey açıldı** (`6a46b3b`) — 13 bayrak `false` → `true`;
`features.ts` başına "açık ama hâlâ sahte" uyarısı yazıldı (bkz. §7).

**Metro / tünel teşhisi** — sol alttaki **"Downloading..." donması**: makinenin
bir bulut sunucusu olduğu anlaşıldı, LAN QR'ı hiçbir zaman çalışmayacaktı.
cloudflared kalıcı olarak `.tools\` altına indirildi, Metro tünel adresiyle
yeniden başlatıldı, manifest tünel üzerinden **200** döndü. Ayrıntı: §8.

**Sıralama ekranı** (`4033071`) — Zenginlik / Cazibe / Odalar sekmelerinin
**üçü de aynı listeyi** gösteriyordu (hepsi aynı `else` dalına düşüyordu).
Üçü ayrıldı; podyum yeniden yapıldı, ekran siyah-altın temaya çekildi.

**Ajanslar / yayıncılar** (`e54f9a0`) — ajanslara güce göre kademeli arma,
ilk üçe kendine özgü amblem; yayıncı listesinde ilk üç vurgulanıyor.

**DM · arkadaşlar · etkinlik · bildirimler** (`4858338`, `d14decc`) — DM
avatar hizası düzeltildi; arkadaş listesi/istekleri ve ziyaretçiler ekranı
elden geçirildi (satırın tamamı basılabilir, ikonlu boş durumlar).

**Aron VIP** (`81b1298`) — mor kademe kimliği siyah-altına çekildi (Asil =
bronz, Hükümdar = altın); dağınık öğeler tek "kademe kartı"nda toplandı.

**Hesap & Güvenlik · hediye geçmişi · kupon** (`a411096`) — oturumun son işi.
Sahte olduğu hâlde gerçekmiş gibi davranan üç akış düzeltildi:
- **Şifre güncelleme hiçbir şey yapmıyordu** (yalnızca "Şifre güncellendi"
  ekranı açılıyordu) → `authRepo.changeMyPassword`: önce mevcut şifreyle
  doğrulama, sonra `auth.updateUser`.
- Sabit telefon numarası kullanıcının numarasıymış gibi yazıyordu → oturumun
  gerçek e-postası; sahte 4 haneli telefon doğrulama akışı kaldırıldı.
- Bağlı hesaplar yerel state'ti (açılışta Apple bağlı görünüyordu) → gerçek
  `user.identities`.
- Kupon: "ARON" ile başlayan **her** kod "500 altın + 7 gün VIP tanımlandı"
  diyordu → artık ödül verdiğini iddia etmiyor.

> **Kullanıcının sorusu "hepsini backend'e bağlıyorsun değil mi?" — cevap:**
> Hayır. Bu oturumdaki işler **görsel**. Zaten bağlı olanlar (ziyaretçiler,
> bildirimler, oda listesi, cüzdan bakiyesi, profil, yönetim işlemleri)
> korundu, bazılarında sahte veri gerçeğine çevrildi; hediye / mağaza / VIP /
> envanter / ajans / görev **hâlâ tamamen sahte**. Yeniden tasarlamak onları
> çalışır yapmıyor.

**Oturum çöktü** — kupon dosyası yazıldıktan hemen sonra "Prompt is too long";
o yüzden bu bölüm oturumun kendisinde yazılamadı. `tsc` yeni oturumda
çalıştırıldı (**exit 0**), dört dosya `a411096` ile commit'lendi.

### 29-30 Ağustos oturumu — ekonomi gerçeğe bağlandı

> **En önemli bulgu:** temel şemada (repoda dosyası olmayan, doğrudan
> Supabase'de kurulu olan kısım) **zaten eksiksiz bir ekonomi varmış** ve biz
> aylardır onun yanına ikinci bir tane kuruyorduk. Bkz. `db/SEMA_DOKUMU.md`.

#### Giriş / kayıt / profil

- **Doğrulama modülü** (`src/lib/authValidation.ts`) — üç kural seti tek yerde:
  - `sifreGucu`: uzunluk (8/12/16) + karakter sınıfı puanı; ceza olarak
    e-posta adını içerme, karakter tekrarı, ardışık dizi (abcd/1234/qwerty),
    yaygın şifre listesi (doğrudan 0). Kayıt için skor ≥ 2 **ve** ≥ 8 karakter.
  - `epostaKontrol`: rol/sistem adları (admin, test, root, destek, noreply,
    aron…), admin/test ile başlayan-biten, rakamla başlayan, tamamı rakam,
    5+ ardışık rakam, 4+ rakamla biten, rakam oranı %40 üstü, sesli harfsiz
    7+ karakter, 4+ aynı karakter, 20 tek kullanımlık alan adı.
  - `kullaniciAdiKontrol`: 3-20, harfle başlar, harf/rakam/nokta/alt çizgi,
    ayraçlar üst üste gelemez, ayraçla bitemez, ayrılmış adlar.
  - **Kural:** eleme YALNIZCA kayıtta çalışır. Girişte sadece biçim kontrolü —
    kurallar sonradan geldiği için önce açılmış hesaplar kilitlenmesin diye.
- Kayıt artık girişin kopyası değil: "ADIM 1/2" rozeti, şifre tekrarı, güç
  göstergesi. Alanlar ortak `components/Alan.tsx`'te (etiket, odakta altın
  çerçeve, göz ikonu, sol/sağ rozet) — profil düzenleme de bunu kullanıyor.
- Profil oluşturma: avatar 116px altın halka + yazdıkça ad önizlemesi, hazır
  avatarlar yatay şerit. **Kadın seçeneği erkek ikonuyla çiziliyordu** →
  ikon setine `female` eklendi.
- `EditProfileSheet`: tek kural "2-24 karakter"di (`admin`, `..` geçiyordu) →
  kayıtla aynı kurallar. Ayrıca yerel ad DB'ye yazılmadan ÖNCE güncelleniyordu;
  ad alınmışsa ekran yalan söylüyordu → önce DB, sonra ekran.
- `AronMark` yeniden çizildi (mor dolgu + BlurView gitti, tek SVG).

#### Odam ekranı (055)

- Üç sekme de aynı sahte listenin dilimleriydi. Artık üç ayrı gerçek kaynak:
  **Son günlerde** → `oda_ziyaretleri` (yeni), **Katıl** → `oda_uyeleri`,
  **Takip et** → `oda_takip` (yeni).
- RoomPanel'deki "Takip Et" yalnızca yerel state'ti; artık DB'ye yazıyor.
- Ekran temaya çekildi (mor kart → siyah-altın), ortak `Tabs`, boş durumlar,
  aşağı çekip yenileme, "3 sa önce" etiketi.

#### Oda katılımcı sayacı (057)

`odalar.aktif_katilimci_sayisi` her yerde OKUNUYOR ama hiçbir yerde
YAZILMIYORDU. Oda listesi "boş odaları gösterme" kuralını buna göre
uyguladığı için **yeni kurulan hiçbir oda hiçbir sekmede görünmüyordu**.
Artık odadaki istemcilerden biri (en küçük uid) presence'taki gerçek sayıyı
`oda_katilimci_yaz` ile yazıyor. Sunucu tarafı presence doğrulaması yok →
sayı advisory.

#### Giriş perdesi yeniden kurgulandı

Perde oda ekranının İÇİNDEYDİ: önce odaya giriliyor, sonra kontrol ediliyordu
— yasaklı olduğun odaya bile girip sonra atılıyordun. Artık perde
`AppOverlays`'te, **odaya girmeden önce** bulunduğun ekranın üstünde açılıyor
ve kontroller orada yapılıyor: oda yasağı, işlem görmüş oda (sahibine ayrı
metin), bağlantı hatası + "Tekrar dene". Bütün giriş noktaları
`odayaGirDene()` üzerinden geçiyor.

#### Eşya sistemi (056) — çerçeve / giriş efekti / sohbet balonu

- `esyalar` + `kullanici_esyalari` + `esya_satin_al` / `esya_kusan` /
  `esya_cikar` + `kusanili_esyalar` görünümü. 42 eşya (20 çerçeve,
  12 giriş efekti, 10 balon), asset yok — hepsi kodla çiziliyor
  (`FramePreview` halka tarifleri + `data/esyaTemalari.ts`).
- Kuşanılanlar presence yüküyle taşınıyor: odadaki herkes birbirinin
  çerçevesini/balonunu/giriş efektini ek sorgu olmadan görüyor.
- Çerçeve yalnızca **mikrofon koltuğunda ve kullanıcı kartında** görünür
  (sohbette kalabalık yapıyordu). Balon her mesajda, giriş efekti
  mikrofonların altındaki hapta.
- ⚠️ Bu yapı temel şemadaki `magaza_esyalari` + `kullanici_envanteri` ile
  ÇAKIŞIYOR — taşıma sırası: hediye (bitti) → mağaza/envanter → cüzdan.

#### Hediye ekonomisi — 058 yazıldı, sonra 059 ile temel şemaya taşındı

`058` kendi tablolarımızı kurmuştu. Ardından temel şemada `hediyeler` +
`hediye_gecmisi` ve iki trigger olduğu ortaya çıktı:

- **BEFORE `hediye_gonder_fn`**: `gifts_enabled` bayrağı, fiyat katalogdan,
  komisyon `ayarlar.hediye_komisyon_orani`'ndan (varsayılan 0.40),
  `idem_kaydet`, kullanıcı kilidi, `gift_ban`/`economy_frozen`/`banli`,
  `limit_tuket('daily_gift')`, **`lot_harca('altin')`**, gönderene XP.
- **AFTER `hediye_after_fn`**: `kazanc_hareket` ile alıcıya kazanç, XP+seviye,
  `sistem_hesap_hareket('platform_havuz')`, oda XP'si + `room_stat_deltalari`,
  `outbox_events`.

Eksik olan tek şey **istemci erişimiydi**: RLS açık ama politika yok, sarmalayıcı
yok. `059` o kapıyı açıyor: komisyon **%30**, `gifts_enabled` açık, kataloğa
`kod/emoji/renk1/renk2/kademe` kolonları + 29 hediye, okuma politikaları,
`hediye_gonder_v2`, `benim_bakiyem_v2`, `kazanc_*_v2`, `son_hediyelerim_v2`,
`admin_altin_yukle`, `hediye_komisyon`.

**Para birimi:** hediye **ALTIN** ile gönderilir (elmas satın alınıp altına
çevrilir), kazanç `kullanicilar.kazanc_puani`nda birikir. `058`'in tabloları
artık kullanılmıyor (silinmedi, istemci koptu).

#### Yayıncı paneli + para çekme

- Panel gizliydi: `isStreamer` DB'den hiç gelmiyor (kolon yok), sabit false.
  Giriş herkese açıldı.
- Ekran baştan sona yeşildi → siyah-altın. Kazanç kartı, **saatlik kazanç
  grafiği** (Bugün/Dün, "en iyi saat"), son 7 gün, son gelen hediyeler —
  hepsi `hediye_gecmisi`'nden gerçek veri.
- Para çekme tek uzun formdu, %16 kesintiyi ancak kendi ID'ni yazınca
  öğreniyordun → üç adım: **Tutar → Alıcı → Onay**, kesinti alıcı seçilirken
  yazıyor, başarı ekranı tam ekran. (Rakamlar hâlâ örnek veri; gerçek çekim
  `withdrawal_requests` + `cekim_talep_olustur`'a bağlanacak.)

#### Hediye görselleri

- Yayın şeridi 16 sn kayıyordu → sağdan girip **yerinde duran** kapsül,
  üst barın altında.
- `GiftFx`: dev emoji + emoji kopyaları → gradyan madalyon, halkalar, renkli
  kıvılcımlar, kademe çipli bilgi kapsülü.
- `BigGiftOverlay`: emblem madalyona alındı, alt açıklama yeniden düzenlendi.
- Hediye artık **sohbete de düşüyor** (kim → kime, ne, kaç tane), kompakt
  kapsül olarak.
- Hediye kutusu: mor → siyah-altın, gerçek bakiye + "＋" ile cüzdan, açılır
  adet seçici, toplam tutar, sahte "LV.1 · 5000 EXP" çubuğu silindi.

#### Oda içi senkronizasyon (devam ediyor)

- Koltuklar **tamamen yerel state'ti** — kimse kimsenin mikrofona çıktığını
  görmüyordu. Koltuk + mikrofon durumu presence yüküne alındı (`koltuk`,
  `mic`), gerçek odada ızgara presence'tan çiziliyor.
- Sahip koltuğu mock `SEATS`ten geliyordu → her odada "Ardaowski" sahipti.
  Artık sahip DB'den (`odaSahibi`): odadaysa canlı fotoğrafı, değilse soluk
  + "Ayrıldı" çipi.
- `Room.ownerId` eklendi; sahip eşleşmesi isimle değil uid ile yapılıyor.
  `isMine` de ownerId'ye bakıyor (oda listesi profil yüklenmeden çekilirse
  sahip kendi odasında ziyaretçi sanılıyordu).
- **Çözülen son hata:** host koltuğundaki `Portrait`'e ziyaretçi için
  `photo={undefined}` geçiliyordu — sahibin fotoğrafı hesaplanıyor ama
  ekrana hiç verilmiyordu.
- ⚠️ **AÇIK:** "koltuğa oturdum, karşı tarafta bir süre görünüp kayboluyor".
  `room.tsx`'te geçici `console.log("[presence] …")` teşhis satırları var,
  Metro loglarından izlenecek. **İş bitince o satırlar kaldırılacak.**

#### Veritabanı dökümü — `db/SEMA_DOKUMU.md`

Anon anahtarla şema okunamıyor (her tabloda `REVOKE ALL FROM anon` + RLS).
Geçici `SECURITY DEFINER` döküm fonksiyonlarıyla çıkarıldı, sonra silindi:
**104 tablo · 838 sütun · 131 fonksiyon**. Güvenlik durumu temiz: RLS
103 tablonun hepsinde açık, ekonomi tablolarının hiç politikası yok
(yani herkese kapalı), anon'a verilmiş yazma yetkileri politikasız olduğu
için işlemiyor.

**Temel şemada hazır ama BAĞLANMAMIŞ olanlar:** `cuzdanlar` + `wallet_ledger`
(partisyonlu) + `balance_lots`, `magaza_esyalari` + `kullanici_envanteri`,
`ajanslar` + `ajans_uyeleri` + `yayinci_odemeleri`, `withdrawal_requests`,
`kur_oranlari`, `elmas_paketleri`, `satin_almalar`, `kullanici_vip`,
`leaderboards`, `room_statistics`, `kyc_requests`, `risk_events`,
`user_limits`, `idempotency_keys`, `outbox_events`.

### 30 Ağustos — sıralama, görevler ve tek altın bakiyesi

#### Sıralama gerçeğe bağlandı (060)

Beş sekmenin beşi de `data/seed.ts` sabitleriydi (uydurma isimler, uydurma
puanlar). Artık:

- **Zenginlik** = dönem içinde en çok hediye GÖNDEREN (`toplam_deger`).
- **Cazibe** = en çok hediye ALAN (`kazanc_miktari` — yayıncı panelindeki
  kazançla aynı sayı olsun diye komisyon düşülmüş hâli).
- **Odalar** = odada dönen hediye değeri; henüz hiç hediye dönmediyse eskisi
  gibi en kalabalık odalar, üstünde bunu söyleyen bir etiketle.
- **Ajanslar / Yayıncılar** = dürüst boş durum. Uydurma şampiyon listesi
  (`AGENCY_RANKS`, `STREAMER_RANKS`) silindi; o tablolar temel şemada duruyor
  ama tek bir ajans/yayıncı kaydı bile yok.
- **Dönem seçici** eklendi (Bugün / Hafta / Ay / Tüm zaman). Başlıktaki
  "Haftalık · 2g 14s kaldı" sabit yazıydı; sayaç artık sunucudan geliyor.

`leaderboards` + `leaderboard_entries` anlık görüntü tabloları KULLANILMADI:
onları dolduracak bir zamanlayıcı yok (pg_cron kurulu değil). Sıralama okuma
anında hesaplanıyor — bu veri hacminde daha basit ve her zaman güncel.
Yavaşlarsa fonksiyon imzaları aynı kalarak o tablolara geçilebilir.

#### Görevler gerçeğe bağlandı (061)

`data/tasks.ts` sabit demo listesiydi (5 görev, 7 gün ödülü, hepsi yalan).
Artık `gorevler` + `kullanici_gorev_ilerlemesi` + `gunluk_giris_odulleri` +
`kullanici_gunluk_giris` tablolarından.

**İlerleme İSTEMCİDEN GELMİYOR.** "Görevi ilerlet" diye bir RPC yok; olsaydı
herkes kendi sayacını yazıp ödülü bedava alırdı. İlerleme her okumada kaynak
tablolardan sayılıyor: `oda_ziyaretleri`, `oda_mesajlari`, `hediye_gecmisi`
(gönderen ve alıcı), `kullanicilar_takip`. İlerleme tablosuna yalnızca
"ödül alındı" işareti düşüyor — o da (kullanıcı, görev, gün) üzerinde tekil
indeksle korunuyor.

- 5 günlük görev: odaya katıl, 10 mesaj, hediye gönder, hediye al, takip et.
- 7 günlük giriş serisi; bir gün atlanınca seri sunucuda sıfırlanıyor.
- Ödüller **altın** (elmas değil): elmas satın alınan varlık, onu bedava
  dağıtmak monetizasyonu deler. Ödül promo kaynaklı lot olarak yatıyor —
  hediyeye harcanabilir, çekilemez.
- Görev satırlarına ilerleme çubuğu eklendi ("4/10" tek başına ne kadar
  kaldığını göstermiyordu).

#### İki ayrı altın bakiyesi sorunu (062)

Mağaza/envanteri olduğu gibi bırakma kararı verildi (çalışıyor), ama altında
gerçek bir çatlak vardı: **059'dan sonra kullanıcının iki ayrı altını olacaktı.**

| | altını nereden düşürüyor | bakiyeyi nereden okuyor |
|---|---|---|
| Hediye (059) | `lot_harca` → `balance_lots` | `cached_altin_balance` |
| Mağaza (056) | `_bakiye_uygula` → `cuzdan` | `cuzdan` |

Altın yüklemesi (`admin_altin_yukle`) yalnız temel deftere yazdığı için mağaza
sürekli "Yetersiz altın" derdi; profil/cüzdan bir rakam, hediye kutusu başka
bir rakam gösterirdi.

`062` tabloları taşımıyor — `esyalar` / `kullanici_esyalari` yerinde. Yalnızca
altının **nereden düştüğü** ve **nereden okunduğu** tek yere çekiliyor:
`esya_satin_al` artık `lot_harca` kullanıyor, `benim_bakiyem()` temel şemanın
cache sütunlarını okuyor. İmza değişmediği için profil, cüzdan ve mağaza
ekranlarında tek satır değişmedi. Cüzdan hareketleri de `cuzdan_hareketleri`
yerine `wallet_ledger`dan geliyor (RPC yoksa eski tabloya düşüyor).

Eski `cuzdan` tablosu silinmedi; artık kimse okumuyor.

#### Enum etiketleri artık tahmin edilmiyor

`bakiye_kaynagi` ve `islem_tipi` temel şemanın enum'ları ve repoda tanımları
yok — dökümde yalnızca "USER-DEFINED" yazıyor. Etiketi tahmin edip yanlış
yazarsak hata ancak kullanıcı ödülü almaya çalışınca çıkardı. Bu yüzden
`_enum_etiket(tip, adaylar[])` yardımcısı eklendi: çalışma anında aday
listesinden var olanı seçiyor, hiçbiri tutmazsa **veritabanındaki gerçek
etiket listesini yazan** bir hata veriyor. Yani ilk denemede doğru etiket
öğrenilip tek satırda sabitlenebilir.

### 30 Ağustos — ikinci yarı: oda deneyimi ve rozetler

#### Enum etiketleri artık tahmin değil (063-064)

059-062 çalıştırıldıktan sonra `_enum_liste` ile gerçek etiketler okundu ve
`db/SEMA_DOKUMU.md`'ye **"Enum tipleri"** bölümü eklendi (23 tip). İki hata
çıktı:

- `_altin_harca` **kırıktı**: aday listesinde `magaza`/`satin_alma`/`harcama`
  vardı, gerçeği **`magaza_satin_alma`**. Hiçbir aday tutmadığı için her
  mağaza satın alması hata veriyordu.
- `_odul_ver` çalışıyordu ama yanlış kovaya yazıyordu (`bonus`+`admin_ekleme`
  seçiliyordu); doğrusu **`campaign`+`kampanya_odulu`**. `campaign` promo
  tarafına düşer: ödül altını hediyeye harcanır ama çekilemez.

> **YETKİ KURALI — pahalıya patlayan ders:** PostgreSQL yeni fonksiyona
> **PUBLIC**'e EXECUTE verir ve `anon` PUBLIC'in içindedir. `REVOKE … FROM anon`
> tek başına KAPATMAZ. Her yeni fonksiyonda önce `REVOKE ALL … FROM PUBLIC`,
> sonra hedef role `GRANT`. 064 tam bu yüzden gerekti.

Ölçüldü: 063+064 sonrası hediye/sıralama/görev/cüzdan RPC'lerinin hepsi ve
`hediyeler`/`esyalar`/`gorevler` tabloları giriş yapmamış birine **kapalı**
(42501).

#### Oda listesi canlı (065)

Yeni açılan oda listede 15-20 sn sonra beliriyordu. Sebep Supabase değil,
tasarımdı: liste yalnızca ekran ODAKLANDIĞINDA çekiliyordu, listeye bakarken
duruyorsan hiçbir sorgu atılmıyordu. "Oda boşalınca hemen gidiyor" da aynı
şeyin ters yüzüydü — odadan çıkıp listeye dönmek zaten bir odaklanma.

`odalar` tablosu Realtime yayınına alındı; her değişiklik (yeni oda,
katılımcı sayısı, ad, kapak, silme) anında düşüyor. 400 ms bekleme var, çünkü
oda açılırken INSERT'i hemen bir sayaç UPDATE'i izliyor.

#### Koltuk senkronu — asıl sebep bulundu

Metro logu koltuğun sıfırlanmadığını, **ekranın yeniden kurulduğunu** gösterdi:
oturunca `koltuk=0` iki kez yazılıyor, hemen ardından `koltuk=null` iki kez —
mount imzası.

- **Sebep:** `room.tsx` seçicisiz `useApp()` çağırıyordu → TÜM store'a abone.
  5 saniyede bir dönen hesap yasağı yoklamasının `set({banChecked:true})`'i
  bile ekranı baştan render ediyordu. Alan alan aboneye çevrildi.
- `mySeat`/`micOn` artık **store'da** (`appStore.koltugum`, oda kimliğiyle).
  Ekran yeniden kurulsa bile koltuk düşmüyor.
- `ch.subscribe` geri çağrısı kurulduğu andaki `presenceYaz`ı kapatıyordu
  (içinde `mySeat` hep null). Soket yeniden bağlanınca presence `koltuk: null`
  yazılıyordu → `presenceYazRef` ile hep tazesi çağrılıyor.
- Uygulama öne dönünce (`AppState`) presence tazeleniyor.

Doğrulandı: `[oda] UNMOUNT` artık yalnızca odadan çıkarken bir kez.

#### Giriş efekti kararsızlığı

Kural "önceki sync'te yoktu" idi. Hızlı çık-gir yapınca karşı taraf seni arada
hiç "yok" görmüyor (iki değişim tek diff'te birleşiyor) ve giriş kaçıyordu.
Artık presence yükündeki `katildi` damgasına bakıyor: damga ilerlemişse
yeniden girmiştir.

#### Kendi mesajım görünmüyordu

Metro logu: `Realtime send() is automatically falling back to REST API`.
Broadcast websocket yerine REST'e düşünce **gönderene echo edilmiyor**, yani
`self: true` çalışmıyor. Kendi odanda tek başınayken yazdığın mesaj hiç
görünmüyordu. Artık kendi mesajım yerel ekleniyor, echo gelirse eleniyor.

#### Oda alt barı yeniden kuruldu

Odaya girer girmez göze çarpan ilk şey ekranın altını kaplayan boş bir yazı
kutusuydu. Referans (WePlay/Yalla) düzenine geçildi:

- Koltukta **değilken**: `[hoparlör] [ Yaz … ] [☰] [el] [hediye]`
- Koltukta**yken**: `[hoparlör] [mikrofon] [emoji] [sohbet] [☰] [el] [hediye]`
  — hoparlör yerinde kalır, mikrofon ve emoji sağına eklenir, "Yaz …" hapı
  yuvarlak sohbet düğmesine küçülür.

"Yaz …" hapına dokununca satır yazma moduna geçiyor (@ düğmesi, "Lütfen
nazikçe konuşun" kutusu, gönder). ☰ → oda araçları ızgarası: Oda Profili,
Odadakiler, Mikrofon Sırası (rozetli), Katkı Sıralaması, Oda İstatistiği,
Oda Ayarları (yalnız sahip), Sesi Aç/Kapat, Şikayet Et. **Müzik ve Foto
konmadı** — arkalarında hiçbir şey yok, ölü düğme koymadık.

Sohbetin üzerinde yüzen el kaldırma düğmesi kalktı, alt bardaki yerine geçti.

#### Emoji tepkisi

Alt bardaki yüz düğmesinden seçilen emoji sohbete düşmüyor, gönderenin
**avatarını kaplayıp** kayboluyor (1,6 sn, yaylı giriş). Odadaki herkes
broadcast ile aynı anda görüyor. `Seat` tipine `uid` eklendi ki tepki doğru
koltuğa düşsün.

#### Yönetim menüsü + mikrofon daveti

Kullanıcı kartındaki dişli çıplak bir listeydi, üç satır aynı renkte. Artık
altın çizgili başlık (kimin üzerinde işlem yapıldığı yazıyor), renkli ikon
karesi ve **her satırın altında ne yaptığını söyleyen açıklama** —
"Mikrofondan İndir" ile "Odadan Çıkar" farkı eskiden yalnızca ikondan
anlaşılıyordu.

**Mikrofona davet:** oda sahibi ve yardımcı, koltukta olmayan birini
çağırabiliyor. Doğrudan oturtmuyor — hedefte onay kutusu açılıyor.

#### Oda rozetleri (066)

Rozetler `data/seed.ts` içindeki sahte odalara elle yazılmış sabitlerdi;
gerçek odalarda hiç görünmüyordu. Görseller (49 rozet) zaten hazırdı, eksik
olan veriydi. İki kaynak, tek görünüm:

- **kural** → okuma anında hesaplanır, tabloda durmaz. "Haftalık şampiyon"
  dün doğruysa bugün başkasının olabilir; anlık görüntü tutmak yanlış olurdu
  ve dolduracak zamanlayıcı da yok (060'la aynı gerekçe).
  Kaynaklar: `hediye_gecmisi`, `oda_ziyaretleri`, `oda_mesajlari`,
  `oda_seviyeleri`.
  11 rozet: haftalık şampiyon/2./3., hediye yağmuru, ateş serisi, popüler,
  sohbet ustası, gece kuşu, erkenci, yükselen yıldız, seviye ustası + `lv`.
- **elle** → `oda_rozetleri` tablosunda durur. Efsanevi, Etkinlik Ustası,
  VIP Oda, sezonluklar… 15 rozet. Yönetim ekranından (`admin-room-edit`)
  verilip geri alınabiliyor.

**Kural rozeti elle verilemez** — verilebilseydi liste yalan söylerdi;
`admin_oda_rozet_ver` bunu reddediyor.

### Sıradakiler

> **Karar (29-30 Ağustos):** ekonomide kendi paralel yapımızı değil **temel
> şemayı** kullanacağız — ama tablo tablo taşımak yerine yalnızca ÇAKIŞAN
> noktayı taşıyoruz. Hediye 059'la, altın bakiyesi 062'yle geçti; eşya
> tabloları (056) çalıştığı için yerinde bırakıldı.
>
> Çalıştırılmayı bekleyen migration listesi §10'un başında.

1. 🔴 **ODA LİSTESİ GÖRÜNÜRLÜĞÜ — açık hata, ilk iş.** Ayrıntı §10'un
   başında. Kişi sayısı şu an İKİ kaynaktan geliyor (DB sayacı + presence);
   önce birine karar verilip diğeri sökülmeli.
2. **Oda içi senkron hatası — sebep bulundu (30 Ağustos), doğrulanacak.**
   `ch.subscribe` geri çağrısı kurulduğu andaki `presenceYaz`ı kapatıyordu;
   içindeki `mySeat` hep `null`dı. Soket düşüp yeniden bağlanınca (iOS
   uygulama arkaplana alınınca soketi kapatır) Supabase aynı geri çağrıyı
   tekrar `SUBSCRIBED` ile çağırıyor ve presence `koltuk: null` olarak
   yeniden yazılıyordu → karşı tarafta mikrofondan düşüyordun ama odada
   görünmeye devam ediyordun. Artık `presenceYazRef` ile hep tazesi
   çağrılıyor, ayrıca uygulama öne dönünce (`AppState`) presence tazeleniyor.
   İki cihazda doğrulanınca `[presence]` teşhis logları **kaldırılacak**.
2. ~~Mağaza/envanter taşıması~~ — **yapılmayacak, karar 30 Ağustos.** 056'nın
   tabloları (`esyalar`/`kullanici_esyalari`) çalışıyor ve yerinde kalıyor;
   `magaza_esyalari`/`kullanici_envanteri` boş duruyor. Taşınan tek şey ALTIN
   oldu (062) — çakışan asıl nokta oydu.
3. ~~Cüzdan taşıması~~ — **062 ile yapıldı.** `benim_bakiyem()` ve
   `esya_satin_al` temel deftere (`balance_lots` + `cached_altin_balance`)
   bağlandı, hareketler `wallet_ledger`dan okunuyor. Kalan: elmas tarafı
   (satın alma / `elmas_altin_donustur`) hâlâ bağlı değil.
4. **Ajans + yayıncı** — `ajanslar`, `ajans_uyeleri`, `yayinci_odemeleri`
   bağlanacak; `kullanicilar` üzerinde yayıncı bayrağı yok, yönetimden
   atanacak bir alan gerekiyor.
5. **Para çekme gerçeğe** — `withdrawal_requests` + `cekim_talep_olustur`
   (hesap bilgisi `pii_sifrele` ile şifreli), `kur_oranlari.kazanc_kuru`.
6. **Elmas satın alma (IAP)** — `elmas_paketleri`, `satin_almalar`,
   `satin_alma_dogrula_fn`. Elmas → altın dönüşümü `elmas_altin_donustur`.
7. ~~Sıralama listeleri~~ — **060 ile yapıldı** (zenginlik/cazibe/odalar,
   dönem seçici). Kalan: ajans ve yayıncı sekmeleri, o kayıtlar oluşunca.
8. **DM'den hediye** — peer'ın dbId'si ekranda yok, gönderim yalnızca
   animasyon oynatıyor. "Tümü"ne gönderim de tek RPC ile yapılamıyor.
9. **Oda sohbeti veritabanına HİÇ yazılmıyor.** Sohbet yalnızca broadcast;
   `sendRoomMessage` repoda duruyor ama hiçbir yerden çağrılmıyor, yani
   `oda_mesajlari` hep boş. İki sonucu var: (a) sonradan giren sohbet
   geçmişini göremiyor, (b) **Sohbet Ustası / Gece Kuşu / Erkenci rozetleri
   asla tetiklenmiyor** (066 kurallarını o tabloya dayadı). Karar gerekiyor:
   sohbeti DB'ye de yazmak mı, o üç rozetin kuralını değiştirmek mi.
10. **Anon'a açık RPC denetimi yapılmadı.** 063/064 yalnızca 059-062'nin
    fonksiyonlarını kapattı. Ölçüldü: `benim_hesap_yasagim` ve
    `oda_katilimci_yaz` hâlâ anon anahtarla çağrılabiliyor. İkincisi
    içeride `benim_kullanici_id() IS NULL` kontrolüyle korunuyor (yazma
    olmuyor) ama **eski migration'ların tamamı taranmalı** — aynı desende
    korumasız olan varsa açık demektir.
11. **Hayalet odalar** — `aktif_katilimci_sayisi` yalnızca istemci yazıyor
   (odadaki en küçük uid). Uygulama zorla kapanırsa sayı >0 kalıyor ve oda
   listede boşken duruyor. Sunucu tarafı presence yok; çözüm ya bir TTL
   (sayaç N dakikadır dokunulmadıysa 0 say) ya da `oda_uyeleri` üzerinden
   kalp atışı. 065 canlı yayını açtı ama bu ayrı bir sorun.
12. ~~Oda rozet sistemi~~ — **066 ile yapıldı** (kural motoru + elle verme).
    Kalan: kullanıcı rozetleri hâlâ ayrı bir konu; oda rozetleri yalnızca
    oda listesinde çiziliyor, oda profilinde de gösterilmeli.
13. ~~Görev sistemi~~ — **061 ile yapıldı.** Kalan: haftalık görevler
    (`gorev_tipi` enum etiketleri bilinmiyor, önce öğrenilecek) ve başarımlar.
14. **Hazır avatarlar `i.pravatar.cc`'den geliyor** — dış servis + gerçek
    insan fotoğrafları; yayından önce kendi setimizle değiştirilmeli.
15. `RoomPanel`'deki "Takip Et" bitti, ama "Katıl" dışındaki oda rozetleri
    hâlâ mock.
16. Splash Expo Go'da görünmüyor · `expo-video` cihazda denenmedi ·
    paket sürüm uyumsuzluğu (`expo@54.0.35` → `~54.0.37`).

---

### Önceki oturum — Hesap yasağı sağlamlaştırma

- **EN SON İŞ — Hesap yasağı sağlamlaştırma:**
  - **Oda listesi flaşı giderildi:** `appStore.banChecked` state + `AppOverlays`
    opak örtü — oturum var ama ilk yasak kontrolü bitmemişken içerik gösterilmez;
    yasaklı kullanıcı bir an bile oda listesini görmez, doğrudan ban ekranı gelir.
  - **Anında kapı dışarı:** yasak yoklaması 10sn → **5sn** (realtime birincil,
    yoklama garanti); yasak görülünce `signOut` + tam ekran engel.
  - **Ban ekranı = aniden açılan merkez modal:** `AccountBanBlock` yeniden — kararan
    arka plan + `ZoomIn` ile pat diye açılan kart (sebep + süre + Çıkış Yap).
  - **Sistem DM'i (048):** `hesap_yasak_ver/kaldir` artık hedefe kalıcı Sistem DM'i
    bırakır (sebep+süre); yasaklı kişi ancak yasağı KALKINCA DM'de görür. Kalkınca
    da "yasağın kaldırıldı" mesajı. `npx tsc --noEmit` temiz.
  - Mic yasağı (room.tsx, 028) zaten sağlamdı — dokunulmadı.
- **Bu oturumda yapıldı (§9.5 ÖZEL ID SİSTEMİ — frontend tam):**
  - Aşama 1: level/role/special rozetleri normalize (hiza/boyut, VIP merkez).
  - Aşama 2b: **premium (≤5, 60 baked banner, listeden seç)** + **kapsül (6-7,
    25 kart teması + renk-uyumlu hap)** + düz (8+). appStore `ozelId/ozelIdTip/
    ozelIdTema` (demo). special-id claim akışı, profil gösterimi + kopyalama,
    beta yönlendirme banner'ı, sağ '>' oku → public self-önizleme (yetki DB'den).
  - Aşama 3: bilgi pencereleri (saydam, butonsuz, oto/dokunuş kapanır, fade).
  - `npx tsc --noEmit` temiz, `npx expo export --platform web` başarılı (her commit).
  - Oda rozetleri kullanıcı isteğiyle bu turda DEĞİŞTİRİLMEDİ.
- **ÖZEL ID BACKEND ARTIK TAMAM (§9.5 Aşama 2c — migration 044-047):**
  1. ✅ **DB'ye bağlandı:** `ozel_id`/`ozel_id_tip`/`ozel_id_tema` + gerçek
     `beta_tester`/`premium_hak` (044); `profileRepo` + store DB'den okur/yazar,
     `setOzelId/clearOzelId` RPC entitlement + basamak + benzersizlik zorlar.
  2. ✅ **Sistem DM hatırlatması:** 046 — beta + özel-id yok tespit edilince
     `betaKapsulHatirlat()` idempotent hedefli Sistem DM'i atar (bir kez).
  3. ✅ **Yeni kayıt 9+ hane:** 045 `yeni_public_id()` 9 haneye çıktı.
  4. ✅ **admin atama + entitlement:** 047 + `admin_hak_ata`; admin-user-edit
     Kimlik bölümünde "ÖZEL ID HAKLARI" beta/premium ver-al toggle'ları.
  - Ek: `2a8400b` profildeki "Demo · Beta Tester" toggle'ı kaldırıldı (artık
    DB'den geliyor), aramada özel ID de gösteriliyor.
- **KALAN (küçük):** Sistem DM mesajına tıklayınca `/special-id` derin-linki
  (şu an profil banner'ı yönlendiriyor). Oda ekonomisi + kapalı feature flag'ler
  (§7, §9) hâlâ bilinçli ertelenmiş durumda.
- **Son commit:** `2a8400b` — "profil: demo toggle'larını kaldır; aramada özel
  ID göster" (dal: `claude/metro-recovery-1xc2kq`, origin ile senkron).
- **`npx tsc --noEmit`:** temiz (0 hata) — doğrulandı.
- **Android + iOS bundle:** ikisi de sorunsuz derleniyor (bu sandbox'ta
  localhost:8081 üzerinden test edildi).
- **Cihazda görsel doğrulama YAPILAMADI** — §8'deki tünel kısıtı yüzünden.
  Kullanıcının kendi ortamında (teleport ya da kendi bilgisayarı) şunları
  test etmesi gerekiyor:
  1. Sekmeler arası hızlı geçiş → siyah ekran yok, yumuşak kayma var mı?
  2. iOS 26 cihazda tab bar gerçekten liquid glass mi görünüyor?
  3. Android'de DM/oda sohbeti/formlar açıkken klavye input'u kapatıyor mu,
     yoksa üstünde mi kalıyor?
- Bu doğrulamalar yapılıp bir sorun bulunursa, ince ayar tek noktadan
  (`KeyboardAware.tsx`, `BottomNav.tsx`, `(tabs)/_layout.tsx`) yapılabilir.
- **Henüz bir Pull Request açılmadı** — kullanıcı özellikle istemedikçe
  açılmayacak (talimat böyle).

## 11) Yeni Sohbete Nasıl Devam Edilir

1. Bu dosyayı (`PROJE_DURUMU.md`, repo kökünde) oku.
1b. **Migration yazmadan önce `db/SEMA_DOKUMU.md`’ye bak.** Temel şemanın
   repoda dosyası yok; orada zaten var olan bir tabloyu tekrar kurmaya
   çalışmak 058’de olduğu gibi çakışmaya yol açıyor (`hediyeler`).
   O döküm canlı veritabanından çıkarıldı: 104 tablo, 131 fonksiyon.
2. `git log --oneline -20` ile en son commit'leri teyit et (bu dosya
   güncel olmayabilir, git her zaman gerçek kaynak).
3. `db/migrations/` klasöründeki en yüksek numaralı dosyaya bak — DB şu an
   nerede kaldığını gösterir.
4. Kullanıcı yeni bir istek getirdiğinde önce mevcut deseni/repo katmanını
   kullan (§4 mimari kuralı) — sıfırdan yazma.
5. Ortam kısıtları (§8) tekrar araştırılmasın — doğrudan kullanıcıya
   teleport/lokal çalıştırma öner.
