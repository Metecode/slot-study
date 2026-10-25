/* ------------------------------------------------------------------ */
/* Tambur etiketi — ekrana yazılacak metin, saf                        */
/*                                                                     */
/* Tambur etiketi iki satıra kadar kırılır ama tarayıcı "/" işaretinde */
/* satır kırmıyor: "IQueryable/IEnumerable" tek kelime sayılıp         */
/* kutudan taşıyordu. "/" sonrasına görünmez bir kırılma noktası       */
/* (U+200B) eklenir; satır orada bölünebilir, kırılmazsa görünmez.     */
/* scan:layout da adları tamburda bu fonksiyondan geçirip dener.       */
/* ------------------------------------------------------------------ */

/** Genişliği olmayan boşluk: yalnızca satır kırılabilecek yeri işaretler. */
export const BREAK_HINT = "​";

/** Etiketin tamburda gösterilecek hâli: "/" sonrasında kırılabilir. */
export function reelLabel(text: string): string {
  return text.replaceAll("/", `/${BREAK_HINT}`);
}
