# Design

> Système de design DashFlow — extrait de `src/styles.css` et de l'app actuelle.
> Les tokens listés ici sont la **source unique de vérité**. Ne pas hard-coder de couleur, font ou radius hors de ce système.

## Visual Theme

**Dark-first**, light mode propre obligatoire. Bascule via attribut `[data-theme="light"]` sur `html`/`body`.

Le ton visuel est **éditorial-technique** : densité maîtrisée, hiérarchie typographique forte, neutres tintés, **un seul accent** (ib-blue) qui porte l'identité. Les autres accents (`green`, `purple`, `cyan`, etc.) sont des **signaux sémantiques** (sections, statuts) — jamais décoratifs, jamais en gradient.

**Principes :**
- Neutres tintés (chroma faible vers le hue brand) — jamais `#000` ni `#fff` purs
- Ratios contrastes ≥ 4.5:1 vérifiés sur tous les textes (cf. audit dans `styles.css`)
- Pas de glassmorphism décoratif, pas de gradient text, pas de glow blur
- Pas de hover-lift / scale décoratifs — les transitions sont fonctionnelles (color, border, opacity)

## Color Palette

### Surfaces

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--color-canvas` | `#16171a` | `#f4f4f6` | Fond global de l'app |
| `--color-surface` | `#1c1d21` | `#ffffff` | Cartes, sections élevées |
| `--color-raised` | `#24262a` | `#ebebef` | Sur surface (modales, inputs) |
| `--color-elevated` | `#24262a` | `#ebebef` | Identique à raised |
| `--color-hover` | `#2e3035` | `#e2e2e7` | État hover sur surface |
| `--color-border` | `#383b41` | `#c5c5cc` | Borders 1px, séparateurs |

Tailwind classes : `bg-canvas`, `bg-surface`, `bg-raised`, `bg-elevated`, `bg-hover`, `border-border`.

### Texte

| Token | Dark | Light | Contraste sur canvas |
|-------|------|-------|-----------------------|
| `--color-text-primary` | `#c8cad0` | `#1a1a1e` | 10.4:1 (dark) · 14.9:1 (light) |
| `--color-text-muted` | `#8b8f96` | `#5e5e63` | 5.3:1 (dark) · 5.6:1 (light) |

Tailwind classes : `text-text-primary`, `text-text-muted`.

### Accents (signaux sémantiques)

Tous vérifiés ≥ 4.5:1 sur canvas dans les deux thèmes.

| Token | Dark | Light | Sémantique |
|-------|------|-------|------------|
| `--color-ib-blue` | `#5eadf7` | `#2b64b9` | **Accent primaire**, CTA, focus, liens, identité |
| `--color-ib-cyan` | `#34b8c5` | `#16707a` | Info, sections "stack/code" |
| `--color-ib-green` | `#73b67d` | `#357a40` | Section budget, succès, positif |
| `--color-ib-orange` | `#d69a7a` | `#9e5a2e` | Avertissement |
| `--color-ib-red` | `#e5787f` | `#b53d48` | Erreur, négatif, validation form |
| `--color-ib-purple` | `#a78bba` | `#6f4d8e` | Section médical |
| `--color-ib-yellow` | `#e8c882` | `#7d6400` | Attention, alerte stock |
| `--color-ib-pink` | `#cf8ac5` | `#8e4683` | (Réservé, peu utilisé) |

**Règle d'usage** :
- **Restrained** — un seul accent par surface, ≤10% de l'écran. Défaut produit + landing.
- Les accents sectionnels (vert budget / violet médical) sont **réservés aux badges et indicateurs** — pas de gradient, pas de glow, pas de shadow coloré décoratif.
- Les `hover:ring-ib-*/50` ou `bg-ib-*/10` sont autorisés pour les états interactifs ciblés.

### Variantes d'opacité nommées

