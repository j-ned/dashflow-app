# Accessibilite HTML (a11y) — Reference

## Principes fondamentaux
- Utiliser le HTML semantique en priorite (pas de div/span pour tout)
- Chaque image non decorative a un alt descriptif
- Chaque formulaire a des labels associes
- La navigation au clavier fonctionne (Tab, Entree, Echap)
- Le contraste de couleurs est suffisant (WCAG AA : ratio 4.5:1)

## ARIA (Accessible Rich Internet Applications)
```html
<!-- Roles -->
<div role="alert">Message d'erreur</div>
<div role="status">Mise a jour reussie</div>
<nav role="navigation" aria-label="Navigation principale">
<div role="tablist">
<button role="tab" aria-selected="true">Onglet 1</button>
<div role="tabpanel">Contenu</div>
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">

<!-- Etats -->
aria-hidden="true"          <!-- cache aux lecteurs d'ecran -->
aria-disabled="true"        <!-- desactive (semantique) -->
aria-expanded="false"       <!-- pliable -->
aria-pressed="true"         <!-- toggle button -->
aria-checked="true"         <!-- case cochee -->
aria-current="page"         <!-- page actuelle dans la nav -->
aria-selected="true"        <!-- element selectionne -->
aria-busy="true"            <!-- en cours de chargement -->
aria-invalid="true"         <!-- champ invalide -->

<!-- Labels -->
aria-label="Fermer"         <!-- label invisible (bouton icone) -->
aria-labelledby="title-id"  <!-- reference un element comme label -->
aria-describedby="help-id"  <!-- reference une description -->

<!-- Live regions -->
aria-live="polite"          <!-- annonce les changements (non urgent) -->
aria-live="assertive"       <!-- annonce immediatement (urgent) -->
aria-atomic="true"          <!-- lire tout le contenu, pas juste le changement -->
```

## Patterns courants

### Bouton icone accessible
```html
<button type="button" aria-label="Fermer le menu">
  <svg aria-hidden="true">...</svg>
</button>
```

### Skip link
```html
<a href="#main" class="sr-only focus:not-sr-only">
  Aller au contenu principal
</a>
```

### Image decorative
```html
<img src="decoration.svg" alt="" role="presentation">
```

### Formulaire accessible
```html
<div>
  <label for="email">Email <span aria-hidden="true">*</span></label>
  <input type="email" id="email" name="email" required
         aria-required="true" aria-describedby="email-help email-error">
  <p id="email-help">Nous ne partagerons jamais votre email.</p>
  <p id="email-error" role="alert" aria-live="polite" hidden>
    Veuillez entrer un email valide.
  </p>
</div>
```

### Menu de navigation
```html
<nav aria-label="Navigation principale">
  <ul role="list">
    <li><a href="/" aria-current="page">Accueil</a></li>
    <li><a href="/about">A propos</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>
```

### Modale accessible
```html
<dialog id="modal" aria-labelledby="modal-title" aria-modal="true">
  <h2 id="modal-title">Confirmer la suppression</h2>
  <p>Cette action est irreversible.</p>
  <button type="button" autofocus>Confirmer</button>
  <button type="button" onclick="modal.close()">Annuler</button>
</dialog>
```

## tabindex
```html
tabindex="0"    <!-- rend focusable dans l'ordre naturel -->
tabindex="-1"   <!-- focusable par JS uniquement (pas Tab) -->
<!-- EVITER tabindex > 0 — casse l'ordre naturel -->
```

## Attributs lang et dir
```html
<html lang="fr">
<html lang="fr" dir="ltr">
<span lang="en">Hello world</span>
<div dir="rtl">Texte arabe</div>
```
