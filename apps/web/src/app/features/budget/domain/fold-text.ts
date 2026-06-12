// Repli accents + casse + espaces pour un appariement texte tolérant (catégories libres, dédup import).
export function foldText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}
