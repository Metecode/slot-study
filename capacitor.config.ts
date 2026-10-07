import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.meteucar.slot",
  appName: "Slot",
  // Vite'ın çıktı klasörü (vite.config.ts'te build.outDir yok, varsayılan).
  webDir: "dist",
  /*
    Varsayılan zaten "debug"; açıkça yazıldı çünkü release'te köprü loglarının
    kapalı olması buna bağlı. Debug derlemesinde köprü eklenti sonuçlarını,
    açılışta okunan store ve içindeki cevaplar dahil, logcat'e yazar.
    "production" yapılmaz: cevap metni release'te de loga düşerdi.
  */
  loggingBehavior: "debug",
  /*
    WebView'in zemini, sayfa ilk kareyi çizene kadar görünen renk.
    Tanımsızken varsayılan beyaz: açılış ekranı kalkınca kısa bir beyaz
    flaş görünebilir. tokens.css --bg ve android/.../values/colors.xml
    app_background ile aynı.
  */
  backgroundColor: "#0b0f14",
  server: {
    /*
      Varsayılan zaten "https"; açıkça yazıldı çünkü origin'i belirliyor
      (https://localhost) ve IndexedDB'deki ilerleme origin'e bağlı.
      Değişirse kullanıcının cihazdaki ilerlemesi görünmez olur.
      server.url BİLEREK yok: uygulama paketlenmiş varlıklarla çalışır,
      uzak bir adresten yüklenmez.
      iosScheme yok: iOS'ta origin capacitor://localhost. "https" verilemez,
      WKWebView kendi işlediği şemayı kabul etmiyor ve Capacitor varsayılana
      düşüyor. Native'de depo dosya sistemi olduğu için origin ilerlemeyi
      etkilemiyor.
    */
    androidScheme: "https",
  },
  ios: {
    /*
      Varsayılan zaten "never"; açıkça yazıldı çünkü kenar boşlukları buna
      bağlı. WebView çentiğin ve ev göstergesinin altına uzanır, env(safe-area-*)
      dolu gelir ve index.css --safe-* değişkenleriyle boşluğu kendisi verir.
      "automatic" olsaydı iOS kaydırma alanına ayrıca inset ekler, boşluk iki
      kez verilirdi.
    */
    contentInset: "never",
  },
  plugins: {
    SystemBars: {
      /*
        Çubuk ikonları hep açık: uygulamanın yalnızca koyu teması var.
        Varsayılan (DEFAULT) sistemin açık/koyu moduna uyuyor ve açık modda
        koyu zemin üstüne koyu ikon çiziyordu. Açık tema gelirse stil
        src/platform/'dan SystemBars.setStyle ile temaya bağlanmalı.
        insetsHandling varsayılan (css) bırakıldı.
      */
      style: "DARK",
    },
    LocalNotifications: {
      /*
        Tekrar hatırlatıcısının küçük ikonu: tek renkli logo
        (android/app/src/main/res/drawable/ic_stat_slot.xml). Renk tokens.css
        --accent; Android ikonu ve uygulama adını bu renkle boyar.
      */
      smallIcon: "ic_stat_slot",
      iconColor: "#22d3ee",
      /*
        Yalnızca iOS okur: uygulama öndeyken hatırlatma banner ve ses
        olmadan Bildirim Merkezi'ne düşer; kullanıcı zaten çalışıyor.
        Eklentinin varsayılanı banner + ses + rozet + liste.
      */
      presentationOptions: ["list"],
    },
  },
};

export default config;
