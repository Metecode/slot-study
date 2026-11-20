// Alt bilgideki sürüm metni. Commit bilinmiyorsa (production'da kaynak
// bulunamadıysa boş gelir) ayırıcı da yazılmaz: "v1.1.0", "v1.1.0 · " değil.
export function versionLabel(appVersion: string, commitSha: string): string {
  return commitSha ? `v${appVersion} · ${commitSha}` : `v${appVersion}`;
}
