import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.meteucar.slot",
  appName: "Slot",
  // Vite'ın çıktı klasörü (vite.config.ts'te build.outDir yok, varsayılan).
  webDir: "dist",
  server: {
    /*
      Varsayılan zaten "https"; açıkça yazıldı çünkü origin'i belirliyor
      (https://localhost) ve IndexedDB'deki ilerleme origin'e bağlı.
      Değişirse kullanıcının cihazdaki ilerlemesi görünmez olur.
      server.url BİLEREK yok: uygulama paketlenmiş varlıklarla çalışır,
      uzak bir adresten yüklenmez.
    */
    androidScheme: "https",
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
    },
  },
};

export default config;
