import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'lifetimePercent' })
export class LifetimePercentPipe implements PipeTransform {
  transform(installedAt: string | null, estimatedLifetimeDays: number | null): number | null {
    if (!installedAt || !estimatedLifetimeDays || estimatedLifetimeDays <= 0) {
      return null;
    }

    const installed = new Date(installedAt).getTime();
    const now = Date.now();
    const elapsedDays = (now - installed) / (1000 * 60 * 60 * 24);
    const remaining = Math.max(0, 100 - (elapsedDays / estimatedLifetimeDays) * 100);

    return Math.round(remaining);
  }
}
