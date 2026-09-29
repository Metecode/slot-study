import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mergeQuestions, targetPathFor } from "./run.ts";

/* Gerçek dosya sistemiyle, her testte geçici bir src/content kopyası. */

let root: string;
let contentDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "merge-questions-"));
  contentDir = join(root, "content");
  mkdirSync(join(contentDir, "tr"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function question(id: string, category = "react", prompt = `${id} nedir, açıkla?`) {
  const concept = (conceptId: string) => ({
    id: conceptId,
    label: conceptId,
    aliases: [conceptId],
    anchors: [`${conceptId} için yeterince uzun bir çapa cümlesi.`],
  });
  return {
    id,
    category,
    topic: "Temeller",
    difficulty: 1,
    prompt,
    modelAnswer: "Yeterince uzun bir model cevap metni.",
    keyConcepts: [concept("a"), concept("b"), concept("c")],
  };
}

function file(category: string, questions: unknown[]) {
  return { lang: "tr", category, questions };
}

function writeContent(name: string, value: unknown): string {
  const path = join(contentDir, "tr", name);
  writeFileSync(path, JSON.stringify(value, null, 2), "utf-8");
  return path;
}

function writeSource(value: unknown): string {
  const path = join(root, "source.json");
  writeFileSync(path, JSON.stringify(value), "utf-8");
  return path;
}

function readIds(path: string): string[] {
  return (JSON.parse(readFileSync(path, "utf-8")) as { questions: { id: string }[] }).questions.map((q) => q.id);
}

const reactTarget = () => targetPathFor(contentDir, "tr", "react");

describe("mergeQuestions", () => {
  it("yeni soruları mevcutların sonuna ekler, sırayı korur", () => {
    writeContent("content-react.json", file("react", [question("react-b"), question("react-a")]));
    const sourcePath = writeSource(file("react", [question("react-d"), question("react-c")]));

    const outcome = mergeQuestions({ sourcePath, contentDir, replace: false });

    expect(outcome).toMatchObject({ status: "merged", added: ["react-d", "react-c"], replaced: [], total: 4 });
    expect(readIds(reactTarget())).toEqual(["react-b", "react-a", "react-d", "react-c"]);
  });

  it("hedef yoksa oluşturur", () => {
    const sourcePath = writeSource(file("docker", [question("docker-a", "docker")]));

    const outcome = mergeQuestions({ sourcePath, contentDir, replace: false });

    expect(outcome).toMatchObject({ status: "merged", created: true, total: 1 });
    expect(readIds(targetPathFor(contentDir, "tr", "docker"))).toEqual(["docker-a"]);
  });

  it("hedefte çakışma varsa hiçbir şey yazmaz ve çakışanları listeler", () => {
    const targetPath = writeContent("content-react.json", file("react", [question("react-a"), question("react-b")]));
    const before = readFileSync(targetPath, "utf-8");
    const sourcePath = writeSource(file("react", [question("react-b"), question("react-yeni")]));

    const outcome = mergeQuestions({ sourcePath, contentDir, replace: false });

    expect(outcome).toMatchObject({ status: "conflict", targetConflicts: ["react-b"], otherFileConflicts: [] });
    expect(readFileSync(targetPath, "utf-8")).toBe(before);
  });

  it("--replace çakışanı aynı yerde kaynaktakiyle değiştirir", () => {
    writeContent("content-react.json", file("react", [question("react-a"), question("react-b"), question("react-c")]));
    const sourcePath = writeSource(file("react", [question("react-b", "react", "Yeni metin: react-b nedir?")]));

    const outcome = mergeQuestions({ sourcePath, contentDir, replace: true });

    expect(outcome).toMatchObject({ status: "merged", added: [], replaced: ["react-b"], total: 3 });
    const written = JSON.parse(readFileSync(reactTarget(), "utf-8"));
    expect(written.questions.map((q: { id: string }) => q.id)).toEqual(["react-a", "react-b", "react-c"]);
    expect(written.questions[1].prompt).toBe("Yeni metin: react-b nedir?");
  });

  it("hedefte olup kaynakta olmayan soruları asla silmez", () => {
    const kept = [question("react-a"), question("react-b"), question("react-c")];
    writeContent("content-react.json", file("react", kept));
    const sourcePath = writeSource(file("react", [question("react-b"), question("react-d")]));

    mergeQuestions({ sourcePath, contentDir, replace: true });

    const written = JSON.parse(readFileSync(reactTarget(), "utf-8"));
    expect(written.questions.map((q: { id: string }) => q.id)).toEqual(["react-a", "react-b", "react-c", "react-d"]);
    expect(written.questions[0]).toEqual(kept[0]);
    expect(written.questions[2]).toEqual(kept[2]);
  });

  it("mevcut soruları şema varsayılanlarıyla değiştirmeden olduğu gibi yazar", () => {
    const legacy = question("react-eski");
    writeContent("content-react.json", file("react", [legacy]));
    const sourcePath = writeSource(file("react", [question("react-yeni")]));

    mergeQuestions({ sourcePath, contentDir, replace: false });

    const written = JSON.parse(readFileSync(reactTarget(), "utf-8"));
    expect(written.questions[0]).not.toHaveProperty("kind");
  });

  it("başka kategori dosyasındaki id ile çakışmada --replace ile de durur", () => {
    const targetPath = writeContent("content-react.json", file("react", [question("react-a")]));
    writeContent("content-javascript.json", file("javascript", [question("ortak-id", "javascript")]));
    const before = readFileSync(targetPath, "utf-8");
    const sourcePath = writeSource(file("react", [question("ortak-id")]));

    const outcome = mergeQuestions({ sourcePath, contentDir, replace: true });

    expect(outcome).toMatchObject({
      status: "conflict",
      otherFileConflicts: [{ id: "ortak-id", file: "content-javascript.json" }],
    });
    expect(readFileSync(targetPath, "utf-8")).toBe(before);
  });

  it("geçersiz kaynakta dosyalara dokunmaz, soru id'si ve alanı söyler", () => {
    const targetPath = writeContent("content-react.json", file("react", [question("react-a")]));
    const before = readFileSync(targetPath, "utf-8");
    const broken = { ...question("react-bozuk"), keyConcepts: question("x").keyConcepts.slice(0, 2) };
    const sourcePath = writeSource(file("react", [question("react-yeni"), broken]));

    const outcome = mergeQuestions({ sourcePath, contentDir, replace: true });

    expect(outcome.status).toBe("invalid-source");
    if (outcome.status !== "invalid-source") return;
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toMatch(/^soru "react-bozuk" · keyConcepts: /);
    expect(readFileSync(targetPath, "utf-8")).toBe(before);
  });

  it("kaynakta tekrar eden id'yi geçersiz sayar", () => {
    const sourcePath = writeSource(file("react", [question("react-a"), question("react-a")]));

    const outcome = mergeQuestions({ sourcePath, contentDir, replace: false });

    expect(outcome).toMatchObject({ status: "invalid-source", errors: [expect.stringContaining('"react-a"')] });
  });
});
