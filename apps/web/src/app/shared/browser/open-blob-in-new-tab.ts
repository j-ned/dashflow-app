// Révocation différée de 60s : laisse le temps à l'onglet ouvert par window.open() de charger le
// blob avant que l'URL ne devienne invalide (revoke immédiat casserait le chargement asynchrone).
export function openBlobInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
