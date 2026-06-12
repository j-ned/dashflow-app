import { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { map } from 'rxjs';

// Signal reflétant l'invalidité d'un form, recalculé à chaque changement de statut.
// Évite de dupliquer le pattern `toSignal(form.statusChanges...)` dans chaque formulaire.
export function formInvalid(control: AbstractControl): Signal<boolean> {
  return toSignal(
    control.statusChanges.pipe(map(() => control.invalid)),
    { initialValue: control.invalid },
  );
}
