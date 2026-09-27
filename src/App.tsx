import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";

import styles from "./App.module.css";
import { ensureAudioReady } from "./audio/audioContext";
import { playLever } from "./audio/sounds";
import { useAuth } from "./auth/useAuth";
import { CategoryPicker } from "./components/CategoryPicker";
import { ChevronIcon } from "./components/ChevronIcon";
import { Collapse } from "./components/Collapse";
import { Footer } from "./components/Footer";
import { Machine } from "./components/Machine";
import { ReminderOffer } from "./components/ReminderOffer";
import { ReminderSetting } from "./components/ReminderSetting";
import { Stage } from "./components/Stage";
import { StepIndicator } from "./components/StepIndicator";
import { Switch } from "./components/Switch";
import { TopBar } from "./components/TopBar";
import { useReviewReminder } from "./hooks/useReviewReminder";
import { IS_APPLE_TOUCH_DEVICE, useSoundHint } from "./hooks/useSoundHint";
import { platformFeatures } from "./platform";
import { haptics } from "./platform/haptics";
import { reminders } from "./platform/reminders";
import { AVAILABLE_CATEGORIES, QUESTIONS } from "./content";
import { evaluateLexical } from "./domain/evaluate";
import { countRatings, shouldOfferReminder } from "./domain/reminder";
import { initialSessionState, sessionReducer, toStore } from "./domain/session";
import type { SessionState } from "./domain/session";
import { loadWarning } from "./storage/loadWarning";
import { useStore } from "./storage/useStore";
import { useProgressSync } from "./sync/useProgressSync";
import type { ProgressMap } from "./sync/progressSync";
import type { SelfRating, Store } from "./domain/progress";
import type { Category } from "./domain/question";

/**
 * İlk state, diskten geleni HYDRATE ile uygulayarak kurulur.
 * HYDRATE'i efektte dispatch etmek yerine burada uygulamak sıralama
 * sorununu tamamen kaldırıyor: efekt sırası yüzünden kayıt, hidrasyondan
 * önceki boş state'i diske basamıyor.
 *
 * İlk açılışta (initialized false) hangi kategorilerin açık geleceğine
 * reducer kendisi karar veriyor — bkz. session.ts HYDRATE dalı.
 */
function initState(store: Store): SessionState {
  return sessionReducer(initialSessionState(), {
    type: "HYDRATE",
    progress: store.progress,
    settings: store.settings,
  });
}

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

