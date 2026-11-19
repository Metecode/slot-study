import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "./SettingsPanel";
import type { SettingsPanelProps } from "./SettingsPanel";
import { SoundToggle } from "./SoundToggle";

/* ------------------------------------------------------------------ */
/* Ayarlar paneli — ARIA bağları ve ses kontrollerinin tutarlılığı      */
/*                                                                     */
/* Test ortamında DOM yok; bileşenler renderToStaticMarkup ile HTML'e   */
/* çizilip bağlar metinden okunuyor. Native ve iOS satırları için        */
/* platform bayrakları test içinden değiştirilebilir.                   */
/* ------------------------------------------------------------------ */

const flags = vi.hoisted(() => ({ native: false, apple: false }));

vi.mock("../platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../platform")>();
  return {
    ...actual,
    platformFeatures: new Proxy(actual.platformFeatures, {
      get: (target, key) => (key === "haptics" || key === "reminders" ? flags.native : Reflect.get(target, key)),
    }),
  };
});

vi.mock("../hooks/useSoundHint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useSoundHint")>();
  return {
    ...actual,
    get IS_APPLE_TOUCH_DEVICE() {
      return flags.apple;
    },
  };
});

afterEach(() => {
  flags.native = false;
  flags.apple = false;
});

const noop = () => {};

function panel(over: Partial<SettingsPanelProps> = {}): string {
  return renderToStaticMarkup(
    <SettingsPanel
      animationMode="short"
      onAnimationModeChange={noop}
      soundEnabled
      onSoundChange={noop}
      hapticsEnabled
      onHapticsChange={noop}
      reminderEnabled={false}
      onReminderChange={noop}
      reminderDenied={false}
      usageAvailable
      usageEnabled
      onUsageChange={noop}
      openRequest={0}
      {...over}
    />,
  );
}

/** id'si verilen öğenin metni (iç içe etiketler atılır). */
function textOf(html: string, id: string): string | null {
  const match = new RegExp(`<(\\w+)[^>]*\\bid="${escape(id)}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html);
  return match ? match[2].replace(/<[^>]+>/g, "").trim() : null;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Etiketi verilen anahtarın öznitelikleri. */
function switchFor(html: string, label: string) {
  const labelId = new RegExp(`<span id="([^"]+)"[^>]*>${escape(label)}</span>`).exec(html)?.[1];
  if (!labelId) throw new Error(`etiket yok: ${label}`);
  const button = new RegExp(`<button[^>]*aria-labelledby="${escape(labelId)}"[^>]*>`).exec(html)?.[0];
  if (!button) throw new Error(`anahtar yok: ${label}`);
  const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(button)?.[1] ?? null;
  return {
    role: attr("role"),
    checked: attr("aria-checked"),
    describedBy: attr("aria-describedby"),
  };
}

/** role="group" öğelerinin başlıkları, sırayla. */
function groupTitles(html: string): string[] {
  return [...html.matchAll(/role="group" aria-labelledby="([^"]+)"/g)].map((m) => textOf(html, m[1]) ?? "");
}

describe("ses kontrolleri", () => {
  it("makinedeki hoparlör ve Ayarlar'daki Ses anahtarı aynı değerle aynı durumu çizer", () => {
    for (const enabled of [true, false]) {
      const speaker = /aria-pressed="([^"]+)"/.exec(renderToStaticMarkup(<SoundToggle enabled={enabled} onChange={noop} />))?.[1];
      const setting = switchFor(panel({ soundEnabled: enabled }), "Ses").checked;
      expect(speaker).toBe(String(enabled));
      expect(setting).toBe(String(enabled));
    }
  });
});

describe("anahtar satırları", () => {
  it("her anahtar role=switch ve aria-checked taşır, adı yalnızca etiketinden gelir", () => {
    flags.native = true;
    const html = panel({ hapticsEnabled: false });
    for (const label of ["Ses", "Titreşim", "Tekrar hatırlatıcısı", "Kullanım istatistiklerini paylaş"]) {
      const row = switchFor(html, label);
      expect(row.role).toBe("switch");
      expect(["true", "false"]).toContain(row.checked);
    }
    expect(switchFor(html, "Titreşim").checked).toBe("false");
  });

  it("açıklama yalnızca kendi anahtarına bağlı", () => {
    flags.native = true;
    flags.apple = true;
    const html = panel();

    const sound = switchFor(html, "Ses");
    expect(textOf(html, sound.describedBy ?? "")).toBe("iPhone sessiz moddayken ses çalmaz.");
    // Titreşim'in açıklaması yok; Ses'in notu ona bağlanmıyor.
    expect(switchFor(html, "Titreşim").describedBy).toBeNull();

    const usage = switchFor(html, "Kullanım istatistiklerini paylaş");
    expect(textOf(html, usage.describedBy ?? "")).toContain("rastgele bir kurulum kimliğiyle");
    expect(textOf(html, usage.describedBy ?? "")).toContain("Gizlilik politikası");

    const reminder = switchFor(html, "Tekrar hatırlatıcısı");
    expect(textOf(html, reminder.describedBy ?? "")).not.toBeNull();
    // Üç açıklama üç ayrı öğe.
    expect(new Set([sound.describedBy, usage.describedBy, reminder.describedBy]).size).toBe(3);
  });

  it("iOS dışında Ses'in açıklaması yok", () => {
    expect(switchFor(panel(), "Ses").describedBy).toBeNull();
  });
});

describe("gruplar", () => {
  it("native'de üç grup, başlıklarına bağlı", () => {
    flags.native = true;
    expect(groupTitles(panel())).toEqual(["Görünüm ve geri bildirim", "Hatırlatma", "Gizlilik"]);
  });

  it("web'de hatırlatıcı yok: grup da çizilmez", () => {
    expect(groupTitles(panel())).toEqual(["Görünüm ve geri bildirim", "Gizlilik"]);
  });

  it("ölçüm kapalı derlemede gizlilik grubu çizilmez", () => {
    expect(groupTitles(panel({ usageAvailable: false }))).toEqual(["Görünüm ve geri bildirim"]);
  });

  it("animasyon seçimi radio grubu olarak kalır", () => {
    const html = panel({ animationMode: "off" });
    expect(html).toContain('role="radiogroup"');
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>Kapalı</);
  });
});
