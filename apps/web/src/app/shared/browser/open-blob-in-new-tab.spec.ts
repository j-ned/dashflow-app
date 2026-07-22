import { describe, expect, it, vi } from 'vitest';
import { openBlobInNewTab } from './open-blob-in-new-tab';

describe('openBlobInNewTab', () => {
  it('ouvre une URL objet dans un nouvel onglet puis la révoque après 60s', () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const blob = new Blob(['x'], { type: 'application/pdf' });

    openBlobInNewTab(blob);

    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(openSpy).toHaveBeenCalledWith('blob:fake-url', '_blank');
    expect(revokeSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url');

    vi.useRealTimers();
    createSpy.mockRestore();
    revokeSpy.mockRestore();
    openSpy.mockRestore();
  });
});
