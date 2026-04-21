<div align="center">

# ⚡ DashFlow

### Tableau de bord personnel **tout-en-un** — budget & suivi médical familial

**Self-hosted · Chiffré de bout en bout · Zéro cloud tiers**

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono-4.12-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-Private-333?style=for-the-badge)]()

[**🔗 Démo live**](https://dashflow.j-ned.dev) · [**📸 Captures**](#-captures-décran) · [**🛡️ Sécurité**](#️-sécurité-end-to-end-encryption) · [**🏗️ Architecture**](#️-architecture)

<img src="public/screen/img.webp" alt="DashFlow — Compte bancaire" width="100%" />

</div>

---

## 📖 Sommaire

- [🎯 Le problème](#-le-problème)
- [💡 La réponse](#-la-réponse)
- [✨ Fonctionnalités](#-fonctionnalités)
- [🛡️ Sécurité end-to-end encryption](#️-sécurité-end-to-end-encryption)
- [🏗️ Architecture](#️-architecture)
- [🧰 Stack technique](#-stack-technique)
- [📸 Captures d'écran](#-captures-décran)
- [🚀 Installation](#-installation)
- [🗺️ Roadmap](#️-roadmap)

---

## 🎯 Le problème

Gérer le budget familial **et** le suivi médical de toute la maisonnée dans la même appli **sans confier ses données financières ou médicales à un service cloud tiers** — ça n'existait pas.

Les solutions du marché font l'un ou l'autre, ou imposent de stocker des documents sensibles (ordonnances, fiches de paie) sur des serveurs dont on ne contrôle ni la juridiction, ni l'accès.

## 💡 La réponse

Une application **self-hosted**, **chiffrée côté client** (AES-256-GCM + PBKDF2), qui centralise :

- 💰 **Budget** — comptes, enveloppes, prêts, récurrences, archives salaires, projections 12 mois
- 🏥 **Médical** — patients, praticiens, médicaments, ordonnances, documents, alertes
- 🔐 **E2EE** — le serveur ne voit **jamais** les données en clair

Même en cas de compromission serveur : aucune donnée exploitable.

---

## ✨ Fonctionnalités

### 💰 Budget

| Fonctionnalité | Détails |
|---------------|---------|
| **Compte bancaire** | Revenus, prélèvements, charges annuelles, dépenses, solde restant |
| **Enveloppes virtuelles** | Épargne, vacances, équipement, impôts — progression et objectifs |
| **Prêts & Dettes** | Suivi des emprunts, remboursements, historique complet |
| **Entrées récurrentes** | Charges mensuelles et annuelles par membre du foyer |
| **Archives salaires** | Fiches de paie historisées (stockage S3 chiffré) |
| **Statistiques** | KPIs, évolution 12 mois, répartition, projections |

### 🏥 Médical

| Fonctionnalité | Détails |
|---------------|---------|
| **Vue globale famille** | Dashboard par membre : RDV, ordonnances, médicaments, alertes |
| **Patients** | Profils santé complets par membre de la famille |
| **Praticiens** | Carnet de contacts médicaux avec spécialités |
| **Médicaments** | Stocks, posologies, alertes d'épuisement |
| **Documents** | Bilans sanguins, certificats, carnets de vaccination |
| **Rendez-vous** | Planning des consultations par patient et praticien |
| **Ordonnances** | Prescriptions actives et expirées |
| **Alertes** | Notifications stock bas et rappels automatiques |

### ⚙️ Transversal

- 🔐 **Chiffrement E2EE** — AES-256-GCM + PBKDF2 + double enveloppe de clés
- ⌨️ **Command Palette** — `Ctrl+K` avec recherche fuzzy
- 🔔 **Toasts & Confirm Dialogs** — UI system complète
- 📊 **Charts SVG** custom — area, donut, bar, **zéro dépendance externe**
- 🔑 **2FA (TOTP)** — compatible Google Authenticator / Authy
- 🌙 **Dark mode** optimisé

---

## 🛡️ Sécurité end-to-end encryption

> Le challenge technique principal de DashFlow : **aucune donnée métier ne doit sortir du navigateur en clair.**

### Chaîne de chiffrement

```mermaid
graph LR
  A[Mot de passe utilisateur] -->|PBKDF2 100k itérations| B[Clé de chiffrement dérivée KEK]
  B -->|AES-256-GCM| C[Clé de données DEK chiffrée]
  D[Données métier] -->|AES-256-GCM avec DEK| E[Payload chiffré]
  E -->|HTTPS| F[(PostgreSQL — payload opaque)]
  C -->|HTTPS| F
```

### Pourquoi une **double enveloppe de clés** ?

- **Rotation de mot de passe** sans rechiffrer toute la base : on rechiffre uniquement la DEK avec une nouvelle KEK
- **Multi-device** : chaque appareil peut déchiffrer la DEK avec le mot de passe, sans partager la clé dérivée
- **Zero-knowledge serveur** : le backend ne stocke jamais la KEK, uniquement la DEK chiffrée

### Garanties

- ✅ **AES-256-GCM** — authenticated encryption (chiffrement + intégrité)
- ✅ **PBKDF2 100k itérations** (recommandation OWASP 2023)
- ✅ **IV unique** par payload (jamais réutilisé)
- ✅ **2FA TOTP** optionnel
- ✅ **Rate limiting** sur toutes les routes sensibles (`hono-rate-limiter`)
- ✅ **Argon2id** pour les hashs de mot de passe côté serveur
- ✅ **JWT refresh tokens** avec rotation

---

## 🏗️ Architecture

### Clean Architecture — frontend

```mermaid
graph TD
  subgraph "Application Layer (Angular)"
    UI[Smart Components]
    DC[Dumb Components]
  end

  subgraph "Domain Layer"
    UC[Use Cases]
    GW[Gateways - Interfaces]
    MD[Models]
  end

  subgraph "Infrastructure Layer"
    HTTP[HTTP Gateways]
    CRYPTO[Crypto Adapters]
    STORE[Storage Adapters]
  end

  UI --> UC
  DC --> UI
  UC --> GW
  HTTP -.implements.-> GW
  CRYPTO -.implements.-> GW
  STORE -.implements.-> GW
  UC --> MD
```

### Backend Hono + Drizzle

```
backend/
├── src/
│   ├── routes/          # endpoints Hono (auth, budget, medical, files)
│   ├── middleware/      # auth JWT, rate-limit, CORS
│   ├── db/              # schema Drizzle + migrations
│   ├── services/        # logique métier (email, S3, OAuth)
│   └── lib/             # crypto, JWT, validation zod
└── drizzle/             # migrations SQL versionnées
```

---

## 🧰 Stack technique

### Frontend

- **Framework** : Angular 21 (zoneless, Signals, standalone components)
- **Styling** : TailwindCSS v4 (dark-first)
- **Fonts** : Inter Variable + JetBrains Mono Variable (auto-hébergées)
- **Tests** : Vitest (unit + component)
- **Build** : @angular/build avec esbuild

### Backend

- **Runtime** : Node.js + Hono
- **ORM** : Drizzle ORM + drizzle-kit migrations
- **Database** : PostgreSQL 17
- **Auth** : `jose` (JWT), `argon2` (hashing), `arctic` (OAuth)
- **2FA** : `otpauth` + `qrcode`
- **Storage** : AWS S3 (fiches de paie, documents)
- **Email** : Nodemailer (rappels, notifications)
- **Validation** : Zod
- **Rate limiting** : `hono-rate-limiter`

### DevOps

- **Containerisation** : Docker multi-stage
- **Reverse proxy** : Traefik
- **Déploiement** : VPS OVH avec Dokploy
- **CI/CD** : GitHub Actions

---

## 📸 Captures d'écran

<table>
  <tr>
    <td width="50%">
      <p align="center"><b>Budget — Vue globale</b></p>
      <img src="public/screen/img.webp" alt="Compte bancaire" width="100%" />
    </td>
    <td width="50%">
      <p align="center"><b>Budget — Enveloppes virtuelles</b></p>
      <img src="public/screen/img_1.webp" alt="Enveloppes" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <p align="center"><b>Budget — Prêts & dettes</b></p>
      <img src="public/screen/img_2.webp" alt="Prêts" width="100%" />
    </td>
    <td width="50%">
      <p align="center"><b>Budget — Récurrences</b></p>
      <img src="public/screen/img_3.webp" alt="Récurrences" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <p align="center"><b>Budget — Archives salaires</b></p>
      <img src="public/screen/img_4.webp" alt="Archives" width="100%" />
    </td>
    <td width="50%">
      <p align="center"><b>Médical — Patients</b></p>
      <img src="public/screen/img_6.webp" alt="Patients" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <p align="center"><b>Médical — Ordonnances</b></p>
      <img src="public/screen/img_7.webp" alt="Ordonnances" width="100%" />
    </td>
    <td width="50%">
      <p align="center"><b>Stats — Vue globale membre</b></p>
      <img src="public/screen/img_9.webp" alt="Statistiques" width="100%" />
    </td>
  </tr>
</table>

---

## 🚀 Installation

> Pré-requis : Node.js ≥ 20, pnpm, PostgreSQL 17, Docker (optionnel)

```bash
# 1. Cloner
git clone https://github.com/j-ned/dash-flow.git
cd dash-flow

# 2. Frontend
pnpm install
pnpm start
# → http://localhost:4200

# 3. Backend (autre terminal)
cd backend
pnpm install
cp .env.example .env       # DATABASE_URL, JWT_SECRET, S3_*
pnpm db:migrate
pnpm dev
# → http://localhost:3000
```

### Variables d'environnement critiques

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dashflow
JWT_ACCESS_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
S3_ENDPOINT=...
S3_BUCKET=dashflow-docs
SMTP_HOST=...
```

### Docker

```bash
docker build -t dashflow .
docker run -p 80:80 --env-file .env dashflow
```

---

## 🗺️ Roadmap

- [x] Budget — comptes, enveloppes, prêts, récurrences
- [x] Médical — patients, praticiens, médicaments, ordonnances
- [x] E2EE (AES-256-GCM + PBKDF2 + double enveloppe)
- [x] Charts SVG custom
- [x] Command Palette `Ctrl+K`
- [x] 2FA TOTP
- [ ] Import automatique fichiers bancaires (OFX / CSV)
- [ ] Export PDF rapports mensuels
- [ ] PWA offline-first
- [ ] Multi-device sync chiffré

---

<div align="center">

**Développé par [Julien Nedellec](https://j-ned.dev)**

[![Portfolio](https://img.shields.io/badge/Portfolio-j--ned.dev-4f46e5?style=for-the-badge)](https://j-ned.dev)
[![GitHub](https://img.shields.io/badge/GitHub-j--ned-181717?style=for-the-badge&logo=github)](https://github.com/j-ned)

</div>
