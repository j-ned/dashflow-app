// jsdom n'implémente pas IndexedDB : polyfill nécessaire pour tester CryptoStore
// (persistance de la clé maîtresse E2EE, cf. audit F003).
import 'fake-indexeddb/auto';
