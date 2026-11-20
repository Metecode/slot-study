import { describe, expect, it, vi } from "vitest";

import { resolveCommitLabel } from "./commitLabel.ts";

const GITHUB = "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CODEMAGIC = "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GIT = "3333333ccccccccccccccccccccccccccccccccc";

describe("resolveCommitLabel", () => {
  it("GITHUB_SHA her şeyden önce gelir", () => {
    const readGitHead = vi.fn(() => GIT);
    const label = resolveCommitLabel({
      env: { GITHUB_SHA: GITHUB, CM_COMMIT: CODEMAGIC },
      isBuild: true,
      readGitHead,
    });
    expect(label).toBe("1111111");
    // Ortamda commit varken git hiç çağrılmaz.
    expect(readGitHead).not.toHaveBeenCalled();
  });

  it("GITHUB_SHA yoksa CM_COMMIT", () => {
    const label = resolveCommitLabel({
      env: { CM_COMMIT: CODEMAGIC },
      isBuild: true,
      readGitHead: () => GIT,
    });
    expect(label).toBe("2222222");
  });

  it("boş GITHUB_SHA atlanır", () => {
    const label = resolveCommitLabel({
      env: { GITHUB_SHA: "  ", CM_COMMIT: CODEMAGIC },
      isBuild: true,
      readGitHead: () => GIT,
    });
    expect(label).toBe("2222222");
  });

  it("ortamda yoksa git", () => {
    const label = resolveCommitLabel({ env: {}, isBuild: true, readGitHead: () => `${GIT}\n` });
    expect(label).toBe("3333333");
  });

  it("hiçbiri yoksa production'da boş", () => {
    const label = resolveCommitLabel({ env: {}, isBuild: true, readGitHead: () => undefined });
    expect(label).toBe("");
  });

  it("hiçbiri yoksa dev sunucusunda \"dev\"", () => {
    const label = resolveCommitLabel({ env: {}, isBuild: false, readGitHead: () => undefined });
    expect(label).toBe("dev");
  });

  it("dev sunucusunda git okunmaz, \"dev\" kalır", () => {
    const readGitHead = vi.fn(() => GIT);
    const label = resolveCommitLabel({ env: {}, isBuild: false, readGitHead });
    expect(label).toBe("dev");
    expect(readGitHead).not.toHaveBeenCalled();
  });

  it("dev sunucusunda ortamdaki commit yine kullanılır", () => {
    const label = resolveCommitLabel({ env: { GITHUB_SHA: GITHUB }, isBuild: false, readGitHead: () => GIT });
    expect(label).toBe("1111111");
  });
});
