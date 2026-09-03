# Aron Chat — Onaylı Yol Haritası (Faz 0-4)

> **Bu dosya ne:** 2 Eylül 2026'da yapılan A'dan Z'ye analizin (3 keşif ajanı
> + 1 tasarım ajanı, kullanıcı onaylı) uygulama planı. Hangi fazda
> olduğumuz `PROJE_DURUMU.md` §10'un başında; burası planın kendisi.
>
> **DURUM (3 Eylül, gece):** Faz 0 kod tarafı ✅ bitti (13 commit). Faz 1'de
> 1.1 → 1.4b ve sonradan eklenen 1.14 → 1.16 ✅ bitti (15 commit,
> `f8d1839` → `893640c`).
>
> **⛔ EN ESKİ TIKANMA — HÂLÂ KULLANICIDA:** `db/migrations/SON_072_079.sql`
> canlıda çalıştırılmadı, Faz 0 iki-cihaz duman testi yapılmadı. Faz 1 kodu
> bundan bağımsız olduğu için paralel ilerledi, **ama Faz 0'ın kapattığı
> mantık hataları canlıda hâlâ AÇIK** (yardımcı yetkileri, koltuk yarışı,
> çift ödül, e-posta sızıntısı, kalıcı sohbet).
>
> Faz 1'in cihaz doğrulaması da yapılmadı: kullanıcı yalnız oda listesindeki
> boş durum animasyonunu gördü, kalan 14 commit ekranda doğrulanmadı.

## Kullanıcının verdiği kararlar

| Karar | Seçim |
|---|---|
| Support rolü kapsamı | **Salt okunur + rapor işleme.** Kullanıcı/oda/rapor detayını görür, rapor kapatır, sistem mesajı/uyarı gönderir. Yasak, bakiye, rol atama, oda kapatma YAPAMAZ. |
| RTC SDK | **Agora.** Token sunucusu Supabase Edge Function ile. |
| Öncelik | **Mantık hataları + kararlılık** önce. Açık şart: "bir yeri yapıp bir yeri bozmak" tekrarlanmayacak. |
| Para akışları (IAP/çekim/VIP/referral) | **Betada gerçeğe bağlanacak** (Faz 4). IAP dev build + mağaza ürünleri gerektirir. |
| DM/profil hediyesi | Faz 1'de bayrakla kapatılır (`features.ts` `dmGift`/`profileGift` → false), Faz 4'te `hediye_gonder_v2`'ye gerçek bağlanır. |

## Regresyon önleme disiplini (her faza gömülü)

1. **Değişiklik öncesi okuyucu taraması:** alan/fonksiyon değiştirilmeden önce `grep` ile tüm okuyucular listelenir, commit mesajına yazılır.
2. **Tek commit = tek konu.**
3. **Faz sonu iki-cihaz duman testi** geçmeden sonraki faza geçilmez.
4. **Sadece ekleme tercih edilir:** mevcut yol yerine üstüne katman (ipucu katmanı deseni).
5. **`tsc --noEmit` her değişiklikte; Metro logu her testte okunur** (tahmin değil kanıt).

## Migration düzeni

Konu başına dosya (tek büyük dosya değil). Faz 0 → 072-079 ✅, para/hediye işi → 080-085 ✅ (planda yoktu, araya girdi). **Faz 2 artık 086'dan, Faz 4 090'dan başlıyor.** Yeni dosya açmadan önce `ls db/migrations` ile son numarayı GÖR — plandaki numara tutmayabilir. Hepsi idempotent; `REVOKE ... FROM PUBLIC, anon` + `SET search_path = public, pg_temp`. Enum eklemesi (088) TEK BAŞINA ayrı turda (025 dersi). Her migration öncesi `db/SEMA_DOKUMU.md`.

---

## FAZ 0 — Mantık hataları + kararlılık ✅ KOD BİTTİ · SQL ÇALIŞTI · **iki cihaz duman testi HÂLÂ YAPILMADI**

