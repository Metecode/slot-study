import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { bootstrap } from "./auth/authClient";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isSafeDebugRequested } from "./debug/isSafeDebugRequested";
import { platformFeatures, requestPersistentStorage } from "./platform";
import { registerServiceWorker } from "./platform/serviceWorker";
import "./index.css";

/*
  Oturum açılışta bir kez sessizce yenilenir. Render bunu BEKLEMEZ:
  uygulama hesapsız tam çalışıyor, kimlik yalnızca senkron için.
  Beklemek herkesi boş ekranda bir ağ gidiş dönüşü kadar tutardı.
  Native'de (mobil v1, tamamen çevrimdışı) hiç denenmez.
*/
if (platformFeatures.auth) {
  void bootstrap();
}

// Web'de PWA önbelleği; native'de kapalı (kontrol fonksiyonun içinde).
registerServiceWorker();

// İlerleme yalnızca bu cihazda duruyor olabilir; tarayıcı yer açarken
// silmesin. Sonuç yalnızca loglanır, render beklemez.
void requestPersistentStorage();

// ?safe=iphone: çentik ve ev göstergesini masaüstünde taklit eder.
// Koşul derleme anında sabit; üretim paketine modül hiç girmiyor.
if (import.meta.env.DEV) {
  void import("./dev/safeAreaSimulation").then((m) => m.applySafeAreaSimulation());
}

// ?debug=safe: telefondan gerçek safe-area ve viewport değerlerini okumak
// için teşhis kutusu. Üretimde de çalışır; kod ayrı parçada, yalnızca bu
// parametreyle iner.
if (isSafeDebugRequested(window.location.search)) {
  void import("./debug/safeAreaDebug").then((m) => m.showSafeAreaDebug());
}

const root = document.getElementById("root");
if (!root) throw new Error("#root bulunamadı");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
