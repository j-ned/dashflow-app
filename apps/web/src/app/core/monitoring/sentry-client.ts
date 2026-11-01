// Seules ces deux fonctions sont utilisées. Les ré-exporter ici (au lieu d'un `import('@sentry/angular')`
// direct) laisse le bundler élaguer le reste du paquet dans le morceau chargé à la demande.
export { init, captureException } from '@sentry/angular';
