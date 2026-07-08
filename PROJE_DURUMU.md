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
  migrations/           → 001–047 sıralı SQL migration'lar (idempotent, tekrar
                           çalıştırılabilir — CREATE OR REPLACE / IF NOT EXISTS)
  HEPSI_020_047.sql     → 020'den 047'e kadar TEK YAPIŞTIRMA birleşik dosya
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

## 6) Veritabanı — Migration Listesi (db/migrations/, 001-047)

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

**Birleşik dosyalar:**
- `HEPSI_020_047.sql` — 020'den 047'e kadar hepsi tek yapıştırmada (025 önce,
  tek başına çalıştırılmalı — enum değeri ekleme kısıtı).
- `SON_035_036_037.sql` — sadece bu üçü ayrı çalıştırmak için.

**Temel şema (bu repoda dosyası yok, Supabase'te zaten kurulu):** `kullanicilar`,
`odalar`, `gonderiler` (akış), vb. — `schema_v7_eklentileri.sql` bunların
üstüne ek kolon/tablo ekliyor (feed, etkinlik, görev, kupon, özel ID,
arkadaşlık için).

## 7) Feature Flag'leri — MVP'de Kapalı Olanlar (`src/lib/features.ts`)

Bunlar **kodu/ekranı/rotası yerinde duran ama arayüzden gizlenmiş**
özellikler — bayrağı `true` yapmak yeterli, ekstra iş gerekmiyor:

```
roomGift: false        → Oda alt barındaki hediye ikonu
streamerPanel: false    → Profil menüsü "Yayıncı Paneli"
giftHistory: false      → Profil menüsü "Hediye Geçmişi"
giftCoupon: false       → Profil menüsü "Hediye Kuponu Gir"
store: false            → Profildeki "Mağaza" tile'ı
vip: false              → Profil menüsü "Aron VIP"
rankTab: false          → Alt navigasyon "Sıralama" sekmesi (sidebar'dan erişilir)
inventory: false        → Profildeki "Eşyalarım"
friends: false          → DM'deki "Arkadaşlık" kısayolu
events: false           → DM'deki "Etkinlik" kısayolu
notifications: true     → (AÇIK — Faz 3'te gerçekleşti)
visitors: false         → DM'deki "Ziyaretçi" kısayolu
profileGift: false      → Başkasının profilinde "Hediye Gönder"
dmGift: false           → DM sohbet kutusu hediye butonu
```

**Neden kapalı:** Hediye/gifting ve ona bağlı ekonomi (harcanan altın,
mağaza, VIP, envanter) **tamamen mock** — gerçek hediye→oda→altın defteri
kurulmadı. Kullanıcı bilinçli olarak bunu **erteledi** (bkz. §9).

## 8) Bilinen Ortam Kısıtları + ÇALIŞAN Tünel Çözümü (ÖNEMLİ — token/zaman kaybetme!)

Proje **Expo SDK 54** ile başlatıldı ve **Claude Code on the web** (bulut
sandbox) üzerinde geliştiriliyor. Kullanıcının fiziksel telefonu bu sandbox'a
**tünel olmadan doğrudan bağlanamıyor**. İki mekanizma denendi:

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
2. `git log --oneline -20` ile en son commit'leri teyit et (bu dosya
   güncel olmayabilir, git her zaman gerçek kaynak).
3. `db/migrations/` klasöründeki en yüksek numaralı dosyaya bak — DB şu an
   nerede kaldığını gösterir.
4. Kullanıcı yeni bir istek getirdiğinde önce mevcut deseni/repo katmanını
   kullan (§4 mimari kuralı) — sıfırdan yazma.
5. Ortam kısıtları (§8) tekrar araştırılmasın — doğrudan kullanıcıya
   teleport/lokal çalıştırma öner.
