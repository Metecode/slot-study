import { useState } from "react";

import styles from "./App.module.css";
import { useAnalytics } from "./analytics/useAnalytics";
import { useAuth } from "./auth/useAuth";
import { CategoryPicker } from "./components/CategoryPicker";
import { Footer } from "./components/Footer";
import { LoadWarningBanner } from "./components/LoadWarningBanner";
import { Machine } from "./components/Machine";
import { ReminderOffer } from "./components/ReminderOffer";
import { SettingsPanel } from "./components/SettingsPanel";
import { Stage } from "./components/Stage";
import { StepIndicator } from "./components/StepIndicator";
import { TopBar } from "./components/TopBar";
import { UsageNotice } from "./components/UsageNotice";
import { useReminderSettings } from "./hooks/useReminderSettings";
import { useReviewReminder } from "./hooks/useReviewReminder";
import { useSession } from "./hooks/useSession";
import { useSettings } from "./hooks/useSettings";
import { useTurnFlow } from "./hooks/useTurnFlow";
import { AVAILABLE_CATEGORIES, QUESTIONS } from "./content";
import { loadWarning } from "./storage/loadWarning";
import { useSaveOnChange } from "./storage/useSaveOnChange";
import { useStore } from "./storage/useStore";
import { useProgressSync } from "./sync/useProgressSync";
import type { Store } from "./domain/progress";

export default function App() {
  const { loaded, save } = useStore();

  // Depo okunmadan oturum kurulmuyor; okuma IndexedDB'den, göz kırpması kadar.
  // O aralıkta boş bir kabuk duruyor: yarım bir arayüz çizip hemen
  // değiştirmektense hiç çizmemek daha sakin.
  if (!loaded) {
    return (
      <div className={styles.root}>
        <main className={styles.app}>
          <p className={styles.loadingText} role="status">
            Yükleniyor…
          </p>
        </main>
      </div>
    );
  }

  return <Session store={loaded.store} warning={loadWarning(loaded)} save={save} />;
}

type SessionProps = {
  store: Store;
  /** Açılışta okumanın sonucuyla ilgili uyarı; her şey yolundaysa null. */
  warning: string | null;
  save: (store: Store) => void;
};

/*
  Oturum, ayarlar, hatırlatıcı ve turun akışı kendi hook'larında; burası
  onları birbirine bağlıyor. Efektli hook'ların çağrı sırası bilinçli: diske
  yazma → senkron → hatırlatıcı → kullanım ölçümü → spinKey (useTurnFlow).
  Bölmeden önceki sıra buydu;
  üstteki üç hook (useSession, useSettings, useReminderSettings) pasif
  efekt içermediği için öne alınmaları bu sırayı değiştirmiyor.
*/
function Session({ store, warning, save }: SessionProps) {
  const session = useSession(store);
  const { state } = session;
  const { progress, activeCategories } = state;
  const settings = useSettings(store.settings);
  const reminder = useReminderSettings(store.settings);

  useSaveOnChange(save, state, {
    fastMode: settings.fastMode,
    soundEnabled: settings.soundEnabled,
    soundHintShown: settings.soundHintShown,
    hapticsEnabled: settings.hapticsEnabled,
    reminderEnabled: reminder.enabled,
    reminderOfferShown: reminder.offerShown,
  });

  // Sunucu ikinci kopya: senkron oturuma yazar, diske yazmayı yukarıdaki
  // efekt zaten üstleniyor. Doğrudan IndexedDB'ye yazsaydı bu efekt bir
  // sonraki render'da onu bellekteki eski haliyle ezerdi.
  const { status, user } = useAuth();
  const { pushQuestion } = useProgressSync({
    progress,
    // Misafirde null: senkron modülü hiç istek atmaz.
    userId: status === "authenticated" && user ? user.id : null,
    onMerged: session.applySync,
  });

  // Tekrar hatırlatıcısı: kayıt, kategori değişimi ve arka plana geçişte
  // yeniden kurulur. İzin sistemden kaldırılmışsa anahtar kapanır.
  useReviewReminder({
    enabled: reminder.enabled,
    progress,
    questions: QUESTIONS,
    activeCategories,
    onPermissionLost: reminder.permissionLost,
  });

  // Kullanım ölçümü: app_open, periyodik ve arka plana geçişte gönderim.
  // Sıra: hatırlatıcıdan sonra, spinKey'den önce; diske yazmayla ilişkisi yok,
  // kendi namespace'ine yazıyor.
  const usage = useAnalytics({ progress, questions: QUESTIONS, activeCategories });
  const [settingsOpenRequest, setSettingsOpenRequest] = useState(0);

  // Turun akışı (spinKey efekti, cevap, değerlendirme). Efekt sırasında son.
  const { spinKey, handleSubmit, handleRate } = useTurnFlow({
    session,
    pushQuestion,
    offerReminderAfterRating: reminder.offerAfterRating,
  });

  return (
    <div className={styles.root}>
      <TopBar />
      {/* Adım göstergesi üst çubuğun altında, ince bir ayırıcıyla. */}
      <StepIndicator phase={state.phase} />

      <main className={styles.shell}>
        <div className={styles.app}>
          <CategoryPicker
            categories={AVAILABLE_CATEGORIES}
            active={state.activeCategories}
            poolCount={session.activeQuestionCount}
            disabled={state.phase === "spinning"}
            onToggle={session.toggleCategory}
            onToggleAll={session.toggleAllCategories}
          />

          <Machine
            question={state.current}
            allQuestions={QUESTIONS}
            activeCategories={state.activeCategories}
            spinKey={spinKey}
            spinning={state.phase === "spinning"}
            canSpin={session.canSpin}
            fastMode={settings.fastMode}
            soundEnabled={settings.soundEnabled}
            onSoundChange={settings.changeSpeakerSound}
            soundHintKey={settings.soundHintKey}
            onPull={session.pull}
            onSettle={session.settle}
          />

          {/* Kol zaten disabled ama sebebi görünmüyor; yalnızca seçim boşken çıkar. */}
          {state.activeCategories.length === 0 && (
            <p className={styles.spinHint} role="status">
              Çevirmek için en az bir kategori seç.
            </p>
          )}

          {reminder.offerOpen && (
            <ReminderOffer onAccept={reminder.enable} onClose={reminder.closeOffer} />
          )}

          {usage.noticeOpen && (
            <UsageNotice
              onOpenSettings={() => {
                usage.closeNotice();
                setSettingsOpenRequest((n) => n + 1);
              }}
              onClose={usage.closeNotice}
            />
          )}

          <SettingsPanel
            fastMode={settings.fastMode}
            onFastModeChange={settings.setFastMode}
            soundEnabled={settings.soundEnabled}
            onSoundChange={settings.changeSound}
            hapticsEnabled={settings.hapticsEnabled}
            onHapticsChange={settings.changeHaptics}
            reminderEnabled={reminder.enabled}
            onReminderChange={reminder.change}
            reminderDenied={reminder.denied}
            usageAvailable={usage.available}
            usageEnabled={usage.enabled}
            onUsageChange={usage.setEnabled}
            openRequest={settingsOpenRequest}
          />

          <LoadWarningBanner warning={warning} />
        </div>

        {/* Soru kartı ve sonuç ekranı burada; geçişi Stage yönetiyor. */}
        <Stage
          state={state}
          onSubmit={handleSubmit}
          onPass={session.pass}
          onRate={handleRate}
          lastAnswer={session.lastAnswer}
        />
      </main>

      <Footer />
    </div>
  );
}
