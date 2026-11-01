# Structure HTML — Reference

## Document de base
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Description de la page">
  <title>Titre de la page</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header>...</header>
  <main>...</main>
  <footer>...</footer>
  <script src="/app.js" defer></script>
</body>
</html>
```

## Meta tags essentiels
```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Description pour le SEO (max 160 caracteres)">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#ffffff">

<!-- Open Graph (reseaux sociaux) -->
<meta property="og:title" content="Titre">
<meta property="og:description" content="Description">
<meta property="og:image" content="https://example.com/image.jpg">
<meta property="og:url" content="https://example.com">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Titre">
<meta name="twitter:description" content="Description">
<meta name="twitter:image" content="https://example.com/image.jpg">
```

## Chargement des ressources
```html
<!-- CSS — dans le <head> -->
<link rel="stylesheet" href="/styles.css">

<!-- JS — defer (execute apres le parsing HTML, dans l'ordre) -->
<script src="/app.js" defer></script>

<!-- JS — async (execute des que telecharge, pas d'ordre garanti) -->
<script src="/analytics.js" async></script>

<!-- JS — module -->
<script type="module" src="/app.js"></script>

<!-- Preload (charger en priorite) -->
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>

<!-- Prefetch (charger pour la prochaine navigation) -->
<link rel="prefetch" href="/next-page.html">

<!-- DNS prefetch -->
<link rel="dns-prefetch" href="//api.example.com">

<!-- Preconnect -->
<link rel="preconnect" href="https://fonts.googleapis.com">
```
