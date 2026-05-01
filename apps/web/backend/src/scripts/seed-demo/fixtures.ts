// backend/src/scripts/seed-demo/fixtures.ts

export const FAMILY = [
  { firstName: 'Marie',  lastName: 'Dubois', birthDate: '1987-04-12', color: '#E11D48', notes: 'Allergie pénicilline' },
  { firstName: 'Thomas', lastName: 'Dubois', birthDate: '1985-09-23', color: '#2563EB', notes: '' },
  { firstName: 'Lucas',  lastName: 'Dubois', birthDate: '2017-11-04', color: '#16A34A', notes: 'Asthme léger' },
  { firstName: 'Léa',    lastName: 'Dubois', birthDate: '2013-06-28', color: '#9333EA', notes: '' },
] as const;

export const BANK_ACCOUNTS = [
  { name: 'Compte joint (BNP)',                 initialBalance: '5200.00',  color: '#16A34A', dotColor: '#16A34A' },
  { name: 'Marie - perso (Boursorama)',         initialBalance: '1800.00',  color: '#E11D48', dotColor: '#E11D48' },
  { name: 'Livret A famille (La Banque Postale)', initialBalance: '12400.00', color: '#2563EB', dotColor: '#2563EB' },
] as const;

export const ENVELOPES = [
  { name: 'Vacances été 2026',     type: 'vacances',   balance: '2000.00', target: '3000.00',  color: '#F59E0B', dueDay: 15 },
  { name: 'Impôts foncier',        type: 'impôts',     balance: '800.00',  target: '1200.00',  color: '#DC2626', dueDay: null },
  { name: 'Épargne urgence',       type: 'épargne',    balance: '5000.00', target: '10000.00', color: '#10B981', dueDay: null },
  { name: 'Voiture (révision)',    type: 'équipement', balance: '1500.00', target: '3000.00',  color: '#6366F1', dueDay: null },
  { name: 'Travaux salle de bain', type: 'équipement', balance: '400.00',  target: '2500.00',  color: '#0EA5E9', dueDay: null },
  { name: 'Cadeaux Noël 2026',     type: 'épargne',    balance: '180.00',  target: '500.00',   color: '#EC4899', dueDay: null },
] as const;

// 15 entries — type matches recurring_entry_type enum
export const RECURRING = [
  { label: 'Salaire Thomas',     amount: '2850.00',  type: 'income',         dayOfMonth: 28, accountIdx: 0, memberIdx: 1, category: 'Salaire' },
  { label: 'Salaire Marie',      amount: '2100.00',  type: 'income',         dayOfMonth: 30, accountIdx: 1, memberIdx: 0, category: 'Salaire' },
  { label: 'Loyer',              amount: '-1200.00', type: 'expense',        dayOfMonth: 5,  accountIdx: 0, memberIdx: null, category: 'Logement' },
  { label: 'Courses',            amount: '-650.00',  type: 'expense',        dayOfMonth: 1,  accountIdx: 0, memberIdx: null, category: 'Alimentation' },
  { label: 'EDF',                amount: '-120.00',  type: 'expense',        dayOfMonth: 10, accountIdx: 0, memberIdx: null, category: 'Énergie' },
  { label: 'Internet Free',      amount: '-39.99',   type: 'expense',        dayOfMonth: 12, accountIdx: 0, memberIdx: null, category: 'Télécom' },
  { label: 'Mutuelle famille',   amount: '-180.00',  type: 'expense',        dayOfMonth: 8,  accountIdx: 0, memberIdx: null, category: 'Santé' },
  { label: 'Assurance auto',     amount: '-85.00',   type: 'expense',        dayOfMonth: 15, accountIdx: 0, memberIdx: null, category: 'Transport' },
  { label: 'Cantine Lucas + Léa',amount: '-210.00',  type: 'expense',        dayOfMonth: 5,  accountIdx: 0, memberIdx: null, category: 'École' },
  { label: 'Essence',            amount: '-180.00',  type: 'expense',        dayOfMonth: 20, accountIdx: 0, memberIdx: null, category: 'Transport' },
  { label: 'Taxe foncière',      amount: '-1450.00', type: 'annual_expense', dayOfMonth: null, accountIdx: 0, memberIdx: null, category: 'Impôts' },
  { label: 'Taxe habitation',    amount: '-680.00',  type: 'annual_expense', dayOfMonth: null, accountIdx: 0, memberIdx: null, category: 'Impôts' },
  { label: 'Assurance habitation',amount:'-340.00',  type: 'annual_expense', dayOfMonth: null, accountIdx: 0, memberIdx: null, category: 'Logement' },
  { label: 'Netflix',            amount: '-17.99',   type: 'spending',       dayOfMonth: 18, accountIdx: 0, memberIdx: null, category: 'Loisirs' },
  { label: 'Spotify Famille',    amount: '-17.99',   type: 'spending',       dayOfMonth: 22, accountIdx: 0, memberIdx: null, category: 'Loisirs' },
] as const;

