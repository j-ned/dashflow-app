import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { MedicalDocument } from '../../domain/models/document.model';

export const MedicalDocumentSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  practitionerId: z.nullable(z.string()),
  type: z.enum(['compte_rendu', 'facture', 'bilan', 'certificat', 'courrier', 'autre']),
  title: z.string(),
  date: z.string(),
  fileUrl: z.nullable(z.string()),
  notes: z.nullable(z.string()),
});

// Garde-fou : si MedicalDocument évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof MedicalDocumentSchema>, MedicalDocument>>;
