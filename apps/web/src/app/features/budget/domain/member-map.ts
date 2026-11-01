import { Member } from './models/member.model';

export type MemberDisplay = { readonly name: string; readonly color: string };

export const MEMBER_PALETTE = [
  'var(--color-ib-green)',
  'var(--color-ib-blue)',
  'var(--color-ib-purple)',
  'var(--color-ib-orange)',
  'var(--color-ib-pink)',
  'var(--color-ib-cyan)',
  'var(--color-ib-yellow)',
  'var(--color-ib-red)',
] as const;

export function buildMemberMap(members: readonly Member[]): Map<string, MemberDisplay> {
  return new Map(
    members.map((m, i) => [
      m.id,
      { name: `${m.firstName} ${m.lastName}`, color: MEMBER_PALETTE[i % MEMBER_PALETTE.length] },
    ]),
  );
}
