import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION, emptyStore, readStore } from "./progress";

describe("readStore", () => {
  it("soundEnabled alanı olmayan eski kayıt kırılmaz, ses açık gelir", () => {
    const old = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { fastMode: true, lang: "tr", activeCategories: ["sql"], initialized: true },
    };

    const { store, recovered } = readStore(old);

    expect(recovered).toBe(false);
    expect(store.settings.soundEnabled).toBe(true);
    expect(store.settings.fastMode).toBe(true);
  });

  it("kapatılmış ses tercihini korur", () => {
    const saved = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { soundEnabled: false },
    };

    expect(readStore(saved).store.settings.soundEnabled).toBe(false);
  });

  it("soundHintShown alanı olmayan eski kayıtta ipucu gösterilmemiş sayılır", () => {
    const old = { schemaVersion: SCHEMA_VERSION, progress: {}, settings: {} };

    const { store, recovered } = readStore(old);

    expect(recovered).toBe(false);
    expect(store.settings.soundHintShown).toBe(false);
  });

  it("hapticsEnabled alanı olmayan eski kayıt kırılmaz, titreşim açık gelir", () => {
    const old = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { fastMode: true, soundEnabled: false, activeCategories: ["sql"], initialized: true },
    };

    const { store, recovered } = readStore(old);

    expect(recovered).toBe(false);
    expect(store.settings.hapticsEnabled).toBe(true);
    // Sesten bağımsız: kapalı ses titreşimi kapatmaz.
    expect(store.settings.soundEnabled).toBe(false);
  });

  it("hatırlatıcı alanları olmayan eski kayıt kırılmaz, ikisi de kapalı gelir", () => {
    const old = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { fastMode: true, hapticsEnabled: false, activeCategories: ["sql"], initialized: true },
    };

    const { store, recovered } = readStore(old);

    expect(recovered).toBe(false);
    expect(store.settings.reminderEnabled).toBe(false);
    expect(store.settings.reminderOfferShown).toBe(false);
    expect(store.settings.hapticsEnabled).toBe(false);
  });

  it("knownCategories alanı olmayan eski kayıt kırılmaz, alan boş diziye dönmez", () => {
    const old = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { activeCategories: ["sql"], initialized: true },
    };

    const { store, recovered } = readStore(old);

    expect(recovered).toBe(false);
    // Boş dizi "hiçbir kategori görülmedi" olurdu; geçiş alanın yokluğuna bakıyor.
    expect(store.settings.knownCategories).toBeUndefined();
  });

  it("açılmış hatırlatıcıyı ve gösterilmiş öneriyi korur", () => {
    const saved = {
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { reminderEnabled: true, reminderOfferShown: true },
    };

    const { settings } = readStore(saved).store;
    expect(settings.reminderEnabled).toBe(true);
    expect(settings.reminderOfferShown).toBe(true);
  });

  it("kapatılmış titreşim tercihini korur", () => {
    const saved = { schemaVersion: SCHEMA_VERSION, progress: {}, settings: { hapticsEnabled: false } };

    expect(readStore(saved).store.settings.hapticsEnabled).toBe(false);
  });
});

describe("emptyStore", () => {
  it("ilk açılışta ses açık", () => {
    expect(emptyStore().settings.soundEnabled).toBe(true);
  });

  it("ilk açılışta hatırlatıcı kapalı, öneri gösterilmemiş", () => {
    expect(emptyStore().settings.reminderEnabled).toBe(false);
    expect(emptyStore().settings.reminderOfferShown).toBe(false);
  });

  it("ilk açılışta titreşim açık", () => {
    expect(emptyStore().settings.hapticsEnabled).toBe(true);
  });
});
