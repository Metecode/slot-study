<!--
  Açık işler (yayındaki metinde görünmez):
  - 7. bölümde KVKK md. 9 kapsamındaki aktarım mekanizması yazılmadı; bölüm
    yalnızca olguları söylüyor (Netcup/Nürnberg, GitHub/ABD). Mekanizma
    belirlenince iki dilde de bölümün sonuna eklenecek. Uydurma cümle yazılmaz.
  - Play Console'da hedef kitle 18+ seçildi; 12. bölüm "13 yaşından küçükler
    için tasarlanmamıştır" diyor. Çelişki değil ama iki beyan aynı yaşı
    söylemiyor; hizalanması ayrıca değerlendirilecek.
-->

# Slot — Gizlilik Politikası

Son güncelleme: 30 Eylül 2026

Bu politika, Slot'un (slot.meteucar.com ve Slot mobil uygulaması) hangi verileri işlediğini, neden işlediğini ve bu verilerle ilgili haklarını açıklar.

## Veri sorumlusu

Mete Uçar (bireysel geliştirici)
İletişim: i.meteucar@gmail.com · meteucar.com

## Kısaca

- Slot hesap açmadan, tam olarak çalışır. Hesapsız kullanımda ilerlemen ve ayarların cihazında saklanır ve bize gönderilmez.
- Reklam, analitik ya da takip aracı kullanmıyoruz. Verini satmıyor, pazarlama amacıyla kimseyle paylaşmıyoruz.
- İsteğe bağlı olarak GitHub ile giriş yaparsan, ilerlemen cihazların arasında senkronlanabilmesi için sunucumuzda saklanır. Giriş yalnızca web sürümünde var.
- Hesabını uygulamanın içinden istediğin zaman silebilirsin.

## 1. Hesapsız kullanım

Cevapların, puanların, ilerlemen ve ayarların cihazındaki uygulama deposunda (web sürümünde tarayıcının IndexedDB deposunda) tutulur ve bize gönderilmez. Web sürümü çevrimdışı da çalışabilmek için uygulama dosyalarını tarayıcı önbelleğinde saklar. Bu verileri tarayıcı verilerini temizleyerek ya da uygulamayı silerek kaldırabilirsin.

Web sürümünü açtığında tarayıcın sayfayı sunucumuzdan yükler. Bu isteklere ait teknik kayıtlar 5. bölümde anlatılıyor.

## 2. Mobil uygulama

Mobil uygulamada hesap ya da giriş yok; uygulama sunucumuza hiçbir istek göndermez.

- **İlerleme ve ayarlar:** Cihazında, uygulamanın kendi klasöründeki JSON dosyalarında saklanır ve sunucumuza gönderilmez. Uygulamayı sildiğinde bu dosyalar da silinir. Android yedeklemen açıksa bu dosyalar Google hesabındaki cihaz yedeğine dahil edilebilir; bu yedeğe biz erişemeyiz.
- **Hatırlatıcı:** Tekrar hatırlatıcısını açarsan bildirim cihazında yerel olarak kurulur; bildirim sunucusu kullanılmaz. Hatırlatıcıyı Ayarlar'dan kapatabilirsin.
- **Analitik ve reklam yok:** Uygulama analitik, reklam ya da çökme raporlama aracı (SDK) içermez.
- **Kendi yapay zekâna sor:** Yalnızca sen başlattığında, promptu seçtiğin üçüncü taraf servise iletir; Slot bu veriyi sunucusuna göndermez. ChatGPT, Claude ve Perplexity'ye prompt adresin içinde (`?q=`) gider ve o servisin geçmişine kendi hesabında düşebilir. Ayrıntılar 6. bölümde.

GitHub ile giriş, çerezler ve sunucu kayıtları (3–5. bölümler) yalnızca web sürümü için geçerlidir.

## 3. GitHub ile giriş (isteğe bağlı)

Giriş şu an yalnızca web sürümünde sunuluyor. Giriş yaptığında GitHub'dan yalnızca herkese açık profil bilgilerini okuma izni (`read:user`) isteriz ve şunları saklarız:

- GitHub kullanıcı kimliğin (sayısal) ve kullanıcı adın,
- hesabının Slot'ta oluşturulma zamanı.

