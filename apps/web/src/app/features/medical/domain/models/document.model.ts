export type DocumentType =
  | 'compte_rendu'
  | 'facture'
  | 'bilan'
  | 'certificat'
  | 'courrier'
  | 'autre';

export type MedicalDocument = {
  readonly id: string;
  readonly patientId: string;
  readonly practitionerId: string | null;
  readonly type: DocumentType;
  readonly title: string;
  readonly date: string;
  readonly fileUrl: string | null;
  readonly notes: string | null;
};
