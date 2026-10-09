# iOS yayını

iOS uygulaması Windows'ta geliştirilir ama yalnızca Codemagic'te derlenir
(`codemagic.yaml`), test TestFlight üzerinden iPhone'da yapılır. Mac
gerekmiyor.

| Ne | Nerede |
|---|---|
| Native proje | `ios/` (Capacitor 8, Swift Package Manager) |
| Bundle ID | `com.meteucar.slot` |
| Ana ekrandaki ad | "Slot" (`Info.plist` → `CFBundleDisplayName`) |
| Mağaza adı | "Slot: Teknik Soru Pratiği" (App Store Connect'te) |
| Sürüm | `package.json` (Android ile ortak) |
| Build numarası | TestFlight'taki son build + 1, Codemagic hesaplar |
| En düşük iOS | 16.4 (gerekçe CLAUDE.md → iOS sürümü) |
| Cihaz | Yalnızca iPhone |

## Bir kerelik kurulum

Sıra önemli: sertifika profilden önce, profil Codemagic'ten önce gelir.

### Apple Developer

1. Apple Developer Program üyeliği aktif olmalı.
2. **Certificates, Identifiers & Profiles → Identifiers → +** → App IDs →
   App. Bundle ID "Explicit": `com.meteucar.slot`, açıklama "Slot".
   Capability işaretleme: yerel bildirim Push Notifications istemez.

### App Store Connect

3. **Apps → + → New App.** Platform iOS, Name **Slot: Teknik Soru
   Pratiği**, Primary Language Turkish, Bundle ID `com.meteucar.slot`,
   SKU örneğin `slot-ios`.
4. **App Information → Apple ID** (sayısal). Bu değer
   `codemagic.yaml`'daki `APP_STORE_APPLE_ID`'ye yazılıp commit'lenir.
   Gizli değil; ayarlanmamışsa derleme bunu söyleyip durur.
5. **Users and Access → Integrations → App Store Connect API → Team
   Keys → Generate API Key.** Ad "Codemagic", erişim **App Manager**.
   `.p8` dosyası yalnızca bir kez indirilebilir; Issuer ID ve Key ID'yi
   not et. `.p8` repoya girmez (`.gitignore`'da).
6. **TestFlight → Internal Testing → +** ile bir grup aç (örneğin
   "Geliştirici"), **Enable automatic distribution** açık olsun, kendini
   ekle. Dahili test Apple incelemesi istemez.
7. Harici teste ya da mağaza incelemesine geçmeden önce: **App Privacy**
   → "Data Not Collected", Privacy Policy URL
   `https://slot.meteucar.com/privacy`. Dahili TestFlight için şart değil.

### Codemagic

8. Uygulamayı GitHub reposundan ekle; yapılandırma `codemagic.yaml`.
9. **Team settings → Team integrations → Developer Portal → Manage keys
   → Add key.** Ad tam olarak `slot-app-store-connect` olmalı
   (`codemagic.yaml` → `integrations`). Issuer ID, Key ID ve `.p8`.
10. **Code signing identities → iOS certificates → Generate
    certificate.** Az önceki anahtarla bir Apple Distribution sertifikası
    üretir.
11. Apple Developer'da **Profiles → +** → Distribution → **App Store
    Connect** → App ID `com.meteucar.slot` → 10. adımdaki sertifika → ad
    örneğin "Slot App Store". Sonra Codemagic'te **Code signing identities
    → iOS provisioning profiles → Fetch profiles** ile bu profili çek.
    `ios_signing` bloğu (`app_store` + bundle ID) eşleşen profili kendisi
    bulur.

Codemagic'te ortam değişkeni girmek gerekmiyor: API anahtarı
entegrasyondan, imza dosyaları Code signing identities'ten gelir,
`APP_STORE_APPLE_ID` yaml'da durur.

## Her yükleme

1. Yeni bir mağaza sürümüyse `npm version patch|minor|major` (Android ile
   aynı kural). Aynı sürümün yeni bir test build'i için gerekmez; build
   numarası kendiliğinden artar.
2. Dalı push'la. Codemagic → **ios-testflight → Start new build** → dalı
   seç. İş akışı yalnızca elle başlar.
3. Build App Store Connect'e yüklenir, "Processing" bitince dahili gruba
   düşer; iPhone'daki TestFlight uygulamasından kurulur. Şifreleme
   (export compliance) sorusu çıkmaz: `ITSAppUsesNonExemptEncryption`
   false.

Derleme Xcode 26'dan eski bir makineye düşerse ilk adımda durur
(Capacitor 8'in şartı).

## Windows'ta yapılabilenler

- `npm run ios:sync`: web'i derler, `ios/App/App/public`'e kopyalar ve
  `ios/App/CapApp-SPM/Package.swift`'i yeniden yazar. Derleme yapmaz.
  `public/`, `capacitor.config.json` ve `config.xml` git'e girmez.
  `Package.swift` girer; sync'ten sonra değiştiyse commit'lenir.
- Xcode, simülatör ve `cap run ios` yok. `Package.resolved` Mac'te
  oluştuğu için repoda yok; Swift paketleri Codemagic'te her derlemede
  çözülür (`capacitor-swift-pm` tam sürüme sabit).
- `npm run icons` iOS ikonlarını (`AppIcon`, açılış ekranındaki
  `LaunchIcon`) da üretir ama bütün çıktıları yeniden rasterlar. Chrome
  sürümü farklıysa Android ve `public/` PNG'leri içerik aynıyken bayt
  düzeyinde değişir; yalnızca iOS çıktısı gerekiyorsa diğerlerini geri al.

## TestFlight'ta kontrol listesi

Windows'ta doğrulanamayan, cihazda bakılacaklar:

- **Açılış:** beyaz flaş yok, ikon ortada, durum çubuğu ikonları açık
  renk.
- **Kenarlar:** çentik ve ev göstergesi çevresinde boşluk doğru; yatayda
  da.
- **Dış bağlantılar:** Gizlilik, GitHub ve "Kendi yapay zekâna sor"
  Safari'de açılıyor. ChatGPT ya da Claude uygulaması yüklüyse bağlantı o
  uygulamada açılabilir; istem yine panoda.
- **Pano:** kod bloğundaki kopyala ve "Promptu kopyala" çalışıyor.
- **Hatırlatıcı:** izin yalnızca anahtar açılınca soruluyor; izin
  verilince bildirim geliyor; uygulama öndeyken banner çıkmıyor, Bildirim
  Merkezi'ne düşüyor. Kısa sürede denemek için derlemeye
  `VITE_REMINDER_TEST_SECONDS=60` ortam değişkeni verilir (yaml'daki
  `vars`'a geçici olarak); hatırlatma o build'de bir dakika sonra çalar,
  o build mağaza incelemesine gönderilmez.
- **Klavye:** cevap yazarken alan klavyenin altında kalmıyor (Keyboard
  eklentisi yok, WKWebView varsayılanı).
- **İlerleme:** uygulamayı kapatıp açınca ve TestFlight güncellemesinden
  sonra yerinde.
