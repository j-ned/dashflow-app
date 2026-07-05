import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';

// ── Types ──

type ConfettiParticle = {
  readonly left: number; // % horizontal de départ
  readonly color: string; // classe tailwind bg-*
  readonly delay: number; // ms
  readonly drift: number; // px de dérive horizontale
  readonly rotate: number; // deg
};

type ConfettiRun = {
  readonly id: number;
  readonly particles: readonly ConfettiParticle[];
};

const PARTICLE_COUNT = 80;
// Couvre le pire cas : délai max des particules (~200ms) + durée d'animation (1.4s).
const RUN_DURATION_MS = 1600;
const PARTICLE_COLORS = [
  'bg-ib-green',
  'bg-ib-cyan',
  'bg-ib-blue',
  'bg-ib-orange',
  'bg-ib-yellow',
  'bg-ib-red',
] as const;

function buildParticles(): ConfettiParticle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    left: Math.random() * 100,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    delay: Math.random() * 200,
    drift: (Math.random() - 0.5) * 200,
    rotate: Math.random() * 720 - 360,
  }));
}

// ── Service ──

@Injectable({ providedIn: 'root' })
export class Celebration {
  private _nextId = 0;
  private readonly _runs = signal<ConfettiRun[]>([]);
  readonly runs = this._runs.asReadonly();

  celebrate(): void {
    if (this.prefersReducedMotion()) return;
    const run: ConfettiRun = { id: this._nextId++, particles: buildParticles() };
    this._runs.update((runs) => [...runs, run]);
    setTimeout(() => {
      this._runs.update((runs) => runs.filter((r) => r.id !== run.id));
    }, RUN_DURATION_MS);
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}

// ── Overlay (monté une seule fois dans app.ts) ──

@Component({
  selector: 'app-confetti-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @for (run of runs(); track run.id) {
      <div class="pointer-events-none fixed inset-0 z-[9998] overflow-hidden" aria-hidden="true">
        @for (p of run.particles; track $index) {
          <span
            class="confetti-particle absolute top-[-5%] block h-2 w-2 rounded-[1px]"
            [class]="p.color"
            [style.left.%]="p.left"
            [style.animation-delay.ms]="p.delay"
            [style.--drift]="p.drift + 'px'"
            [style.--rot]="p.rotate + 'deg'"
          ></span>
        }
      </div>
    }
  `,
  styles: `
    .confetti-particle {
      opacity: 0;
      animation: confetti-fall 1.4s cubic-bezier(0.4, 0, 0.6, 1) forwards;
    }

    @keyframes confetti-fall {
      0% {
        opacity: 1;
        transform: translateY(0) translateX(0) rotate(0deg);
      }
      100% {
        opacity: 0;
        transform: translateY(105vh) translateX(var(--drift)) rotate(var(--rot));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .confetti-particle {
        display: none;
        animation: none;
      }
    }
  `,
})
export class ConfettiContainer {
  protected readonly runs = inject(Celebration).runs;
}