| Adım | Dosya/commit | Ne |
|---|---|---|
| 0.1 ✅ | `072_oda_moderatoru_sozluk.sql` | `_oda_moderatoru` yanlış sözlük (`yonetici/moderator` ölü enum) → `('sahip','yardimci')`. Yardımcının mic yetkileri sunucuda ilk kez çalışıyor. **`oda_yetkileri` + `oda_rolu` ÖLÜ, canlandırılmayacak.** |
| 0.2 ✅ | `073_koltuk_yarislari.sql` | `koltuga_otur` koşullu ON CONFLICT + ROW_COUNT; `mic_sirasi_onayla` koşullu UPDATE + `FOR UPDATE SKIP LOCKED`. Yarışta sessiz ezme → 'Koltuk dolu.' |
| 0.3 ✅ | `074_odul_ve_satinalma_yarislari.sql` | `esya_satin_al` kullanıcı satırı kilidi; `gunluk_giris_al` ilk-gün çift ödül (koşullu DO UPDATE). İstemci in-flight kilitleri zaten vardı. |
| 0.4 ✅ | `075_admin_eposta_kisiti.sql` | e-posta yalnız `ben_developer()` (038'de düşen 029 kısıtı). İstemci değişikliği sıfır. |
| 0.5 ✅ | `076_search_path_pg_temp.sql` | `oda_ziyaret_kaydet` pg_temp. |
| 0.6 ✅ | `077_anon_grant_supurme.sql` | 021-024 fonksiyonlarına `FROM PUBLIC, anon`; doğrulama sorgusu dosyada yorum. **Canlıda doğrulanacak.** |
| 0.7 ✅ | `a514d18` | Kendi giriş efekti iki kez oynuyordu — yinelenen mount bloğu silindi. |
| 0.8 ✅ | `078_oda_mesaj_rpc.sql` + roomsRepo | `oda_mesaj_yaz` RPC (trim/500/oda/oda yasağı/mic yasağı sunucuda); 011 INSERT grant'i kapandı; `getRoomMessages` ters sıralama hatası düzeltildi. |
| 0.9 ✅ | `3b2d421` room.tsx | `send()` yanına fire-and-forget DB yazımı; girişte son 50 mesaj tohumu (yalnız `msgs` boşken). Broadcast aynen. |
| 0.10 ✅ | `079_sayac_emekliligi.sql` + istemci | `oda_katilimci_yaz` no-op; `siralama_odalar`/`admin_oda_getir` canlı sayım; istemci sayaç yazıcıları söküldü; admin rapor "şu an" canlı tablodan. |

### Faz 0 duman testi (Cihaz A = sahip, B = ikinci hesap) — YAPILACAK
1. **B1:** A, B'yi "Yardımcı Yap" → B üçüncü kullanıcıyı mikrofondan indirebiliyor, sıra onaylayıp düşürebiliyor.
2. **B2:** A+B aynı boş koltuğa aynı anda → biri oturur, diğeri "Koltuk dolu". Çift dokunuş satın alma → tek ücret; günlük ödül → tek ödül.
3. **B3:** Mesaj ANINDA görünüyor (gecikme regresyonu yok); B çık-gir → son mesajlar geliyor; mic yasaklı hesap RPC'den yazamıyor (SQL Editor'dan denenir).
4. **B5:** developer olmayan super_admin → e-posta "—".
5. **B8:** Kendi giriş efekti TEK; uygulama öldürülünce oda ~2 dk'da listeden düşüyor; online sayıları makul.
6. **Regresyon nöbeti:** koltuk otur/kalk/kilit, mic, hediye, davet — 068-071 kazanımları yerinde; Metro logunda yeni hata yok.

---

## FAZ 1 — Native his + performans (migration yok) — 1.1 → 1.4b ✅

Sıra "riski küçük / kazancı büyük"; her madde ayrı commit(ler).
Yapılanların commit listesi ve bilinçli olarak ATLANANLARIN gerekçeleri
`PROJE_DURUMU.md` §10'da; burası planın kendisi.

