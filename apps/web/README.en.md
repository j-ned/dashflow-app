<div align="center">

[Français](./README.md) · **English**

# ⚡ DashFlow

### Personal **all-in-one** dashboard — family budget & medical tracking

**Self-hosted · End-to-end encrypted · Zero third-party cloud**

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono-4-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-Private-333?style=for-the-badge)]()

[**🔗 Live demo**](https://dashflow.j-ned.dev) · [**📸 Screenshots**](#-screenshots) · [**🛡️ Security**](#️-security--end-to-end-encryption) · [**🏗️ Architecture**](#️-architecture)

<img src="public/screen/img.webp" alt="DashFlow — Bank account" width="100%" />

</div>

---

## 📖 Table of contents

- [🎯 The problem](#-the-problem)
- [💡 The solution](#-the-solution)
- [✨ Features](#-features)
- [🛡️ Security — end-to-end encryption](#️-security--end-to-end-encryption)
- [🏗️ Architecture](#️-architecture)
- [🧰 Tech stack](#-tech-stack)
- [📸 Screenshots](#-screenshots)
- [🚀 Installation](#-installation)
- [🗺️ Roadmap](#️-roadmap)

---

## 🎯 The problem

Managing the family budget **and** the household's medical tracking inside a single app **without handing your financial or medical data to a third-party cloud service** — it didn't exist.

Off-the-shelf solutions cover one or the other, or force you to store sensitive documents (prescriptions, payslips) on servers whose jurisdiction or access you do not control.

## 💡 The solution

A **self-hosted** application, **encrypted client-side** (AES-256-GCM + PBKDF2), centralizing:

- 💰 **Budget** — accounts, envelopes, loans, recurring entries, salary archives, 12-month projections
- 🏥 **Medical** — patients, practitioners, medications, prescriptions, documents, alerts
- 🔐 **E2EE** — the server **never** sees data in clear text

Even if the server is compromised: no exploitable data leaves the box.

---

## ✨ Features

### 💰 Budget

| Feature               | Details                                                            |
| --------------------- | ------------------------------------------------------------------ |
| **Bank account**      | Income, direct debits, annual charges, spending, remaining balance |
| **Virtual envelopes** | Savings, holidays, equipment, taxes — progress and goals           |
| **Loans & Debts**     | Loan tracking, repayments, full history                            |
| **Recurring entries** | Monthly and annual charges per household member                    |
| **Salary archives**   | Historized payslips (encrypted S3 storage)                         |
| **Statistics**        | KPIs, 12-month evolution, breakdown, projections                   |

### 🏥 Medical

| Feature             | Details                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| **Family overview** | Per-member dashboard: appointments, prescriptions, medications, alerts |
| **Patients**        | Complete health profiles for each family member                        |
| **Practitioners**   | Medical contact book with specialties                                  |
| **Medications**     | Stock, dosages, depletion alerts                                       |
| **Documents**       | Blood tests, certificates, vaccination records                         |
| **Appointments**    | Per-patient and per-practitioner schedule                              |
| **Prescriptions**   | Active and expired prescriptions                                       |
| **Alerts**          | Low-stock notifications and automatic reminders                        |

### ⚙️ Cross-feature

- 🔐 **E2EE encryption** — AES-256-GCM + PBKDF2 + double key envelope
- ⌨️ **Command palette** — `Ctrl+K` with fuzzy search
- 🔔 **Toasts & confirm dialogs** — full UI system
- 📊 **Custom SVG charts** — area, donut, bar, **zero external dependency**
- 🔑 **2FA (TOTP)** — Google Authenticator / Authy compatible
- 🌙 **Dark mode** optimized
- 🌍 **i18n FR/EN** — runtime locale switch with `prefers-language` listener

---

## 🛡️ Security — end-to-end encryption

> The main technical challenge of DashFlow: **no business data must leave the browser in clear text.**

### Encryption chain

```mermaid
graph LR
  A[User password] -->|PBKDF2 600k iterations| B[Derived encryption key KEK]
  B -->|AES-KW key wrapping| C[Encrypted data key DEK]
  D[Business data] -->|AES-256-GCM with DEK| E[Encrypted payload]
  E -->|HTTPS| F[(PostgreSQL — opaque payload)]
  C -->|HTTPS| F
```

### Why a **double key envelope**?

- **Password rotation** without re-encrypting the whole database: only the DEK is re-wrapped (AES-KW) with a new KEK
- **Multi-device**: each device can decrypt the DEK with the password, no need to share the derived key
- **Zero-knowledge server**: the backend never stores the KEK, only the encrypted DEK

### Guarantees

- ✅ **AES-256-GCM** — authenticated encryption (encryption + integrity)
- ✅ **PBKDF2-SHA-256 600k iterations** (OWASP recommendation)
- ✅ **Unique IV** per payload (never reused)
- ✅ **Optional TOTP 2FA**
- ✅ **Rate limiting** on all sensitive routes
- ✅ **Argon2id** for server-side password hashes
- ✅ **JWT refresh tokens** with rotation

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

### Backend — Hono (same monorepo)

The backend lives in [`apps/api`](../api) of the same monorepo. It exposes a REST API served on the frontend's domain under `/api` (httpOnly `SameSite=Lax` cookie, CSRF token). See [`apps/api/README.md`](../api/README.md) for the detailed structure.

---

## 🧰 Tech stack

### Frontend

- **Framework**: Angular 21 (zoneless, Signals, standalone components)
- **Styling**: TailwindCSS v4 (dark-first)
- **Fonts**: Inter Variable + JetBrains Mono Variable (self-hosted)
- **i18n**: `@jsverse/transloco` (runtime FR/EN switch)
- **Tests**: Vitest (unit + component)
- **Build**: `@angular/build` with esbuild

### Backend (`apps/api`)

- **Runtime**: Node.js + Hono
- **ORM**: Drizzle ORM + drizzle-kit migrations
- **Database**: PostgreSQL 17
- **Auth**: JWT (httpOnly cookies), Argon2id, Arctic (OAuth)
- **2FA**: TOTP
- **Storage**: Cloudflare R2
- **Email**: Nodemailer
- **Validation**: Zod

### DevOps

- **Containerization**: multi-stage Docker
- **Reverse proxy**: Traefik
- **Deployment**: OVH VPS with Dokploy
- **CI/CD**: GitHub Actions

---

## 📸 Screenshots

<table>
  <tr>
    <td width="50%">
      <p align="center"><b>Budget — Overview</b></p>
      <img src="public/screen/img.webp" alt="Bank account" width="100%" />
    </td>
    <td width="50%">
      <p align="center"><b>Budget — Virtual envelopes</b></p>
      <img src="public/screen/img_1.webp" alt="Envelopes" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <p align="center"><b>Budget — Loans & debts</b></p>
      <img src="public/screen/img_2.webp" alt="Loans" width="100%" />
    </td>
    <td width="50%">
      <p align="center"><b>Budget — Recurring entries</b></p>
      <img src="public/screen/img_3.webp" alt="Recurring entries" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <p align="center"><b>Budget — Salary archives</b></p>
      <img src="public/screen/img_4.webp" alt="Archives" width="100%" />
    </td>
    <td width="50%">
      <p align="center"><b>Medical — Patients</b></p>
      <img src="public/screen/img_6.webp" alt="Patients" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <p align="center"><b>Medical — Prescriptions</b></p>
      <img src="public/screen/img_7.webp" alt="Prescriptions" width="100%" />
    </td>
    <td width="50%">
      <p align="center"><b>Stats — Member overview</b></p>
      <img src="public/screen/img_9.webp" alt="Statistics" width="100%" />
    </td>
  </tr>
</table>

---

## 🚀 Installation

> Requirements: Node.js ≥ 20, pnpm

### From the monorepo root

```bash
pnpm install
(cd apps/api && make db-up)   # PostgreSQL via Docker/Podman
pnpm dev:api                  # API → http://localhost:3001
pnpm dev:web                  # frontend → http://localhost:4200
```

The frontend calls `/api` (`apiUrl` in `src/environments/environment.ts`): in dev, the Angular dev server proxies it to `http://localhost:3001` (`proxy.conf.json`). No environment variables are needed on the Angular side.

### Docker

```bash
docker build -f apps/web/Dockerfile -t dashflow-web .   # from the monorepo root
docker run -p 8080:8080 dashflow-web
```

> Prod: a single domain (`dashflow.nedellec-julien.fr`). Traefik routes `/api` to the API container and everything else to this nginx container — see [`docs/deploiement-meme-origine.md`](../../docs/deploiement-meme-origine.md).

---

## 🗺️ Roadmap

- [x] Budget — accounts, envelopes, loans, recurring entries
- [x] Medical — patients, practitioners, medications, prescriptions
- [x] E2EE (AES-256-GCM + PBKDF2 + double envelope)
- [x] Custom SVG charts
- [x] Command palette `Ctrl+K`
- [x] TOTP 2FA
- [x] i18n FR/EN runtime switch
- [ ] Automatic bank file import (OFX / CSV)
- [ ] Monthly PDF report export
- [ ] Offline-first PWA
- [ ] Encrypted multi-device sync

---

<div align="center">

**Built by [Julien Nedellec](https://j-ned.dev)**

[![Portfolio](https://img.shields.io/badge/Portfolio-j--ned.dev-4f46e5?style=for-the-badge)](https://j-ned.dev)
[![GitHub](https://img.shields.io/badge/GitHub-j--ned-181717?style=for-the-badge&logo=github)](https://github.com/j-ned)

</div>
