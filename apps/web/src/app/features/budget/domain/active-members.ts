import { Member } from './models/member.model';

/**
 * Garde uniquement les membres référencés par au moins un élément de `owned`
 * (envelope, loan, ...). Les `memberId` vides / null sont ignorés.
 */
export function activeMembers(
  members: readonly Member[],
  owned: readonly { readonly memberId: string | null }[],
): Member[] {
  const referenced = new Set(owned.map((o) => o.memberId).filter(Boolean));
  return members.filter((m) => referenced.has(m.id));
}
