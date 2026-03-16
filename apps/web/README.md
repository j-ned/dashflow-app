# ⚡ DashFlow

> **Tableau de bord personnel tout-en-un — Budget & Suivi Medical Familial**

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Hono](https://img.shields.io/badge/Hono-Backend-E36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-Private-333?style=flat-square)]()

---

![DashFlow — Compte bancaire](./public/screen/img.png)

DashFlow est une application web **self-hosted** qui centralise la gestion du **budget familial** et le **suivi medical** de toute la famille dans une interface sombre, moderne et securisee. Toutes les donnees sensibles sont protegees par un **chiffrement de bout en bout (E2EE)**.

---

## Fonctionnalites

### 💰 Budget

- **Compte bancaire** — Vue d'ensemble : revenus, prelevements, charges annuelles, depenses, solde restant
- **Enveloppes** — Systeme d'enveloppes virtuelles (epargne, vacances, equipement, impots) avec progression
- **Prets & Dettes** — Suivi des emprunts et remboursements avec historique
- **Entrees recurrentes** — Charges mensuelles et annuelles par membre du foyer
- **Archives salaires** — Historique des fiches de paie (stockage S3)
- **Statistiques** — KPIs, evolution 12 mois, repartition des depenses, projections

### 🏥 Medical

- **Vue globale famille** — Dashboard par membre : rendez-vous, ordonnances, medicaments, alertes
- **Patients** — Profils sante de chaque membre de la famille
- **Praticiens** — Carnet de contacts medicaux avec specialites
- **Medicaments** — Suivi des stocks, posologies, alertes d'epuisement
- **Documents** — Bilans sanguins, certificats, carnets de vaccination
- **Rendez-vous** — Planning des consultations par patient et praticien
- **Ordonnances** — Prescriptions actives et expirees
- **Alertes** — Notifications stock bas et rappels

### ⚙️ Transversal

- **E2EE** — Chiffrement de bout en bout (AES-256-GCM + PBKDF2 + double enveloppe)
- **Command Palette** — Navigation rapide `Ctrl+K` avec recherche fuzzy
- **Toasts** — Notifications success / error / info avec auto-dismiss
- **Confirm Dialog** — Dialogues de confirmation modaux
- **Charts SVG** — Graphiques area, donut, bar — zero dependance externe
- **Dark theme** — Interface sombre optimisee

---

## Captures d'ecran

### Budget — Vue globale membre

![Vue globale membre](./public/screen/img_9.png)

### Budget — Enveloppes

![Enveloppes](./public/screen/img_1.png)

### Medical — Vue globale famille

![Medical — Vue globale](./public/screen/img_2.png)

### Medical — Medicaments

![Medicaments](./public/screen/img_4.png)

### Medical — Rendez-vous

![Rendez-vous](./public/screen/img_6.png)

### Medical — Praticiens

![Praticiens](./public/screen/img_7.png)

### Medical — Documents

![Documents](./public/screen/img_3.png)

---

## Stack technique

| Couche | Technologie |
| --- | --- |
| **Frontend** | Angular 21 (zoneless, signals, OnPush) |
| **Styles** | TailwindCSS v4 |
| **Backend** | Hono + Drizzle ORM |
| **Base de donnees** | PostgreSQL |
| **Stockage fichiers** | S3 (Garage) |
| **Email** | Nodemailer |
| **Tests** | Vitest |
| **Deploiement** | Dokploy (mono-repo) |
| **Chiffrement** | Web Crypto API (AES-256-GCM, PBKDF2, AES-KW) |

---

## Architecture

```
src/app/
├── core/                   # Services singleton, guards, interceptors
├── features/
│   ├── auth/               # Authentification, forgot-password
│   ├── budget/             # Compte, enveloppes, prets, archives, stats
│   │   ├── domain/         # Models, gateways (abstract), use-cases
│   │   ├── infra/          # HTTP gateways + couche E2EE
│   │   ├── pages/          # Smart components
│   │   └── components/     # Dumb components
│   ├── medical/            # Patients, praticiens, medicaments, RDV, docs
│   │   ├── domain/
│   │   ├── infra/
│   │   ├── pages/
│   │   └── components/
│   └── settings/
├── layout/                 # App shell, sidebar, layouts Budget/Medical
├── shared/                 # Charts SVG, modals, toasts, command palette
└── app.routes.ts           # Routing avec lazy loading
```

**Clean Architecture** — le domain est pur TypeScript, l'infra depend du domain (jamais l'inverse), le cablage se fait dans `app.config.ts`.

```
UI (pages) → Use Cases → Gateways (abstract) ← Infra (HTTP + E2EE)
```

---

## Securite — E2EE

```
Mot de passe ──PBKDF2──▶ Derived Key ──AES-KW──▶ Master Key ──AES-256-GCM──▶ Donnees
```

- **Double enveloppe** — le mot de passe derive une cle qui deverrouille la cle maitre
- **Cle de recuperation** — 64 caracteres hex, affichee une seule fois
- **Transparent** — les gateways chiffrent/dechiffrent automatiquement
- **Zero connaissance** — le serveur ne voit jamais les donnees en clair

---

## Demarrage rapide

### Prerequis

- **Node.js** >= 22
- **pnpm** >= 10
- **PostgreSQL** >= 15
- **S3** compatible (Garage, MinIO, AWS)

### Installation

```bash
git clone <repo-url> dash-flow
cd dash-flow

pnpm install

cp .env.example .env
# Editer .env avec vos credentials (DB, S3, SMTP)

pnpm db:migrate

# Demarrer en dev
pnpm start          # Frontend — localhost:4200
pnpm dev:backend    # Backend  — localhost:3000
```

### Commandes

| Commande | Description |
| --- | --- |
| `pnpm start` | Serveur de dev Angular |
| `pnpm build` | Build production |
| `pnpm test` | Tests Vitest |
| `pnpm dev:backend` | Serveur backend Hono |

---

## Variables d'environnement

```env
# Base de donnees
DATABASE_URL=postgresql://user:pass@localhost:5432/dashflow

# S3 (Garage / MinIO)
S3_ENDPOINT=http://localhost:3900
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_SALARY_BUCKET=salaires

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Auth
JWT_SECRET=...
```

---

## Licence

Projet prive — tous droits reserves.

---

*Built with Angular 21, Hono, PostgreSQL & Web Crypto API*