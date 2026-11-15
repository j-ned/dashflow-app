// Scénario k6 du test de charge (cf. README.md). Deux scénarios, lancés séparément :
//   SCENARIO=navigation : des utilisateurs connectés qui consultent leurs pages, de plus en plus
//                         nombreux (paliers de 25 à 200 utilisateurs simultanés) ;
//   SCENARIO=connexions : des connexions par seconde, de plus en plus nombreuses (Argon2).
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8088/api';
const USERS = Number(__ENV.USERS || 200);
const PASSWORD = 'mot-de-passe-de-charge-0123';
// Origine du front (schéma, hôte, port), exigée par la politique CSRF sur la connexion.
const ORIGIN = BASE.replace(/^(https?:\/\/[^/]+).*$/, '$1');

// Adresse annoncée par utilisateur virtuel (en-tête x-load-ip) : chacun son compteur de
// throttling, comme des visiteurs distincts.
const ipOf = (n) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;

const PAGES = [
  '/auth/me',
  '/bank-accounts',
  '/transactions/all',
  '/envelopes',
  '/patients',
  '/appointments',
];

const scenarios = {
  navigation: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 25 },
      { duration: '1m', target: 25 },
      { duration: '30s', target: 50 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 200 },
      { duration: '1m', target: 200 },
      { duration: '20s', target: 0 },
    ],
    exec: 'navigation',
  },
  connexions: {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 300,
    stages: [
      { duration: '1m', target: 2 },
      { duration: '1m', target: 5 },
      { duration: '1m', target: 10 },
      { duration: '1m', target: 20 },
    ],
    exec: 'connexions',
  },
};

const chosen = __ENV.SCENARIO || 'navigation';

export const options = {
  scenarios: { [chosen]: scenarios[chosen] },
  // Par défaut k6 vide les cookies à chaque itération : l'utilisateur virtuel serait déconnecté
  // après sa première boucle. Ici il garde sa session, comme un vrai navigateur.
  noCookiesReset: true,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:page}': ['p(95)<500'],
    'http_req_duration{kind:login}': ['p(95)<2000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function login(n) {
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: `load+${(n % USERS) + 1}@example.test`, password: PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'x-load-ip': ipOf(n) },
      tags: { kind: 'login' },
    },
  );
  check(res, { 'connexion 200': (r) => r.status === 200 });
  return res.status === 200;
}

export function navigation() {
  const vu = exec.vu.idInTest;
  // Une connexion par utilisateur virtuel, puis il navigue avec son cookie de session.
  if (exec.vu.iterationInScenario === 0 && !login(vu)) return;
  for (const page of PAGES) {
    const res = http.get(`${BASE}${page}`, {
      headers: { 'x-load-ip': ipOf(vu) },
      tags: { kind: 'page', page },
    });
    check(res, { 'page 200': (r) => r.status === 200 });
  }
  // Temps de lecture d'un vrai utilisateur entre deux pages.
  sleep(1 + Math.random() * 2);
}

export function connexions() {
  // Une adresse différente à chaque connexion : on mesure Argon2, pas le throttling.
  login(exec.scenario.iterationInTest);
}