E-posta adresini, adını ya da profil fotoğrafını saklamayız. GitHub'ın bize verdiği erişim anahtarı yalnızca giriş sırasında kullanılır ve giriş tamamlanınca silinir.

Senkron için sunucuya şu bilgiler gönderilir ve saklanır: hangi soruları çalıştığın, her sorunun kutu seviyesi, son çalışma zamanı ve her soru için en fazla son 10 denemen. Denemeler yazdığın cevap metnini, eşleşen kavram sayısını, kendine verdiğin puanı ve sonucu içerir.

Cevap alanına kişisel bilgi yazmamanı öneririz; yazdığın metin olduğu gibi saklanır.

Çıkış yaptığında ilerlemen cihazında kalmaya devam eder.

## 4. Çerezler ve cihazda saklananlar

Takip ya da analitik çerezi kullanmıyoruz. Yalnızca giriş için gereken iki çerez var:

- **refresh_token:** Oturumunu açık tutar. 30 gün geçerlidir, her kullanımda yenilenir ve JavaScript tarafından okunamaz.
- **JSESSIONID:** Yalnızca GitHub ile giriş akışı sırasında kullanılır, giriş tamamlanınca silinir.

Hesapsız kullanımda hiçbir çerez yazılmaz.

## 5. Sunucu kayıtları

Web sürümünü kullanırken sunucumuz her istekte şu teknik bilgileri kaydeder: IP adresi, zaman, istenen adres, yanıt kodu, yönlendiren sayfa ve tarayıcı bilgisi (User-Agent). Bu kayıtlar güvenlik ve hata ayıklama amacıyla tutulur ve en fazla 15 gün sonra otomatik olarak silinir.

Uygulamanın kendi kayıtları hesap kimliğini içerebilir; cevap metinlerini içermez. Bu kayıtların boyutu sınırlıdır ve yeni kayıtlar geldikçe eskileri silinir.

## 6. Verilerin saklandığı yer ve paylaşım

Sunucumuz Netcup GmbH'nin Nürnberg'deki (Almanya) veri merkezinde bulunur. Yurt dışına aktarım 7. bölümde anlatılıyor.

Verileri yalnızca şu hizmet sağlayıcılarla ve yalnızca hizmetin çalışması için gereken ölçüde paylaşırız:

- **Netcup GmbH (Almanya):** barındırma.
- **GitHub, Inc. (ABD):** yalnızca giriş yaptığında, kimlik doğrulama için. GitHub'ın kendi gizlilik politikası geçerlidir.

Uygulamayı App Store ya da Google Play'den indirirsen, bu mağazalar kendi politikalarına göre veri işler.

"Kendi yapay zekâna sor" yalnızca sen bir düğmeye bastığında çalışır. Prompt (soru, yazdığın cevap ve değerlendirme kriterleri) seçtiğin servise (ChatGPT, Claude, Gemini, Perplexity) ya da paylaş menüsünde seçtiğin uygulamaya iletilir ve cihazının panosuna kopyalanır. Slot bu metni sunucusuna göndermez. ChatGPT, Claude ve Perplexity'de prompt adresin içinde (`?q=`) gider; bu yüzden tarayıcı geçmişine ve o servisin geçmişine, kendi hesabında, düşebilir. Metni ilettiğin servisin kendi gizlilik politikası geçerlidir.

## 7. Yurt dışına aktarım (KVKK md. 9)

Web sürümünü kullandığında sunucu kayıtların (5. bölüm), GitHub ile giriş yaptığında hesap ve senkron verilerin, barındırma hizmeti aldığımız Netcup GmbH'nin Nürnberg'deki (Almanya) sunucularında saklanır. Türkiye'den kullanıyorsan bu, kişisel verilerinin yurt dışına aktarılması anlamına gelir.

GitHub ile giriş yaptığında giriş işlemi GitHub, Inc.'in (ABD) sunucularında gerçekleşir: tarayıcın doğrudan GitHub'a bağlanır, GitHub kimliğini doğrular ve kullanıcı kimliğini ve kullanıcı adını bize iletir.

## 8. Hukuki dayanak