function Session({ store, warning, save }: SessionProps) {
  const [state, dispatch] = useReducer(sessionReducer, store, initState);
  const [spinKey, setSpinKey] = useState(0);
  const [fastMode, setFastMode] = useState(store.settings.fastMode);
  const [soundEnabled, setSoundEnabled] = useState(store.settings.soundEnabled);
  const soundHint = useSoundHint(store.settings.soundHintShown);
  const soundHintShown = soundHint.hintShown;
  const [hapticsEnabled, setHapticsEnabled] = useState(store.settings.hapticsEnabled);
  const [reminderEnabled, setReminderEnabled] = useState(store.settings.reminderEnabled);
  const [reminderOfferShown, setReminderOfferShown] = useState(store.settings.reminderOfferShown);
  // Oturumluk: izin reddi notu ve bu oturumda açılan öneri kartı diske yazılmaz.
  const [reminderDenied, setReminderDenied] = useState(false);
  const [reminderOfferOpen, setReminderOfferOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const [warningDismissed, setWarningDismissed] = useState(false);
  const prevPhaseRef = useRef(state.phase);

  // Kaydı RATE'i kovalayarak değil, ilerleme ve ayar değişimini izleyerek
  // yapıyoruz: hangi eylemin yazdırdığını bilmek gerekmiyor. Efekt ilk
  // render'da da çalışır ama yazmaz: yazıcı ilk değeri yalnızca
  // karşılaştırma noktası yapar (bkz. storage/storeWriter.ts).
  const { progress, activeCategories } = state;
  useEffect(() => {
    save(
      toStore(
        { progress, activeCategories },
        { fastMode, soundEnabled, soundHintShown, hapticsEnabled, reminderEnabled, reminderOfferShown },
      ),
    );
  }, [
    progress,
    activeCategories,
    fastMode,
    soundEnabled,
    soundHintShown,
    hapticsEnabled,
    reminderEnabled,
    reminderOfferShown,
    save,
  ]);

  // Haptik modülü tercihi kendisi tutuyor, çağrı noktalarına ayar inmiyor.
  // Boyamadan önce eşitlenir: tıklama her zaman güncel değeri görür.
  useLayoutEffect(() => {
    haptics.setEnabled(hapticsEnabled);
  }, [hapticsEnabled]);

  // Sunucu ikinci kopya: senkron oturuma yazar, diske yazmayı yukarıdaki
  // efekt zaten üstleniyor. Doğrudan IndexedDB'ye yazsaydı bu efekt bir
  // sonraki render'da onu bellekteki eski haliyle ezerdi.
  const { status, user } = useAuth();
  const handleMerged = useCallback((merged: ProgressMap) => {
    dispatch({ type: "SYNC_PROGRESS", progress: merged });
  }, []);
  const { pushQuestion } = useProgressSync({
    progress,
    // Misafirde null: senkron modülü hiç istek atmaz.
    userId: status === "authenticated" && user ? user.id : null,
    onMerged: handleMerged,
  });

  // Tekrar hatırlatıcısı: kayıt, kategori değişimi ve arka plana geçişte
  // yeniden kurulur. İzin sistemden kaldırılmışsa anahtar kapanır.
  useReviewReminder({
    enabled: reminderEnabled,
    progress,
    questions: QUESTIONS,
    activeCategories,
    onPermissionLost: () => {
      setReminderEnabled(false);
      setReminderDenied(true);
    },
  });

  // Kategori seçicisinin yanındaki havuz bilgisi: aktif kategorilerdeki soru sayısı.
  const activeQuestionCount = useMemo(
    () => QUESTIONS.filter((q) => activeCategories.includes(q.category)).length,
    [activeCategories],
  );

  // spinKey yalnızca gerçek bir dönüş başladığında artar — çekiliş havuzu
  // boşsa reducer state'i değiştirmez, Machine'e anlamsız bir dönüş gitmez.
  useEffect(() => {
    if (state.phase === "spinning" && prevPhaseRef.current !== "spinning") {
      setSpinKey((key) => key + 1);
    }
    prevPhaseRef.current = state.phase;
  }, [state]);

  function handlePull() {
    dispatch({ type: "SPIN", questions: QUESTIONS, now: new Date(), rng: Math.random });
  }

  function handleSettle() {
    dispatch({ type: "SETTLE" });
  }

  function handleSubmit(answer: string) {
    if (!state.current) return;
    const question = state.current;
    // RATE denemeyi kaydederken cevabı istiyor; kart o an sökülmüş olacak.
    setLastAnswer(answer);
    dispatch({ type: "SUBMIT", evaluation: evaluateLexical(question, answer) });
  }

  function handlePass() {
    setLastAnswer("");
    dispatch({ type: "PASS" });
  }

  function handleRate(rating: SelfRating) {
    // Soru id'si dispatch'ten önce alınır: RATE turu kapatınca current null olur.
    if (state.current) pushQuestion(state.current.id);
    dispatch({ type: "RATE", rating, answer: lastAnswer, now: new Date() });

    // Öneri kartı değerlendirmenin ardından, bir kez: gösterildiği an işaretlenir,
    // kullanıcı düğmeye basmasa da bir sonraki oturumda tekrar çıkmaz.
    const offer = shouldOfferReminder({
      available: platformFeatures.reminders,
      enabled: reminderEnabled,
      offerShown: reminderOfferShown,
      // Bu değerlendirme henüz state'e yansımadı.
      totalRatings: countRatings(progress) + 1,
      ratedThisSession: true,
    });
    if (offer) {
      setReminderOfferOpen(true);
      setReminderOfferShown(true);
    }
  }

  /** İzni ister; verilirse hatırlatıcıyı açar. Anahtar ve öneri kartı ortak. */
  async function enableReminder(): Promise<boolean> {
    const granted = (await reminders.requestPermission()) === "granted";
    setReminderEnabled(granted);
    setReminderDenied(!granted);
    return granted;
  }

  // İzin yalnızca kullanıcı açtığında istenir; kapatmak izne dokunmaz.
  function handleReminderChange(enabled: boolean) {
    if (enabled) {
      void enableReminder();
      return;
    }
    setReminderEnabled(false);
    setReminderDenied(false);
  }

  /*
    Ses açılırken context de açılır: bu fonksiyon tıklamanın içinde
    çalışıyor, yani tarayıcının istediği kullanıcı hareketi tam burada.
    Açık kayıtla gelen kullanıcıda ilk kol çekişi aynı işi görür.
    Kol sesi onay olarak çalar: hem "ses açıldı" geri bildirimi (duymayan
    kullanıcı sorunu hemen fark eder) hem de iOS'ta kilidi en güvenilir
    açan yol — hareketin içinde gerçekten ses çalmak. Tık bunun için fazla
    kısa ve kısıktı.
  */
  function handleSoundChange(enabled: boolean) {
    if (enabled) {
      ensureAudioReady();
      playLever();
    }
    setSoundEnabled(enabled);
  }

  // Açılınca bir kez titreşir: ses açılınca kol sesinin çalmasının karşılığı.
  function handleHapticsChange(enabled: boolean) {
    if (enabled) haptics.switchedOn();
    setHapticsEnabled(enabled);
  }

  // Sessiz anahtar ipucu yalnızca hoparlör düğmesinde: ipucu onun yanında
  // çıkıyor. Ayarlar panelindeki anahtarın altında kalıcı not zaten var.
  function handleSpeakerSoundChange(enabled: boolean) {
    handleSoundChange(enabled);
    if (enabled) soundHint.noteSoundEnabled();
  }

  function handleToggleCategory(category: Category) {
    dispatch({ type: "TOGGLE_CATEGORY", category });
  }

  function handleToggleAllCategories() {
    // Kıyas görünen kategoriler üzerinden: içeriği olmayan bir kategori
    // seçimde kalmış olabilir, uzunluk karşılaştırması onu da sayardı.
    const allSelected = AVAILABLE_CATEGORIES.every((category) =>
      state.activeCategories.includes(category),
    );
    dispatch({
      type: "SET_CATEGORIES",
      categories: allSelected ? [] : [...AVAILABLE_CATEGORIES],
    });
  }

  const canSpin =
    (state.phase === "idle" || state.phase === "evaluated") &&
    state.activeCategories.length > 0;

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
            poolCount={activeQuestionCount}
            disabled={state.phase === "spinning"}
            onToggle={handleToggleCategory}
            onToggleAll={handleToggleAllCategories}
          />

          <Machine
            question={state.current}
            allQuestions={QUESTIONS}
            activeCategories={state.activeCategories}
            spinKey={spinKey}
            spinning={state.phase === "spinning"}
            canSpin={canSpin}
            fastMode={fastMode}
            soundEnabled={soundEnabled}
            onSoundChange={handleSpeakerSoundChange}
            soundHintKey={soundHint.hintKey}
            onPull={handlePull}
            onSettle={handleSettle}
          />

          {/* Kol zaten disabled ama sebebi görünmüyor; yalnızca seçim boşken çıkar. */}
          {state.activeCategories.length === 0 && (
            <p className={styles.spinHint} role="status">
              Çevirmek için en az bir kategori seç.
            </p>
          )}

          {reminderOfferOpen && (
            <ReminderOffer onAccept={enableReminder} onClose={() => setReminderOfferOpen(false)} />
          )}

          {/* Makineye ait ayarlar, soruya değil: yeri makinenin hemen altı.
              Varsayılan kapalı — kimse ayar aramak zorunda kalmasın. */}
          <div className={styles.settings}>
            <button
              type="button"
              className={styles.settingsToggle}
              aria-expanded={settingsOpen}
              aria-controls="settings-panel"
              onClick={() => setSettingsOpen((open) => !open)}
            >
              Ayarlar
              <ChevronIcon className={styles.chevron} />
            </button>

            <Collapse open={settingsOpen} id="settings-panel">
              <div className={styles.controls}>
                <Switch checked={fastMode} onChange={setFastMode} label="Hızlı mod" />
                <span className={styles.soundControl}>
                  <Switch
                    checked={soundEnabled}
                    onChange={handleSoundChange}
                    label="Ses"
                    describedBy={IS_APPLE_TOUCH_DEVICE ? "silent-switch-note" : undefined}
                  />
                  {/* Web'den sessiz anahtar okunamıyor; iOS'ta kalıcı hatırlatma. */}
                  {IS_APPLE_TOUCH_DEVICE && (
                    <span id="silent-switch-note" className={styles.settingsNote}>
                      iPhone sessiz moddayken ses çalmaz.
                    </span>
                  )}
                </span>
                {platformFeatures.haptics && (
                  <Switch checked={hapticsEnabled} onChange={handleHapticsChange} label="Titreşim" />
                )}
                {platformFeatures.reminders && (
                  <ReminderSetting
                    checked={reminderEnabled}
                    onChange={handleReminderChange}
                    denied={reminderDenied}
                  />
                )}
              </div>
            </Collapse>
          </div>

          {warning && !warningDismissed && (
            <div className={styles.warning} role="alert">
              <span>{warning}</span>
              <button
                type="button"
                className={styles.warningClose}
                onClick={() => setWarningDismissed(true)}
                aria-label="Uyarıyı kapat"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Soru kartı ve sonuç ekranı burada; geçişi Stage yönetiyor. */}
        <Stage
          state={state}
          onSubmit={handleSubmit}
          onPass={handlePass}
          onRate={handleRate}
          lastAnswer={lastAnswer}
        />
      </main>

      <Footer />
    </div>
  );
}
