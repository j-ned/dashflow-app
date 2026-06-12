# Dark Mode Tailwind v4 — Reference

## Defaut : media query (prefers-color-scheme)
```html
<div class="bg-white dark:bg-gray-900">
  <h3 class="text-gray-900 dark:text-white">Titre</h3>
  <p class="text-gray-500 dark:text-gray-400">Contenu</p>
</div>
```
Suit automatiquement les preferences systeme.

## Toggle manuel avec classe CSS
```css
/* styles.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

```html
<html class="dark">
  <body>
    <div class="bg-white dark:bg-black">...</div>
  </body>
</html>
```

## Toggle avec data attribute
```css
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

```html
<html data-theme="dark">
```

## JavaScript : toggle light/dark/system
```javascript
// Dans le <head> (eviter le FOUC)
document.documentElement.classList.toggle(
  'dark',
  localStorage.theme === 'dark' ||
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
);

// Setter le theme
localStorage.theme = 'light';    // forcer light
localStorage.theme = 'dark';     // forcer dark
localStorage.removeItem('theme'); // suivre le systeme
```
