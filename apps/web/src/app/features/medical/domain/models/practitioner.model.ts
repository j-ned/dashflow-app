export type PractitionerType = 'generaliste' | 'pediatre' | 'psychiatre' | 'neurologue' | 'ophtalmologue' | 'dentiste' | 'orthodontiste' | 'orthophoniste' | 'psychologue' | 'psychomotricien' | 'ergotherapeute' | 'kinesitherapeute' | 'dermatologue' | 'cardiologue' | 'autre';

export type Practitioner = {
  readonly id: string;
  readonly name: string;
  readonly type: PractitionerType;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly bookingUrl: string | null;
};