export const PRACTITIONERS = [
  { name: 'Dr Sophie Martin',   type: 'generaliste',     phone: '01 43 55 12 34', address: '12 rue Oberkampf, 75011 Paris' },
  { name: 'Dr Camille Lemoine', type: 'pediatre',        phone: '01 43 55 22 78', address: '34 boulevard Voltaire, 75011 Paris' },
  { name: 'Dr Antoine Roux',    type: 'dentiste',        phone: '01 43 67 88 91', address: '7 avenue Daumesnil, 75012 Paris' },
  { name: 'Dr Clara Bernard',   type: 'ophtalmologue',   phone: '01 43 55 44 12', address: '21 rue de la Roquette, 75011 Paris' },
  { name: 'Mme Julie Dubois',   type: 'kinesitherapeute',phone: '01 43 55 90 11', address: '15 rue Sedaine, 75011 Paris' },
  { name: 'Dr Marc Petit',      type: 'orthodontiste',   phone: '01 43 67 33 22', address: '8 rue de Reuilly, 75012 Paris' },
  { name: 'Dr Léa Garnier',     type: 'dermatologue',    phone: '01 43 55 60 80', address: '50 boulevard Voltaire, 75011 Paris' },
  { name: 'Mme Anne Lefèvre',   type: 'psychologue',     phone: '01 43 55 70 90', address: '3 rue Popincourt, 75011 Paris' },
] as const;

// Reasons by practitioner type — for randomized appointment generation
export const APPOINTMENT_REASONS: Record<string, string[]> = {
  generaliste:      ['Contrôle annuel', 'Renouvellement ordonnance', 'Bilan thyroïde', 'Toux persistante'],
  pediatre:         ['Vaccin DTP rappel', 'Contrôle croissance', 'Otite', 'Bilan annuel'],
  dentiste:         ['Détartrage', 'Carie molaire', 'Contrôle annuel', 'Bridge'],
  ophtalmologue:    ['Renouvellement lunettes', 'Fond d\'œil', 'Contrôle myopie'],
  kinesitherapeute: ['Séance lombaire', 'Rééducation cheville', 'Bilan posture'],
  orthodontiste:    ['Ajustement bagues', 'Bilan ortho', 'Pose contention'],
  dermatologue:     ['Contrôle grains de beauté', 'Eczéma chronique'],
  psychologue:      ['Séance hebdomadaire', 'Bilan anxiété'],
};

export const MEDICATIONS = [
  { name: 'Levothyrox 50µg',       type: 'comprime', dosage: '1 cp/j matin', dailyRate: '1',    quantity: 90, alertDaysBefore: 14, patientIdx: 0, skipDays: [] as number[] },
  { name: 'Doliprane 500mg',       type: 'comprime', dosage: '1 cp si fièvre', dailyRate: '0.5', quantity: 16, alertDaysBefore: 7,  patientIdx: 2, skipDays: [0, 6] },
  { name: 'Vitamine D Zyma',       type: 'gouttes',  dosage: '4 gouttes/j',  dailyRate: '0.5',  quantity: 30, alertDaysBefore: 10, patientIdx: 3, skipDays: [] },
  { name: 'Smecta',                type: 'sirop',    dosage: '1 sachet × 3/j', dailyRate: '3',  quantity: 15, alertDaysBefore: 3,  patientIdx: 2, skipDays: [] },
  { name: 'Crème hydrocortisone',  type: 'creme',    dosage: 'Application × 2/j', dailyRate: '2', quantity: 14, alertDaysBefore: 5, patientIdx: 3, skipDays: [] },
  { name: 'Aspégic 500',           type: 'gelule',   dosage: '1 sachet si maux de tête', dailyRate: '0.3', quantity: 20, alertDaysBefore: 7, patientIdx: 1, skipDays: [] },
] as const;

export const DOCUMENTS = [
  { type: 'compte_rendu', title: 'CR consultation cardiologie',  patientIdx: 1, practitionerIdx: 0 },
  { type: 'compte_rendu', title: 'CR contrôle dentaire',         patientIdx: 0, practitionerIdx: 2 },
  { type: 'compte_rendu', title: 'CR bilan ortho Lucas',         patientIdx: 2, practitionerIdx: 5 },
  { type: 'facture',      title: 'Facture mutuelle Q1 2026',     patientIdx: 0, practitionerIdx: null },
  { type: 'facture',      title: 'Facture mutuelle Q4 2025',     patientIdx: 0, practitionerIdx: null },
  { type: 'bilan',        title: 'Bilan sanguin Marie',          patientIdx: 0, practitionerIdx: 0 },
  { type: 'certificat',   title: 'Certificat sport Lucas',       patientIdx: 2, practitionerIdx: 1 },
  { type: 'courrier',     title: 'Orientation pédiatre→ortho',   patientIdx: 2, practitionerIdx: 1 },
] as const;
