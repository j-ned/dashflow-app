import { TestBed } from '@angular/core/testing';
import { SidebarStore } from './sidebar.store';

type Listener = (event: { matches: boolean }) => void;

function stubMatchMedia(matches: boolean) {
  const listeners: Listener[] = [];
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: (_: string, listener: Listener) => listeners.push(listener),
  }));
  return (next: boolean) => listeners.forEach((listener) => listener({ matches: next }));
}

describe('SidebarStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('suit la préférence enregistrée sur un écran large', () => {
    stubMatchMedia(false);
    const store = TestBed.inject(SidebarStore);
    expect(store.collapsed()).toBe(false);

    store.toggle();
    expect(store.collapsed()).toBe(true);
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
  });

  it('force le rail sur un écran étroit sans toucher à la préférence', () => {
    stubMatchMedia(true);
    const store = TestBed.inject(SidebarStore);
    expect(store.narrow()).toBe(true);
    expect(store.collapsed()).toBe(true);

    store.toggle();
    expect(localStorage.getItem('sidebar-collapsed')).toBeNull();
  });

  it('se déplie à nouveau quand la fenêtre redevient large', () => {
    const resize = stubMatchMedia(true);
    const store = TestBed.inject(SidebarStore);
    expect(store.collapsed()).toBe(true);

    resize(false);
    expect(store.collapsed()).toBe(false);
  });
});