- Hesap ve senkron verileri: sözleşmenin kurulması ve ifası (KVKK md. 5/2-c; GDPR md. 6/1-b).
- Sunucu kayıtları: hizmetin güvenliğini sağlamaya yönelik meşru menfaat (KVKK md. 5/2-f; GDPR md. 6/1-f).

## 9. Saklama süreleri

- Hesap ve senkron verileri: hesabını silene kadar.
- Sunucu erişim kayıtları: en fazla 15 gün.
- Veritabanı yedekleri: en fazla 15 gün. Silinen hesaplar en geç bu sürenin sonunda yedeklerden de çıkar.
- Oturum çerezi: kullanılmazsa 30 gün.

## 10. Hesabını silme

Giriş yaptıktan sonra kullanıcı menüsünden **Hesabı sil** seçeneğini kullanabilirsin. Sunucudaki hesabın ve senkronlanmış verilerin hemen ve kalıcı olarak silinir, tüm oturumların sonlanır. İstersen aynı adımda cihazındaki veriler de silinir.

Silme işleminden sonra sunucu erişim kayıtlarında (en fazla 15 gün) ve yedeklerde (en fazla 15 gün) izler kalabilir; bu süreler dolunca onlar da silinir. GitHub'daki uygulama iznini github.com/settings/applications adresinden kaldırabilirsin.

Uygulamaya erişemiyorsan silme talebini i.meteucar@gmail.com adresine gönderebilirsin.

## 11. Hakların

KVKK md. 11 ve GDPR kapsamında verilerinin işlenip işlenmediğini öğrenme, verilerine erişme, düzeltilmesini ya da silinmesini isteme, işlemeye itiraz etme ve verilerini taşınabilir biçimde alma haklarına sahipsin. Taleplerini i.meteucar@gmail.com adresine gönderebilirsin; en geç 30 gün içinde yanıt veririz. Ayrıca Kişisel Verileri Koruma Kurulu'na, AB'deysen bulunduğun ülkenin veri koruma otoritesine şikâyette bulunabilirsin.

## 12. Çocuklar

Slot 13 yaşından küçükler için tasarlanmamıştır ve bu yaş grubundan bilerek veri toplamayız.

## 13. Değişiklikler

Bu politikayı güncellersek sayfanın başındaki tarihi değiştiririz. Önemli değişiklikleri uygulamada ayrıca duyururuz.

---

# Slot — Privacy Policy

Last updated: 30 September 2026

This policy explains what data Slot (slot.meteucar.com and the Slot mobile app) processes, why, and what your rights are.

## Data controller

Mete Uçar (independent developer)
Contact: i.meteucar@gmail.com · meteucar.com

## Summary

- Slot works fully without an account. Without an account, your progress and settings are stored on your device and are not sent to us.
- We use no advertising, analytics or tracking tools. We do not sell your data or share it for marketing.
- If you choose to sign in with GitHub, your progress is stored on our server so it can sync across your devices. Sign-in is available only in the web version.
- You can delete your account from within the app at any time.

## 1. Using Slot without an account

Your answers, ratings, progress and settings are kept in the app's storage on your device (in the web version, the browser's IndexedDB) and are not sent to us. To work offline, the web version stores the app's files in the browser cache. You can remove this data by clearing your browser data or uninstalling the app.

When you open the web version, your browser loads the page from our server. The technical logs of these requests are described in section 5.

## 2. Mobile app

The mobile app has no accounts or sign-in, and it sends no requests to our server.

- **Progress and settings:** Stored on your device, in JSON files in the app's own folder, and not sent to our server. Uninstalling the app deletes these files. If Android backup is turned on, these files may be included in the device backup in your Google account; we have no access to that backup.
- **Reminders:** If you turn on review reminders, the notification is scheduled locally on your device; no notification server is used. You can turn reminders off in Settings.
- **No analytics or ads:** The app contains no analytics, advertising or crash-reporting SDK.
- **Ask your own AI:** Only when you start it, the prompt is passed to the third-party service you choose; Slot does not send this data to its server. For ChatGPT, Claude and Perplexity the prompt travels in the address (`?q=`) and may appear in that service's history in your own account. Details in section 6.

Signing in with GitHub, cookies and server logs (sections 3–5) apply only to the web version.

## 3. Signing in with GitHub (optional)

