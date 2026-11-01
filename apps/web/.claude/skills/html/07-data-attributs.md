# Data Attributes et Attributs globaux HTML — Reference

## Data attributes
```html
<!-- Stocker des donnees custom -->
<div data-user-id="42" data-role="admin" data-active="true">

<!-- Acces en JavaScript -->
<script>
  const el = document.querySelector('[data-user-id]');
  el.dataset.userId;     // "42" (camelCase)
  el.dataset.role;       // "admin"
  el.dataset.active;     // "true"
</script>

<!-- Acces en CSS -->
<style>
  [data-role="admin"] { color: red; }
  [data-active] { opacity: 1; }
</style>

<!-- Usage Tailwind (EAK) -->
<div data-active class="data-active:border-blue-500">
<div datatest-id="user-card">  <!-- selecteur de test -->
```

## Attributs globaux
```html
id="unique-id"          <!-- identifiant unique -->
class="my-class"        <!-- classes CSS -->
style="color: red"      <!-- styles inline (eviter) -->
title="Info bulle"      <!-- tooltip -->
hidden                  <!-- cache l'element -->
draggable="true"        <!-- element deplacable -->
contenteditable="true"  <!-- contenu editable -->
spellcheck="true"       <!-- verification orthographique -->
translate="no"          <!-- ne pas traduire -->
autofocus               <!-- focus automatique au chargement -->
tabindex="0"            <!-- ordre de tabulation -->
lang="fr"               <!-- langue -->
dir="ltr"               <!-- direction du texte -->
slot="name"             <!-- slot pour Web Components -->
is="custom-element"     <!-- extension d'element -->
inert                   <!-- element non interactif (nouveau) -->
popover                 <!-- element popover natif (nouveau) -->
```

## Popover API (natif)
```html
<button popovertarget="my-popover">Ouvrir</button>
<div id="my-popover" popover>
  Contenu du popover
</div>

<!-- Popover manuel (pas de fermeture auto) -->
<div id="menu" popover="manual">Menu</div>
```

## Dialog natif
```html
<dialog id="myDialog">
  <form method="dialog">
    <p>Contenu de la modale</p>
    <button value="ok">OK</button>
    <button value="cancel">Annuler</button>
  </form>
</dialog>

<script>
  document.getElementById('myDialog').showModal();  // modale
  document.getElementById('myDialog').show();       // non-modale
  document.getElementById('myDialog').close();      // fermer
</script>
```