Pour les contextes où Angular ne peut pas porter une slash dans une class-binding (ex: `[class.bg-ib-red/10]` n'est pas un nom de classe valide en binding), des **tokens nommés** sont disponibles :

```
bg-ib-{color}-{N} / text-ib-{color}-{N} / border-ib-{color}-{N} / ring-ib-{color}-{N} / shadow-ib-{color}-{N}
```

- `{color}` ∈ blue, cyan, green, orange, red, purple, yellow, pink
- `{N}` ∈ 5, 10, 15, 20, 30, 40, 50

Plus :
- `text-text-muted-30`, `text-text-muted-50`
- `border-border-30`, `border-border-50`

**Convention** : utiliser `bg-ib-red/10` (slash) dans le code statique, et `bg-ib-red-10` (named) dans les `[class.X]` bindings. Les deux résolvent vers la même couleur (`color-mix(in srgb, var(--color-ib-red) 10%, transparent)`).

### Color strategy par registre

- **Product (app)** : Restrained — neutres dominants + ib-blue pour interactif + accent sectionnel par feature
- **Brand (landing)** : Restrained renforcé — un seul accent (ib-blue) pour les CTA et le focus, les autres accents en **monochrome** sur les badges sectionnels

## Typography

### Familles

| Token | Stack | Usage |
|-------|-------|-------|
| `--font-sans` | `'Inter Variable', system-ui, sans-serif` | Texte général, headings, UI |
| `--font-mono` | `'JetBrains Mono Variable', monospace` | Code, données tabulaires, eyebrows techniques, vocabulaire crypto |

Auto-hébergées via `@fontsource-variable/*` — pas de CDN tiers, cohérent avec le principe "practice what you preach".

### Échelle

Utiliser les classes Tailwind par défaut. Pour la landing, échelle resserrée :

| Niveau | Tailwind | Taille | Poids | Usage |
|--------|----------|--------|-------|-------|
| Display H1 | `text-4xl sm:text-5xl lg:text-[3.5rem]` | 36–56px | `font-semibold` | Hero unique |
| H2 section | `text-3xl sm:text-4xl` | 30–36px | `font-semibold` | Titre de section |
| H3 sub | `text-xl` ou `text-2xl` | 20–24px | `font-semibold` | Feature interne |
| Body large | `text-lg` | 18px | regular | Sub-titres, intro |
| Body | `text-base` | 16px | regular | Corps |
| Small | `text-sm` | 14px | regular | Footer, meta |
| Eyebrow | `font-mono text-xs uppercase tracking-[0.18em]` | 12px | regular | Catégorisation |

**Règles** :
- `tracking-tight` sur les headings, `tracking-[0.18em]` sur les eyebrows mono uppercase
- Line-height : `leading-[1.1]` pour H1 hero, `leading-relaxed` pour body
- Largeur de texte cap à `max-w-3xl` ou `max-w-xl` pour le body (60–75ch)
- Hiérarchie par **scale + weight** — jamais par couleur (sauf accent ponctuel)

### Bans

- ❌ **Gradient text** (`bg-clip-text text-transparent`) — interdit absolu
- ❌ **Web fonts CDN tierces** (Google Fonts, Adobe Fonts en runtime) — interdit
- ❌ **Plus de 2 familles** — seulement Inter + JetBrains Mono

## Spacing & Radius

### Radius

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-sm` | `6px` | Inputs, micro-controls |
| `--radius-md` | `8px` | Boutons, badges, cards |
| `--radius-lg` | `12px` | Modales, conteneurs principaux |

Tailwind : `rounded-sm`, `rounded-md`, `rounded-lg`. **Pas de `rounded-xl`/`rounded-2xl`/`rounded-3xl`** sur la landing — le langage formel utilise des coins serrés.

> ⚠️ Le composant landing actuel utilisait `rounded-3xl` sur les cards, supprimé dans la refonte.

### Spacing

Utiliser l'échelle Tailwind par défaut (`gap-4`, `py-24`, etc.). Conventions :
- Sections de page : `py-24 lg:py-32`
- Container max : `max-w-6xl` (1152px)
- Padding latéral container : `px-6`
- Gap inter-feature dans une section : `gap-12 lg:gap-16`

## Components

### Boutons

**Primary** (CTA principal, ib-blue) :
```html
<a class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-6 py-3
          text-base font-semibold text-canvas
          transition-colors hover:bg-ib-blue/90
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue
          focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
```

**Secondary** (outline, neutre) :
```html
<a class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border
          px-6 py-3 text-base font-medium text-text-primary
          transition-colors hover:bg-surface
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue
          focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
```

**Touch target minimum** : `min-h-12` (48px) pour CTA, `min-h-11` (44px) pour les liens nav. Conformité WCAG 2.5.5.

### Inputs (forms)

Voir classes `.form-input`, `.form-select`, `.form-label`, `.btn-cancel`, `.btn-submit` dans `styles.css`. Border `--color-ib-blue` au focus, ring 2px à 25% d'opacité. Erreur Angular : `.ng-invalid.ng-touched` → border `ib-red`.

### Modal Dialog

`<dialog class="modal-dialog">` natif. Backdrop `rgba(0,0,0,0.6)`. Tailles `modal-sm/md/lg/xl`. Animation `modal-fade-in 200ms ease-out`. Pas de glassmorphism.

### Eyebrow / Badge

Section eyebrow standard sur la landing :
```html
<span class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-{green|purple|cyan}">
  <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-{green|purple|cyan}"></span>
  {Label}
</span>
```

Pas de `animate-ping` — le pulsing dot est un cliché SaaS.

### Code Blocks

Bloc `<pre>` mono :
```html
<pre class="overflow-x-auto rounded-lg border border-border bg-surface p-5
            font-mono text-[13px] leading-relaxed">
```

Highlight minimaliste :
- Base : `text-text-primary`
- Mots-clés : `text-ib-blue`
- Strings : `text-ib-green`
- Commentaires : `text-text-muted/70`

## Motion

### Règles

- **Durations** : 150–300ms. Pas plus.
- **Easing** : `ease` ou `ease-out` (équivalent ease-out-quart). Pas de bounce, pas d'elastic.
- **Propriétés transitionnées** : `color`, `background-color`, `border-color`, `opacity`, `box-shadow`. **Jamais `transition-all`**, jamais `width`/`height`/`padding`/`margin` directement.
- **Hover** : uniquement sur les éléments **interactifs** (boutons, liens). Pas de `hover:scale` ni `hover:translate` décoratif.
- **Animations infinies** : interdites en dehors d'indicateurs de chargement explicites.

### `prefers-reduced-motion`

Géré globalement dans `styles.css` :

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  html { scroll-behavior: auto !important; }
}
```

`scroll-behavior: smooth` global est fallback `auto` quand `prefers-reduced-motion: reduce`.

## Layout

### Container

- `max-w-6xl mx-auto px-6` pour les sections principales de la landing
- `max-w-3xl` pour le copy long (CTA centré, hero copy)
- Pas de container automatique — chaque section gère son `max-w-*`

### Grilles

- **Hero asymétrique** : `grid-cols-12 gap-12 lg:gap-16` avec splits 7/5
- **Section features** : `grid sm:grid-cols-3 gap-x-10 gap-y-8` sur `<dl>`/`<dt>`/`<dd>` (sémantique)
- **Pas de cards identiques** — les listes de features utilisent des `<dl>` épurés, pas une grille de cards

### Séparateurs

- `border-t border-border pt-10` pour séparer une intro d'une grille de features
- `border-y border-border` pour les bandes pleine largeur (proof band)
- Pas de séparateurs `border-l`/`border-r` épais (ban absolu impeccable)

## Accessibility

- **WCAG AA** baseline. AXE doit passer.
- Tous les liens externes : `target="_blank" rel="noopener noreferrer"` + icône `arrow-up-right` visuelle
- Skip-link `<a href="#main">` en début de page
- Focus visible : `focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`
- `aria-labelledby` sur chaque section pointant vers son heading
- `aria-hidden="true"` sur les décors purs (puces décoratives, séparateurs `·` typographiques)
- Touch targets ≥ 44px (`min-h-11` minimum, `min-h-12` pour CTA)
- Information jamais codée par couleur seule — toujours doublée par texte ou icône

## File Structure Conventions

- Composants single-file : template inline + styles inline (si nécessaire) + classe en dernier
- `host: { class: '...' }` pour les classes du host (jamais `@HostBinding`)
- `ChangeDetectionStrategy.OnPush` partout
- `inject()` pour les services, jamais `constructor` injection
- Standalone implicite (Angular 21+, ne jamais écrire `standalone: true`)

## Token Roadmap (gaps identifiés)

À ajouter si besoin futur :
- `--color-surface-subtle` solide (au lieu de `bg-surface/40` alpha)
- `--shadow-sm/md/lg` tokens si on a besoin de shadows non-colorées
- `--ring-focus` token unique (actuellement répété en classes Tailwind)