1. **1.1 (A3) ✅ `f8d1839`:** `(tabs)/index.tsx` arama ikonu `/preview` → `/user-search`.
2. **1.2 (C4) ✅ `25cfcc1` + `5a66edb`:** İki sıcak yol logu silindi (her presence sync'inde string kuruyorlardı); üretimde `console.log/debug/info` `__DEV__` kapısıyla no-op, `warn`/`error` bilerek duruyor. **Babel eklentisi ERTELENDİ:** projede `babel.config.js` yok, sıfırdan yazmak reanimated/worklets yolunu riske atar; dev build turunda (Faz 4) eklenecek.
3. **1.3 (C2a) ✅ `dcc3a2a` + `eeba834`:** Mesaj tavanı `.slice(-200)` (room.tsx 5 + dm-chat 5 ekleme noktası); `liveMembers.find` → `uyeHaritasi` (`Map<uid, LiveMember>`, 7 arama).
4. **1.4 (C1) — (a) ✅ `8eb09cd`, (b) ✅ `a4f1271`, (c) SIRADA:** `src/components/Touch.tsx` Pressable sarmalayıcı (`pressed && {opacity:.6, scale:.97}` + android_ripple; `kucul={false}` ile küçülme kapatılabilir). (a) oda alt barı 10 + koltuk 2 + aksiyon satırı 1, (b) `Tabs.tsx` + `BottomNav.tsx` (ikisi de `kucul={false}`), **(c) kalan ~810 yer — toplu regex YAPILMAZ, dalga dalga.**
5. **1.5 (C2b) — ERTELENDİ (kullanıcı kararı, 4 Eylül):** "bunun acelesi
   yok, çok sonraya sakla."
   Gerekçe doğru: kaydırmada hissedilen bir takılma bildirilmedi ve listelerin
   çoğu kısa (FlatList'in kazancı ancak uzun listede çıkar). Buna karşılık üç
   somut risk var: (1) oda sohbetinin otomatik en alta kayması
   `onContentSizeChange` ile çalışıyor, FlatList'te bu farklı kurulur ve
   yanlış kurulursa yeni mesajda sohbet alta inmez — ciddi regresyon;
   (2) hızlı kaydırmada boş kare; (3) az satırda kazanç yok, yalnız karmaşa.
   **Önce 1.6 yapılmalı:** asıl darboğaz muhtemelen orada — sohbet satırları
   memo'suz olduğu için her presence güncellemesinde 200 satır birden
   yeniden çiziliyor. Bu, listeyi değiştirmeden çözülebiliyor.
6. **1.6 (C3) ✅ — `ChatRow` memo'landı + `Portrait` silüeti koşullu:**
   Planın teşhisi doğruydu: `React.memo` olduğu gibi İŞE YARAMAZDI, çünkü
   `onSelfPress`/`onTapUser` düz arrow const'tu ve her render'da yeni kimlik
   alıyordu. `useCallback` ile sarmak da yetmezdi — kapanışları geniş
   (`occupants`, `MY_ROLE`, `isDbRoom`, `dbId`, `davetBaslat`,
   `uyeHaritasi`, `seatActions`) ve bayat kapanış riski taşıyordu.
   **Çözüm ref oldu:** kimlik sabit (`useCallback([])`), davranış ref
   üzerinden güncel. `room.tsx` BÖLÜNMEDİ.
   • Memo'nun tutması için üç şart vardı, üçü de sağlandı: `m` kimliğini
     koruyor (mesajlar diziye eklenirken var olanlar yeniden kurulmuyor);
     `balonTema`/`cerceve`/`rol` haritalardan DEĞER olarak geçiyor, yani
     harita kimliği presence senkronunda değişse de memo tutuyor;
     işleyiciler kararlı.
   • **Kazanç:** sohbet 200 mesaj tutuyor ve presence sık senkronlanıyor
     (biri girdi, biri mikrofona çıktı, biri emoji gönderdi). Önce her
     senkronda 200 satırın hepsi yeniden çiziliyordu.
   • **`Portrait` silüeti** fotoğraf yüklendikten sonra da çiziliyordu,
     tamamen kapalı olduğu hâlde. Her Portrait bir SVG ağacı ve bu bileşen
     HER avatarda kullanılıyor. Artık yükleme bitince kaldırılıyor; yüklenene
     kadar duruyor (yerine boşluk koymak "yanıp sönen avatar" olurdu).

7. **1.7 (C5) — sürükle-kapat ✅, `freezeOnBlur` SIRADA:** Plan
   "`Sheet.tsx` → `BottomSheetModal`, 26 modal" diyordu; İKİSİ DE DÜZELTİLDİ.
   • **Sayı yanlıştı:** `<Sheet>` 26 değil, 6 dosyada 11 yerde kullanılıyor
     (26, `CenterModal` ve düz `Modal` dahil TÜM modallerin sayısıydı).
   • **Kütüphane değiştirilmedi.** Amaç sürükleyip kapatma hissiydi, paket
     değil. Gorhom'a geçmek kök sağlayıcı + çocuk API'si + snap point +
     klavye davranışını baştan kurmayı ve 11 çağrı yerini yeniden yazmayı
     gerektiriyordu; kazanç aynı, risk katbekat fazla. Davranış `Sheet`in
     İÇİNE kondu (gesture-handler zaten kurulu, `GestureHandlerRootView`
     kökte duruyordu): dış API aynı, çağrı yerleri değişmedi, yerleşim aynı.
   • **Sürükleme yalnız tutamaçtan.** Sayfaların çoğunda içeride `ScrollView`
     var; gövdeye pan koymak kaydırmayla kavga eder. Tutamaç alanı görünenden
     yüksek (22px) ki parmakla yakalanabilsin. Kapanma: 90px ya da 900 px/sn.
   • `(tabs)/_layout` `freezeOnBlur: true` HENÜZ YAPILMADI.
8. **1.8 (C6) ✅ — görsel ayarları + pravatar söküldü:**
   • `cachePolicy` HİÇBİR YERDE verilmemişti (31 dosya, sıfır kullanım) ve
     `transition` varsayılanı 0'dı — görseller "pat" diye beliriyordu.
     21 uzak görselin hepsine `cachePolicy="memory-disk"` + `transition={160}`
     kondu; `Portrait`e ayrıca `recyclingKey` (FlatList'e geçince şart olacak).
     `Portrait` tek başına en önemlisi: uygulamadaki BÜTÜN avatarlar oradan
     geçiyor.
   • **pravatar.cc TAMAMEN ÇIKTI.** İki yerdeydi:
     – `people.ts` 9 demo kişinin fotoğrafı. Silindi; `Portrait` zaten aynı
       kişiler için `bg/hair/style/acc` ile KENDİ avatarını üretiyor, foto
       onu eziyordu. Oda kapağı yedeği de `Scene`e düşüyor, kırılmadı.
     – `onboarding.ts` 6 hazır avatar. Bu daha kötüydü: HER YENİ KULLANICIYA
       gösteriliyordu, yani mağazaya çıkacak uygulamanın kayıt akışı üçüncü
       taraf bir demo servisine bağlıydı. Liste boşaltıldı; **boşken bölüm
       hiç çizilmiyor**, kullanıcı kendi fotoğrafını yükleyebiliyor,
       yüklemezse üretilmiş avatar geliyor.
   • **KALAN CANLI İŞ:** hazır avatarlar için kendi Storage kovamıza görsel
     yüklenip `PRESET_AVATARS` doldurulacak. Koddan yapılamaz.
9. **1.9 (C7) — kısmen ✅:**
   • **ÖNCE BİR SIZINTI KAPATILDI.** Önbellek kullanıcıya özel veri tutuyor
     (ziyaretçiler, envanter, rozetler) ama ÇIKIŞTA TEMİZLENMİYORDU ve
     anahtarlar kullanıcıya göre isimlendirilmemişti. Aynı telefonda başka
     hesapla girildiğinde öncekinin verisi bir an görünüyordu —
     "cache-first" gereği ekran onu ANINDA çiziyor. `cacheTemizle()` eklendi
     ve `signOutApp` + hesap yasağı dalında çağrılıyor. Bunu yapmadan
     önbelleği yaymak sızıntıyı büyütürdü.
   • **store / inventory / badges** önbellekten tohumlanıyor (persist).
     Üçü de her açılışta sıfırdan yükleniyordu; profil → mağaza → envanter
     gidip gelmek her seferinde bekleme demekti.
   • **visitors DOKUNULMADI:** zaten elle cache-first yapıyor ve çalışıyor.
   • **user-profile / dm-chat ve oda sahnesi tohumu YAPILMADI.** user-profile
     her ziyarette taze olmalı (takip sayısı, engel durumu); dm-chat'in
     kendi mesaj akışı var. Oda sahnesi tohumu ayrı bir iş — koltuk verisi
     bayat gösterilirse "hayalet koltuk" sınıfı hatalara kapı açar, ki bu
     oturumda tam onlarla uğraşıldı.
10. **1.10 (C9) ✅ — 11 çağrı alan bazlı seçime geçti:**
    Selector'süz `useApp()` TÜM store'a abone oluyor; herhangi bir alan
    değişince bileşen yeniden çiziliyordu. En kritiği `AppOverlays`:
    uygulamanın HER ekranının üstünde duruyor, yani hesap yasağı yoklaması
    ya da oda listesi güncellemesi üstündeki ekranı da yeniden çizdiriyordu.
    Aynı düzeltme `room.tsx`te daha önce yapılmıştı; kalan hepsi geçti
    (profile, my-room, onboarding, room-manage, security, special-id ×2,
    user-search, AppOverlays, ContributionView, EditProfileSheet).
    **`banPollTimer` notu geçersiz:** o mağaza durumu değil, modül
    değişkeni — `set()` çağırmıyor, dolayısıyla zaten render tetiklemiyor.
11. **1.11 (C8) ✅ — klavye sarmalayıcı + alt payı:**
    • **"16 dosya" RAKAMI YANLIŞTI.** `TextInput` içeren 14 dosya vardı ama
      `Sheet` ve `CenterModal` bileşenlerinin İKİSİ DE zaten
      `KeyboardAware` içeriyordu; modal/sheet içindeki bütün input'lar
      kapsanmış durumdaydı. Gerçekten açıkta kalan 8 SAYFA vardı, hepsi
      sarmalandı: admin-banner-edit (8 input), admin-mesaj, admin-broadcast,
      special-id, admin, friends, user-search, feed.
      Dokunulmayan 6 dosya (agency-panel, room-manage, security,
      user-profile, CouponSheet, SecuritySheet) tek tek doğrulandı —
      input'ları modal/sheet içinde.
    • **ALT PAYI SABİTLERİ GÜVENLİ ALANI HESABA KATMIYORDU.** Beş sekme
      ekranı `paddingBottom: 110` ya da `120` yazıyordu; alt navigasyon ise
      `bottom: 0`da durup kendi payını `12 + insets.bottom` ile alıyor.
      Ana ekran çentikli telefonda gereken pay ~122 iken içerik 110'da
      kalıyordu — listenin son satırı navigasyonun arkasında görünmüyordu.
      `theme/olculer.ts` + `useIcerikAltPayi()` (88 ölçülmüş nav yüksekliği
      + güvenli alan + nefes payı).
      `user-profile` HARİÇ: sekme ekranı değil, alt navigasyonu yok; oradaki
      110 kendi alt çubuğu için.
12. **1.12 (A4/A5) — zemin hizalama ✅, `Kart` bileşeni YAPILMADI:**
   `src/theme/Zemin.tsx` oluşturuldu, **17 dosya** ona bağlandı.
   • **Sekiz ekran kendi tonunu uydurmuştu:** referral yeşil (#0A2A1E),
     badges mor (#1B1430), about mor (#241B3A), updates turkuaz (#0E2A2A),
     diamond-load turkuaz (#0C1E22), level kahve (#241B0A), RoomStats mavi
     (#0A2230), ContributionView kahve. Siyah-altın temada hiçbirinin
     karşılığı yok; ekranlar arasında gezerken zemin rengi değişiyordu.
   • `about` ve `updates` KÖK zeminlerinde de farklı siyah kullanıyordu
     (#0B0712, #0A0F14) — gradyan bitince altından o çıkıyordu. `C.bg`'ye
     alındı.
   • **Kopya bitti:** aynı iki satır (gradyan + altın hale) on ekranda
     tekrarlanıyordu. Asıl mesele buydu — renkler tek yerde olmadıkça bir
     sonraki ekran yine kendi tonunu uydururdu. On dosyadan boşta kalan
     `aura` stilleri de silindi. `withdraw` iki zemin çiziyordu, ikisi de
     geçti.
   • **Kapsam dışı bırakılanlar:** `banner-detay.tsx` ve `banners.ts`
     renkleri banner TÜRÜNE göre veri odaklı vurgu (duyuru/etkinlik),
     sayfa zemini değil — değiştirmek banner kimliğini bozardı.
   • **`Kart` bileşeni ✅ + yüzey katları (4 Eylül).** Planda "`Kart`
     oluşturulur, yalnız dokunulan ekranlarda kullanılır" yazıyordu; ÖLÇÜNCE
     daha iyi bir sıra çıktı. Aynı "beyaz üstü şeffaf yüzey" BEŞ farklı
     alfayla çiziliyordu (.03 .035 .04 .045 .05 .06 .08) ve kenarlıkta altı
     varyant vardı. Bağlamlarına bakınca örtük bir hiyerarşi göründü ama
     adlandırılmamıştı: .05 dokunulabilir kontroller, .04 içerik kartları,
     .08 gruplanmış yüzeyler; aradakiler kaymaydı.
     Önce `colors.ts`e ÜÇ KAT eklendi (`kart` / `kontrol` / `kartUst`) ve
     **239 elle yazılmış renk token'a geçti** — yalnız dokunulan ekranlarda
     değil, uygulamanın tamamında; elle yazılmış kart zemini SIFIR kaldı.
     `theme/Kart.tsx` de eklendi: kartın kendisi (yuvarlaklık, kenarlık,
     dolgu, vurgu rengi) tek yerde. `GlassPanel`in yerine geçmez — o
     sayfa/panel yüzeyi, `Kart` düz ve ucuz.
13. **1.13 (A2) — sahte başarılar kaldırıldı ✅:**
   • `diamond-load` düğmeye basınca **"Satın alma başarılı! N elmas hesabına
     eklendi"** diyordu; `withdraw` **"Çekim tamamlandı, $X karşılığı N elmas
     gönderildi"** diyordu. İkisi de tek satırdan ibaretti: `setDone(true)`.
     Ne ödeme, ne sunucu, ne bakiye. Para söz konusuyken sahte başarı en kötü
     hata türü — kullanıcı ödediğini ya da parasını çektiğini sanır.
   • **Ekranlar SİLİNMEDİ**, tasarım Faz 4.10/4.11'de gerçeğe bağlanacak.
     Sonuç ekranları dürüst duruma çevrildi ve `YakindaNotu` bileşeni
     eklendi. Uyarı EN BAŞTA: üç adım doldurtup sonunda "aslında çalışmıyor"
     demek, sahte başarıdan biraz daha az kötü olurdu.
   • `haptic.success()` → `haptic.warning()`: titreşim de yalan söylüyordu.
   • **`profileGift`/`dmGift` `false` YAPILMADI** — plan yazıldığında
     bağlı değillerdi, ama 3 Eylül'de gerçeğe bağlandılar (`hediyeGonder`,
     bakiyeden gerçekten düşüyor). Kapatmak çalışan bir özelliği söndürmek
     olurdu. `features.ts` içindeki eskimiş not düzeltildi.

**Plana SONRADAN eklenenler (3 Eylül, kullanıcı isteğiyle).** Üçü de Faz 1'in
"native his" başlığına ait; numaralandırma bozulmasın diye sona eklendi:

14. **1.14 (Lottie altyapısı) ✅ `14de012` `30c5485` `531bf8e` `5775af0`:** `lottie-react-native` (Expo Go'da çalışır, dev build gerekmez) + `@lottiefiles/dotlottie-react` (web'in istediği isteğe bağlı bağımlılık; kurulmazsa web export çöküyordu). **`scripts/lottie-boya.js`** hazır Lottie dosyalarının rengini temaya çevirir — indirilen dosyalar açık tema için çizilmiş geliyor, siyah kontur `#08080C` üstünde kayboluyor. Araç `assets` içindeki prekompozisyonları da gezer (ilk sürümü gezmiyordu, bir dosyanın konfeti renkleri sessizce atlanmıştı). **`Anim.tsx`** sarmalayıcı + **`BosDurum.tsx`** ortak boş durum. Varlıklar: `bos-kutu.json`, `bos-kutu-altin.json`, `sampiyon.json`. 11 ekranın boş durumu geçti; `badges.tsx`'te boş durum HİÇ YOKTU, eklendi.
15. **1.15 (Yükleniyor) ✅ `df00e29`:** 20 çıplak `ActivityIndicator`ın 11'i **`Yukleniyor.tsx`**'e geçti (animasyon + yazı + 200 ms flaş koruması). Buton ve arama kutusu içindeki küçük çemberler bilerek kaldı.
16. **1.16 (Oda kartı + liste dizilimi) ✅ `83dd96c` `893640c`:** WePlay referans alındı (APK layout'ları çözüldü + kullanıcının ekran görüntüsü). Kart: sağdaki ayrı sütun kalktı, kişi sayısı meta satırına indi, durum hapı sağ üste çıktı, rozetler sağa yaslı tek sıra. Liste: yüzen kartlar → sayfaya gömülü tam genişlik satırlar, ayırıcı kapak genişliği kadar içeriden. Renk, tema ve boyutlar değişmedi.

**3-4 Eylül oturumunda eklenenler (kullanıcı isteğiyle, plan dışı).**
Hepsi Faz 1'in "native his" başlığına ait; ayrıntı ve kök sebepler
`PROJE_DURUMU.md` §10'daki oturum bölümünde.

17. **1.17 (Hediye kataloğu) ✅** 7 hediye (`087`). Zafer Gecesi eklendi ve
    KALDIRILDI — 334 katman + 55 efekt + 30 blend mode, lottie-android sadık
    çizemiyor. Bundle 10.05 → 6.00 MB.
18. **1.18 (Hediye görselleri) ✅** Karolarda statik PNG, Lottie yalnız
    gönderim efektinde. Duruk kare çizim döngüsünü durduruyor ama katman
    ağacını yine kuruyordu. Üç yeni betik: `lottie-denetle.js`,
    `lottie-png.js`, `lottie-gorsel-kucult.js`.
19. **1.19 (Ses) ✅** Sesler ÜRETİLDİ (`hediye-sesi-uret.js`), indirilmedi —
    lisans ve "dinlemeden seçemem" gerekçesiyle. `ses-incele.js` ölçüm aracı.
    Android'de ses hiç çıkmıyordu (iOS'a özel `playsInSilentMode`) ve sonra
    sesin başı yeniyordu (yüklenmemiş oynatıcıya `play()`); oynatıcı havuzu
    + ön yükleme + 120 ms emniyet susması.
20. **1.20 (Efekt kuyruğu) ✅** `gifts/efektKuyrugu.ts` — sırayla oynatma,
    kuyruk uzadıkça kısalan gösterim, birleştirme, 12 tavan.
    **`scripts/kuyruk-testi.js` projedeki tek otomatik test (10 kontrol).**
21. **1.21 (Sohbet görünümü) ✅** Hediye satırı gönderenin balonuna alındı;
    çerçeve sohbette ve başkasının profilinde çiziliyor; oda sahibi rozeti
    artık görünüyor (rol yükten DEĞİL `roomRoles`ten türetiliyor).
22. **1.22 (Kullanıcı listesi + koltuk yerleşimi) ✅** Liste tek kaynağa
    bağlandı (katılımcı + presence + koltuk birleşimi), satırlar tutarlı,
    dokununca kart açılıyor. Koltuk ölçüleri pikselden ölçülüp hizalandı;
    hücre yüksekliği sabitlendi; klavye açıkken `MiniSahne`.

**Plan dışı — cihaz testinden çıkan KARARLILIK işleri (Faz 0'ın devamı
sayılmalı).** Altı ayrı kök sebep, hepsi aynı desen: *gecikmeli ya da eksik
gelen olaylara anlık bakıp kesin karar vermek.* Toplu uygulama, kanal
yeniden bağlanma, iki kaynaklı hayalet süzgeci, düşürmeden önce doğrulama,
arkaplan birikintisini atma, niyet takibi. Ayrıntı `PROJE_DURUMU.md`.

### Faz 1 duman testi
300+ mesajla kaydırma akıcı + tavan; presence sync'te sohbet satırları yeniden çizilmiyor; tüm sheet'ler sürükle-kapat; uçak modunda ilk açılış avatarlı; tema turu; withdraw/diamond-load dürüst; DM/profil hediye butonu yok. **Regresyon nöbeti:** Faz 0 senaryoları 1-3 ve 6.

---

## FAZ 2 — Oda içi yetkilendirme + support rolü (086-089)

### 2.1 — `086_koltuk_sustur.sql` + istemci (B4)
`koltuk_sustur(p_oda, p_hedef, p_sustur)`: `_oda_moderatoru` kapısı; hedef koltukta değilse sessiz RETURN; koltuk 20 → yalnız `ben_platform_yoneticisi()`; koşullu UPDATE. **Bilinçli sınır:** hedef `koltuk_mic` ile kendini geri açabilir — sustur sosyal uyarı, kalıcı yaptırım `mic_yasak_ver` (028). İstemci: `roomsRepo.koltukSustur`; `seatActions.onMute` → iyimser ipucu + RPC + hatada `koltukTazeleRef`.

### 2.2 — `087_oda_uyeleri_realtime.sql` + roomRoles canlı tazeleme (B6)
**postgres_changes** (RoomPanel callback'i değil — asıl sorun HEDEF cihaz). `mic_yasaklari` aboneliği deseninin kopyası. Migration: `REPLICA IDENTITY FULL` + publication'a idempotent ekleme. İstemci: üye yükleyicisi `uyeleriYukle`'ye çıkarılır; `postgres_changes {table:"oda_uyeleri", filter:"oda_id=eq."+dbId}` → tam yeniden okuma.

### 2.3 — `088_support_rol_enum.sql` (TEK BAŞINA — 025 dersi)
Yalnız `ALTER TYPE ekonomi_rolu ADD VALUE IF NOT EXISTS 'support';`. SEMA_DOKUMU enum satırı güncellenir.

### 2.4 — `089_support_yetkileri.sql`
`ben_destek_veya_yonetici()`; `sikayetler` select/update politikaları bu kapıya; `destek_kullanici_getir` (e-posta YOK, bakiye YOK); `admin_oda_getir` kapısı genişler (salt okuma); `kisiye_mesaj_gonder`/`odaya_mesaj_gonder` genişler; duyuru/banner DOKUNULMAZ. Support'a kapalı kalanlar dosya sonunda liste.

### 2.5 — İstemci rol modeli (EN KRİTİK okuyucu taraması)
`appStore.ts` `mapRole` + `UserRole` → `"support"`. **`role !== "user"` TÜM okurları sınıflanır:** `room.tsx` `privileged` → `role === "developer" || role === "super_admin"` olarak DARALTILIR (yoksa support odada host olur); `profile.tsx` "Yönetim" girişi `role !== "user"` bilinçli KALIR.

### 2.6 — Admin ekranlarında rol kapısı + support görünürlüğü
`admin.tsx` client-side rol kontrolü EKLENİR; support'ta Duyuru&Banner ve düzenleme yolları gizli. Yeni hafif `destek-kullanici.tsx` (salt okunur + sistem mesajı). **`admin-user-edit.tsx`'e dokunulmaz.** `admin-room-report.tsx`: support'ta yaptırım gizli.

### Faz 2 duman testi
1. Yardımcı: sustur/aç (ANINDA), indir, sıra onayla; üye hesabıyla RPC'ler reddediliyor.
2. "Yardımcı Yap" → B'de rozet+butonlar ODADAN ÇIKMADAN; "Üye Yap" → canlı düşüyor.
3. support: rapor görür/kapatır, e-postasız detay, sistem mesajı; bakiye/yasak/rol/duyuru NE arayüzde NE SQL'den; **odada sıradan kullanıcı.**
4. **Regresyon nöbeti:** super_admin/developer akışları; Faz 0 senaryo 1-3.

---

## FAZ 3 — Agora RTC zemini (SDK entegrasyonu kapsam dışı; migration yok)

1. **3.1** `src/lib/rtc.ts`: `RtcMotoru` arayüzü (`katil/ayril/micAyarla/hoparlorAyarla/aktifKonusanlariDinle`) + `NullRtcMotoru` + `rtcMotoruGetir()` fabrikası. Sözleşme: kanal `room-${dbId}`, uid `myDbId`, rol `oturuyorum`, mute `toggleMyMic`.
2. **3.2** `app.json`: `NSMicrophoneUsageDescription` (TR) + Android `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT`.
3. **3.3** `supabase/functions/agora-token/index.ts` iskeleti (JWT doğrulama, `{kanal, uid}`, şimdilik `{token:null}`; RtcTokenBuilder TODO). **Deploy/secret canlıda.**
4. **3.4** `room.tsx` bağlantı noktaları (NullRtc ile davranış SIFIR değişir): kanal effect'inde `rtc.katil`/`rtc.ayril`; `toggleMyMic` → `rtc.micAyarla`; `aktifKonusanlar: Set<number>` → sabit `speaking:false` yerine `aktifKonusanlar.has(uid)` (SpeakingRing hazır).

### Faz 3 duman testi
NullRtc ile tam regresyon turu; `tsc` temiz; app.json Expo Go açılışını bozmamış.

---

## FAZ 4 — Mock ekranlar gerçeğe + para akışları (084+)

### Hazır şemayla bağlananlar
1. **4.1** `gift-history.tsx` → `hediyeRepo.sonHediyelerim()` + useCachedResource.
2. **4.2** `friends.tsx` → `followRepo` (arkadaşlık tabloları dolu mu canlıda doğrulanır).
3. **4.3** `events.tsx` + `event.tsx` → `announceRepo`.
4. **4.4** `user-search.tsx` oda araması → roomsRepo arama fonksiyonu.
5. **4.5** `index.tsx` mock `ROOMS` karışımı kaldırılır (okuyucular: rank fallback, seed.ts, search.ts).
6. **4.6** `feed.tsx` FEED_SEED kaldırılır; `dm.tsx` mock thread'ler → gerçek sistem mesajı akışı.
7. **4.7** GiftSheet sabit fallback → gerçek katalog; special-id "Zenginler" → `siralama_zenginlik`.
8. **4.8** `agency-panel.tsx` hardcoded ajans verisi → gizlenir/"yakında".
9. **4.9** `updates.tsx` içeriği; `security.tsx` ↔ `oturumlar/login_history` (canlıda doğrulanır).

### Para akışları (kullanıcı kararı: betada GERÇEK)
10. **4.10** `withdraw.tsx` → gerçek: hardcoded `MY_ID`/`EARNINGS` gerçek veriye; çekim talebi `withdrawal_requests` (`090_cekim_talebi.sql`, mevcut RPC SEMA_DOKUMU'ndan teyit); admin talep listesi/karar ekranı.
11. **4.11** `diamond-load.tsx` → gerçek IAP (`expo-iap`; **dev build ŞART**); makbuz doğrulama Edge Function + `satin_almalar` + elmas bakiye RPC (091). **Canlıda:** mağaza ürün tanımları, sandbox hesapları.
12. **4.12** `vip.tsx` → gerçek VIP satın alma (gerekiyorsa 092).
13. **4.13** `referral.tsx` → referans kaydı + ödül RPC (çift ödül koruması 074 deseniyle).
14. **4.14** DM/profil hediyesi → `hediye_gonder_v2`; `features.ts` bayrakları geri açılır.

### Temizlik
15. **4.15 (A7):** Ölü dosyalar — her silme öncesi 0-import grep + tsc: `data/inventory.ts`, `data/store.ts`, `data/schema.ts`, `SecuritySheet.tsx`, WALLET_LEDGER, STREAMER_WEEK, COUNTRIES/REGISTERED_PHONES, `walletRepo.transfer`; room.tsx ölü presence alanları (`kilitler`, `koltuk`, `katildi`, `duyurulanlarRef`, `girenlerRef`).

### Faz 4 duman testi
1. Hediye → gift-history; takip → friends; duyuru → events; user-search'ten kullanıcı+oda; listede mock oda YOK.
2. Çekim talebi → admin ekranı → onay/red; IAP sandbox → elmas bakiye (dev build); VIP satın alma; referans ödülü tek sefer.
3. DM/profil hediye GERÇEK: bakiye düşer, alıcıya geçer.
4. **Regresyon nöbeti:** Faz 0 senaryo 1-3 + Faz 2 senaryo 2-3.

---

## Canlıda yapılacak / doğrulanacaklar (kod dışı)
- 021-024 fonksiyonlarında anon grant durumu (077'deki sorgu).
- `admin_islem_gecmisi` (033) kapısı; `security.tsx` gerçek mi mock mu.
- PRESET avatar Storage yüklemesi; `agora-token` Edge Function deploy + secret'lar.
- IAP: mağaza ürün tanımları, sandbox hesapları, **dev build** (Agora ile aynı build).
- `oda_uyeleri` publication → odada 4. kanal; Faz 2 testinde Realtime/Metro logu izlenir.
- **En yüksek tekil regresyon riski:** 2.5'teki `role !== "user"` daraltması — commit mesajında tam okur listesi zorunlu.

## Kritik dosyalar
- `src/app/room.tsx` (her fazın merkezi)
- `src/data/remote/roomsRepo.ts`
- `db/migrations/069_mic_akislari.sql` / `073` (koltuk RPC gövdeleri)
- `src/store/appStore.ts` (Faz 2 rol modeli)
- `db/SEMA_DOKUMU.md` (her migration öncesi)

## Bulgu özeti (analizden — referans)
- **A (ekranlar):** 14 ekran + 3 sheet tamamen mock; 10+ kısmen; 22 + 5 tam bağlı. Sahte başarı: withdraw, diamond-load, DM/profil hediye. Arama ikonu `/preview`'e gidiyor. Tema sapmaları 9 ekran + sekme zeminleri. Panel stili 40+ kopya. pravatar bağımlılığı. Ölü dosyalar. Repo varken kullanılmayan: gift-history/friends/events.
- **B (yetki/mantık):** B1 rol sözlüğü ✅ · B2 yarışlar ✅ · B3 sohbet kalıcılığı ✅ · B4 sustur sunucu yolu yok (Faz 2) · B5 güvenlik regresyonları ✅ · B6 roomRoles tazelenmiyor (Faz 2) · B7 support ayrımı (Faz 2) · B8 çift kaynak ✅ / ölü presence alanları (Faz 4).
- **C (native his):** 1 FlatList, 0 React.memo, 0 pressed-feedback, 396 Pressable; msgs sınırsız; room.tsx 2.980 satır tek bileşen; 80 console.*; sekmeler freezeOnBlur:false; bottom-sheet kurulu kullanılmıyor; expo-image cache/transition yok; useCachedResource 5 ekranda; 12 selector'süz useApp(); RTC altyapısı yok (SpeakingRing hep false, mikrofon izinleri yok).