Sign-in is currently offered only in the web version. When you sign in, we request permission to read your public profile only (`read:user`) and store:

- your GitHub user ID (numeric) and username,
- the time your Slot account was created.

We do not store your email address, name or profile picture. The access token GitHub gives us is used only during sign-in and is deleted once sign-in completes.

For syncing, the following is sent to and stored on our server: which questions you have studied, each question's box level, when you last studied it, and up to your last 10 attempts per question. Attempts include the answer text you wrote, the number of matched concepts, your self-rating and the result.

We recommend not entering personal information in the answer field; the text you write is stored as is.

When you sign out, your progress remains on your device.

## 4. Cookies and on-device storage

We use no tracking or analytics cookies. Only two cookies are needed for sign-in:

- **refresh_token:** keeps you signed in. Valid for 30 days, renewed on each use, and not readable by JavaScript.
- **JSESSIONID:** used only during the GitHub sign-in flow and deleted once sign-in completes.

No cookies are set when you use Slot without an account.

## 5. Server logs

When you use the web version, our server records the following for each request: IP address, time, requested URL, response code, referring page and browser information (User-Agent). These logs are kept for security and troubleshooting and are deleted automatically after at most 15 days.

The application's own logs may contain your account ID; they never contain your answer texts. These logs are size-limited, and older entries are deleted as new ones arrive.

## 6. Where data is stored and who it is shared with

Our server is located in Netcup GmbH's data centre in Nuremberg, Germany. Transfers abroad are described in section 7.

We share data only with the following service providers, and only as far as needed to run the service:

- **Netcup GmbH (Germany):** hosting.
- **GitHub, Inc. (USA):** authentication, only when you sign in. GitHub's own privacy policy applies.

If you download the app from the App Store or Google Play, those stores process data under their own policies.

"Ask your own AI" works only when you press a button. The prompt (the question, the answer you wrote and the evaluation criteria) is passed to the service you choose (ChatGPT, Claude, Gemini, Perplexity) or to the app you pick in the share menu, and copied to your device's clipboard. Slot does not send this text to its server. For ChatGPT, Claude and Perplexity the prompt travels in the address (`?q=`), so it may appear in your browser history and in that service's history in your own account. The privacy policy of the service you pass the text to applies.

## 7. Transfers abroad (KVKK Art. 9)

When you use the web version, your server logs (section 5), and when you sign in with GitHub, your account and sync data, are stored on the servers of our hosting provider Netcup GmbH in Nuremberg, Germany. If you use Slot from Turkey, this means your personal data is transferred abroad.

When you sign in with GitHub, sign-in takes place on the servers of GitHub, Inc. (USA): your browser connects directly to GitHub, which authenticates you and passes your user ID and username to us.

## 8. Legal basis

- Account and sync data: performance of a contract (KVKK Art. 5/2-c; GDPR Art. 6(1)(b)).
- Server logs: legitimate interest in keeping the service secure (KVKK Art. 5/2-f; GDPR Art. 6(1)(f)).

## 9. Retention

- Account and sync data: until you delete your account.
- Server access logs: at most 15 days.
- Database backups: at most 15 days. Deleted accounts are removed from backups at the latest when this period ends.
- Session cookie: 30 days if unused.

## 10. Deleting your account

Once signed in, choose **Delete account** from the user menu. Your account and synced data are permanently deleted from our server immediately, and all your sessions end. You can optionally delete the data on your device in the same step.

After deletion, traces may remain in server access logs (at most 15 days) and backups (at most 15 days); they are deleted when these periods end. You can revoke the app's permission on GitHub at github.com/settings/applications.

If you cannot access the app, send your deletion request to i.meteucar@gmail.com.

## 11. Your rights

Under KVKK Art. 11 and the GDPR, you have the right to know whether your data is processed, to access it, to request its correction or deletion, to object to processing, and to receive your data in a portable format. Send requests to i.meteucar@gmail.com; we respond within 30 days. You may also lodge a complaint with the Turkish Personal Data Protection Board or, if you are in the EU, with your local data protection authority.

## 12. Children

Slot is not designed for children under 13, and we do not knowingly collect data from them.

## 13. Changes

If we update this policy, we will change the date at the top. Significant changes will also be announced in the app.
