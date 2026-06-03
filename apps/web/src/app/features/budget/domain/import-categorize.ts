const RULES: readonly { readonly re: RegExp; readonly code: string }[] = [
  { re: /carrefour|leclerc|auchan|lidl|intermarch|monoprix|course|restau|boulanger/i, code: 'food' },
  { re: /loyer|rent|edf|engie|eau|gaz|charges/i, code: 'housing' },
  { re: /sncf|ratp|uber|essence|carburant|total|peage|train|billet/i, code: 'transport' },
  { re: /netflix|spotify|abonnement|cotisation|free|sfr|orange|bouygues/i, code: 'subscription' },
  { re: /assurance|mutuelle|maif|macif|axa/i, code: 'insurance' },
  { re: /pharmacie|m[ée]decin|docteur|sant[ée]|hopital/i, code: 'health' },
];

export function suggestCategory(label: string): string {
  return RULES.find((r) => r.re.test(label))?.code ?? 'other';
}
