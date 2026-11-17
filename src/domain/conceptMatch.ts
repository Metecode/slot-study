/* ------------------------------------------------------------------ */
/* Kavram eşleşmesinin seviyesi — kullanıcının gördüğü sonuç            */
/* ------------------------------------------------------------------ */

/*
  Sonuç ekranı (ScoreCard) alt yazıyı bu seviyeye göre seçiyor; kullanım
  ölçümündeki self_eval.aliasResult da buradan geliyor. Metrik kullanıcının
  gördüğü sonucu onun kendi değerlendirmesiyle karşılaştırıyor, iki yer bu
  yüzden aynı fonksiyonu kullanır, ayrı ayrı hesaplamaz.
*/

/**
 * all  — tüm kavramlar geçiyor ("Tüm kavramlar cevabında geçiyor.")
 * some — en az biri ("3 kavramdan 2'si cevabında geçiyor.")
 * none — hiçbiri
 */
export type ConceptMatchLevel = "all" | "some" | "none";

/** Kavramı olmayan soru (total 0) "all" sayılır: eksik kavram yok. */
export function conceptMatchLevel(hitCount: number, total: number): ConceptMatchLevel {
  if (hitCount >= total) return "all";
  if (hitCount > 0) return "some";
  return "none";
}
