import { describe, it, expect } from 'vitest';
import { RecurringEntriesController } from './recurring-entries.controller';

// Expose les transformations protégées (pures) pour les tester sans HTTP ni DB.
class TestableController extends RecurringEntriesController {
  publicCreateValues(body: Record<string, unknown>) {
    return this.toCreateValues(body);
  }
  publicUpdatePatch(body: Record<string, unknown>) {
    return this.toUpdatePatch(body);
  }
}

describe('RecurringEntriesController — transferts chiffrés (E2EE)', () => {
  const controller = new TestableController(null as never, null as never);
  const toAccountId = '11111111-1111-4111-8111-111111111111';

  describe('toCreateValues — branche chiffrée', () => {
    it('Given un virement chiffré avec toAccountId, When create, Then toAccountId est conservé', () => {
      const values = controller.publicCreateValues({
        encryptedData: 'blob',
        toAccountId,
      });

      // Régression : sans toAccountId, le compte destination n'est jamais crédité.
      expect(values.toAccountId).toBe(toAccountId);
    });

    it('Given un virement chiffré sans toAccountId, When create, Then toAccountId vaut null', () => {
      const values = controller.publicCreateValues({ encryptedData: 'blob' });
      expect(values.toAccountId).toBeNull();
    });
  });

  describe('toUpdatePatch — branche chiffrée', () => {
    it('Given une édition chiffrée avec toAccountId, When update, Then toAccountId est propagé', () => {
      const patch = controller.publicUpdatePatch({
        encryptedData: 'blob',
        toAccountId,
      });
      expect(patch.toAccountId).toBe(toAccountId);
    });
  });
});
