# Product

## Register

product

> Override par tâche : la landing (`src/app/pages/landing/`) est traitée en **brand** — elle vend l'outil et doit convertir. Le reste de l'app (budget, medical, settings) reste en `product`.

## Users

**Cible primaire (landing)** : développeurs seniors / recruteurs techniques + self-hosters exigeants à la recherche d'un outil souverain pour gérer budget et suivi médical familial sans céder leurs données à un cloud tiers. Lecture rapide, scan vertical, jugement en 10 secondes : "est-ce que ce mec sait coder ? est-ce que cet outil est sérieux ?"

**Cible primaire (app)** : Julien + sa famille — utilisation quotidienne sur desktop principalement, contexte calme (à la maison), tâches récurrentes (saisie de dépenses, suivi de médicaments, planification de RDV).

Pas de grand public mainstream. Pas d'utilisateurs non-techniques sur la landing.

## Product Purpose

DashFlow centralise **budget familial + suivi médical** dans une seule app self-hosted, **chiffrée de bout en bout côté client (AES-256-GCM + PBKDF2 + double enveloppe de clés)**. Le serveur ne voit jamais les données en clair.

**Succès landing** : le visiteur clique sur "Démo live" et essaie l'app. Un seul CTA primaire — la démo. Tout le reste (GitHub, contact, doc tech) est secondaire.

**Succès app** : usage quotidien fluide, zéro friction sur les tâches répétitives (ajouter une dépense, marquer un médicament pris, planifier un RDV).

## Brand Personality

**Trois mots** : technique-confiant, sobre, transparent.

**Voix** : direct, sans superlatifs marketing, sans "delight your users", sans emojis décoratifs dans le produit (les emojis du README sont OK pour GitHub, pas pour l'app). On parle code, sécurité, contrôle, ownership. On ne vend pas — on **démontre**.

**Émotion cible** : confiance par compétence visible. Le visiteur doit sentir "ce dev maîtrise son sujet, je peux lui faire confiance avec mes données médicales".

## Anti-references

**Refusés explicitement :**

- **Notion / Linear cream-and-gradients** — palette beige-pastel + gradients doux + serif éditorial pour faire "premium SaaS"
- **Vercel-purple-glow** — fond noir + glow violet + grid background + headline bold gradient text. Cliché 2023-2024.
- **Dashboard SaaS générique** — hero metric (gros chiffre + label + sparkline), grille de cartes identiques avec icône+titre+texte, "Trusted by 1000+ teams"
- **Cyber-sécurité enterprise** — fond bleu marine + cadenas dorés + lettrage menaçant. Trop B2B-fear-driven.
- **Crypto-bro neon-on-black** — neon green/pink sur black, fonts mono partout, "Web3-native".

**Inspirations dans la bonne lane** : Tailscale (sobre, technique, scrolling content-rich), 1Password (confiance par austérité, pas par fioritures), ProtonMail (design discret, message clair sur la souveraineté), Standard Notes (minimaliste assumé). Ton souhaité : artisan technique qui montre son travail, pas startup qui pitche.

## Design Principles

1. **Show, don't tell.** Captures d'écran réelles > mots vagues. La landing montre l'app, elle ne la décrit pas.
2. **Practice what you preach.** Si on vend la souveraineté + la sobriété technique, la landing elle-même doit être légère, accessible, sans tracker, sans fonts CDN tiers, sans dépendances JS marketing.
3. **Le code ESt la marque.** Architecture clean, E2EE, charts SVG custom — c'est ça qu'on vend. La landing peut citer le code, montrer un schéma technique, exposer le hash PBKDF2. Pas honte d'être technique : c'est l'argument.
4. **One CTA, hierarchy ruthless.** Démo live = primaire. Tout le reste descend d'un cran visuel. Pas de "choice paralysis".
5. **Cohérence app ↔ landing.** Tokens et fonts partagés (Inter + JetBrains Mono). La landing n'utilise pas une palette différente de l'app — l'utilisateur qui clique "Démo" ne doit pas avoir l'impression de changer de produit.

## Accessibility & Inclusion

- **WCAG AA** comme baseline non-négociable. AXE doit passer.
- **prefers-reduced-motion** respecté partout (animations / parallax désactivés).
- **prefers-color-scheme** : dark-first mais light mode propre obligatoire.
- **Contraste** : tester pour daltonisme (deutéranopie majoritaire) — éviter de coder l'info uniquement par couleur (rouge/vert pour budget +/-).
- **Clavier-first** : focus visibles sur tous les controls, ordre logique, pas de focus trap.
- **Touch targets** ≥ 44×44px sur la landing comme sur l'app (responsive mobile pour la landing même si l'app est desktop-first).
