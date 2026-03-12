import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Cross-field validator: checks that two fields have matching values.
 * Attach to the FormGroup, not individual controls.
 */
export function passwordMatchValidator(passwordField: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordField)?.value;
    const confirm = group.get(confirmField)?.value;
    return password === confirm ? null : { mismatch: true };
  };
}

/**
 * Cross-field validator: requires `requiredField` when `targetField` has value `targetValue`.
 * Attach to the FormGroup.
 */
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
