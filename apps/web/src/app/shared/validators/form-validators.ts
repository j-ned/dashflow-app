import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Seuil unique pour tout mot de passe ou passphrase protégeant le compte ou les données E2EE.
// Ne pas dupliquer ce nombre ailleurs (cf. audit F001/F002 : divergence de seuils entre écrans).
export const PASSWORD_MIN_LENGTH = 12;

// Attach to the FormGroup, not individual controls: needs access to both fields.
export function passwordMatchValidator(passwordField: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordField)?.value;
    const confirm = group.get(confirmField)?.value;
    return password === confirm ? null : { mismatch: true };
  };
}

// Attach to the FormGroup: requires cross-field read to enforce conditional presence.
export function conditionalRequiredValidator(
  targetField: string,
  targetValue: string,
  requiredField: string,
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const target = group.get(targetField)?.value;
    const required = group.get(requiredField)?.value;
    if (target === targetValue && !required) {
      return { conditionalRequired: { field: requiredField } };
    }
    return null;
  };
}
