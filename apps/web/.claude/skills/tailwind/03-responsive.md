# Responsive Design Tailwind v4 — Reference

## Approche mobile-first
Les classes sans prefixe s'appliquent a TOUTES les tailles.
Les prefixes s'appliquent a partir de ce breakpoint et au-dessus.

```html
<!-- 1 col mobile, 2 cols tablette, 4 cols desktop -->
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
```

## Breakpoints par defaut
| Prefixe | Min width | Pixels |
|---------|-----------|--------|
| sm: | 40rem | 640px |
| md: | 48rem | 768px |
| lg: | 64rem | 1024px |
| xl: | 80rem | 1280px |
| 2xl: | 96rem | 1536px |

## Max-width (en dessous du breakpoint)
| Variante | Signification |
|----------|---------------|
| max-sm: | < 640px |
| max-md: | < 768px |
| max-lg: | < 1024px |

## Range (entre deux breakpoints)
```html
<!-- Seulement entre md et lg -->
<div class="md:max-lg:flex">
```

## Breakpoints custom
```css
@theme {
  --breakpoint-xs: 30rem;
  --breakpoint-3xl: 120rem;
}
```

## Valeurs arbitraires
```html
<div class="min-[320px]:text-center max-[600px]:bg-sky-300">
```

## Container queries (@container)
```html
<!-- Marquer le conteneur -->
<div class="@container">
  <!-- Reagir a la taille du conteneur (pas du viewport) -->
  <div class="flex flex-col @md:flex-row">
</div>
```

### Tailles container
| Variante | Min width |
|----------|-----------|
| @3xs: | 16rem (256px) |
| @2xs: | 18rem (288px) |
| @xs: | 20rem (320px) |
| @sm: | 24rem (384px) |
| @md: | 28rem (448px) |
| @lg: | 32rem (512px) |
| @xl: | 36rem (576px) |

### Container nomme
```html
<div class="@container/sidebar">
  <div class="@md/sidebar:flex-row">
```
