// Alt bilgideki commit kısaltması. vite.config.ts derleme anında çağırır;
// Node'da çalışır ama yan etkisi yok: ortam ve git okuyucu dışarıdan gelir.

export interface CommitLabelSources {
  // process.env'in yalnızca okunan kısmı.
  env: { GITHUB_SHA?: string; CM_COMMIT?: string };
  // `vite build` mi (true), dev sunucusu/Vitest mi (false).
  isBuild: boolean;
  // Yerel depodaki HEAD; git yoksa ya da depo değilse undefined.
  readGitHead: () => string | undefined;
}

const SHORT_SHA_LENGTH = 7;

// Kaynak sırası: GITHUB_SHA (web, Docker build arg'ı), CM_COMMIT (Codemagic),
// git (yerel Android release'i; yalnızca derlemede). Hiçbiri yoksa
// production'da boş: alt bilgi yalnızca sürümü yazar. Dev sunucusunda "dev".
export function resolveCommitLabel({ env, isBuild, readGitHead }: CommitLabelSources): string {
  const fromEnv = firstNonEmpty(env.GITHUB_SHA, env.CM_COMMIT);
  const sha = fromEnv ?? (isBuild ? firstNonEmpty(readGitHead()) : undefined);
  if (sha) return sha.slice(0, SHORT_SHA_LENGTH);
  return isBuild ? "" : "dev";
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
