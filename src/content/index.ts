import { availableCategories, parseQuestionFile } from "../domain/question";
import type { Category, Question } from "../domain/question";
import cybersecurity from "./tr/content-cybersecurity.json";
import docker from "./tr/content-docker.json";
import dotnet from "./tr/content-dotnet.json";
import java from "./tr/content-java.json";
import javascript from "./tr/content-javascript.json";
import react from "./tr/content-react.json";
import sql from "./tr/content-sql.json";
import web from "./tr/content-web.json";

/* ------------------------------------------------------------------ */
/* İçerik — repo'dan gelir, her dosya parseQuestionFile ile doğrulanır. */
/* Dosya içi tekrar eden id'yi parseQuestionFile zaten yakalıyor;       */
/* burada yalnızca dosyalar arası çakışma kontrol edilir.               */
/* ------------------------------------------------------------------ */

const FILES: ReadonlyArray<readonly [string, unknown]> = [
  ["tr/content-cybersecurity.json", cybersecurity],
  ["tr/content-docker.json", docker],
  ["tr/content-dotnet.json", dotnet],
  ["tr/content-java.json", java],
  ["tr/content-javascript.json", javascript],
  ["tr/content-react.json", react],
  ["tr/content-sql.json", sql],
  ["tr/content-web.json", web],
];

function loadQuestions(): Question[] {
  const questions: Question[] = [];
  const seenIds = new Set<string>();

  for (const [path, raw] of FILES) {
    const file = parseQuestionFile(path, raw);
    for (const question of file.questions) {
      if (seenIds.has(question.id)) {
        throw new Error(`${path}: dosyalar arası tekrar eden id "${question.id}"`);
      }
      seenIds.add(question.id);
      questions.push(question);
    }
  }

  return questions;
}

export const QUESTIONS: Question[] = loadQuestions();

/**
 * Arayüzün göstereceği kategoriler. CATEGORIES ileride eklenecekleri de
 * sayıyor; içeriği olmayan bir kategori seçilebilir görünüp havuza hiçbir
 * soru katmıyordu. Liste bu yüzden içerikten türetilir.
 */
export const AVAILABLE_CATEGORIES: Category[] = availableCategories(QUESTIONS);
