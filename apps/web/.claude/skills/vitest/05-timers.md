# Fake Timers Vitest — Reference

## Activer / desactiver
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Fixer la date systeme
```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2025-01-15T10:00:00'));

expect(new Date().toISOString()).toBe('2025-01-15T10:00:00.000Z');
expect(Date.now()).toBe(new Date('2025-01-15T10:00:00').getTime());
```

## Avancer les timers
```typescript
// Par duree
vi.advanceTimersByTime(1000);       // avancer de 1 seconde
await vi.advanceTimersByTimeAsync(1000); // version async

// Au prochain timer
vi.advanceTimersToNextTimer();
await vi.advanceTimersToNextTimerAsync();

// Executer tous les timers en attente
vi.runAllTimers();
await vi.runAllTimersAsync();

// Seulement les timers deja programmes
vi.runOnlyPendingTimers();
await vi.runOnlyPendingTimersAsync();
```

## Inspecter les timers
```typescript
vi.getTimerCount();     // nombre de timers en attente
vi.clearAllTimers();    // supprimer tous les timers
vi.isFakeTimers();      // true si fake timers actifs
```

## Exemple pratique — debounce
```typescript
it('should debounce the callback', () => {
  vi.useFakeTimers();
  const fn = vi.fn();
  const debounced = debounce(fn, 300);

  debounced();
  debounced();
  debounced();

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(300);

  expect(fn).toHaveBeenCalledTimes(1);
});
```

## Exemple pratique — date
```typescript
it('should format relative date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-06-15'));

  const result = formatRelativeDate(new Date('2025-06-14'));
  expect(result).toBe('yesterday');

  vi.useRealTimers();
});
```
