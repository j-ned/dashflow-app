import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExternalNavigator {
  assign(url: string): void {
    window.location.assign(url);
  }
}
