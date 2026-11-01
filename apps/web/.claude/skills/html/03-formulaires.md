# Formulaires HTML — Reference

## Structure de base
```html
<form action="/api/submit" method="POST" novalidate>
  <fieldset>
    <legend>Informations personnelles</legend>

    <label for="name">Nom</label>
    <input type="text" id="name" name="name" required minlength="2" maxlength="100"
           placeholder="Votre nom" autocomplete="name">

    <label for="email">Email</label>
    <input type="email" id="email" name="email" required
           placeholder="votre@email.com" autocomplete="email">

    <button type="submit">Envoyer</button>
  </fieldset>
</form>
```

## Types d'input
```html
<!-- Texte -->
<input type="text">          <!-- texte libre -->
<input type="email">         <!-- email (validation native) -->
<input type="password">      <!-- mot de passe (masque) -->
<input type="url">           <!-- URL -->
<input type="tel">           <!-- telephone (clavier mobile adapte) -->
<input type="search">        <!-- recherche -->

<!-- Nombres -->
<input type="number" min="0" max="100" step="1">
<input type="range" min="0" max="100" value="50">

<!-- Date / Heure -->
<input type="date">          <!-- YYYY-MM-DD -->
<input type="time">          <!-- HH:MM -->
<input type="datetime-local"> <!-- date + heure -->
<input type="month">         <!-- YYYY-MM -->
<input type="week">          <!-- YYYY-Wnn -->

<!-- Selection -->
<input type="checkbox">      <!-- case a cocher -->
<input type="radio" name="group"> <!-- bouton radio (meme name = groupe) -->
<input type="color">         <!-- selecteur de couleur -->

<!-- Fichiers -->
<input type="file" accept=".pdf,.jpg,.png" multiple>

<!-- Caches -->
<input type="hidden" name="csrf" value="token">
```

## Attributs de validation
```html
required                     <!-- obligatoire -->
minlength="3"               <!-- longueur min -->
maxlength="100"             <!-- longueur max -->
min="0"                     <!-- valeur min (number/date) -->
max="100"                   <!-- valeur max -->
step="0.01"                 <!-- increment -->
pattern="[A-Za-z]{3,}"     <!-- regex -->
placeholder="Indice"        <!-- texte d'indice -->
disabled                    <!-- desactive -->
readonly                    <!-- lecture seule -->
autofocus                   <!-- focus automatique -->
autocomplete="email"        <!-- autocompletion -->
```

## Elements de formulaire
```html
<!-- Textarea -->
<textarea name="message" rows="4" cols="50" maxlength="500"></textarea>

<!-- Select -->
<select name="country" required>
  <option value="">Choisir un pays</option>
  <option value="fr">France</option>
  <option value="be">Belgique</option>
  <optgroup label="Amerique">
    <option value="us">Etats-Unis</option>
    <option value="ca">Canada</option>
  </optgroup>
</select>

<!-- Select multiple -->
<select name="skills" multiple size="5">
  <option value="html">HTML</option>
  <option value="css">CSS</option>
  <option value="js">JavaScript</option>
</select>

<!-- Datalist (autocompletion libre) -->
<input type="text" list="browsers" name="browser">
<datalist id="browsers">
  <option value="Chrome">
  <option value="Firefox">
  <option value="Safari">
</datalist>

<!-- Output (resultat calcule) -->
<output name="result" for="a b">0</output>

<!-- Progress / Meter -->
<progress value="70" max="100">70%</progress>
<meter value="0.7" min="0" max="1" low="0.3" high="0.7" optimum="0.8">70%</meter>
```

## Boutons
```html
<button type="submit">Envoyer</button>   <!-- soumet le formulaire -->
<button type="reset">Reinitialiser</button> <!-- reset le formulaire -->
<button type="button">Action JS</button> <!-- pas de comportement par defaut -->
```

## Etats CSS des formulaires
```css
:valid        /* champ valide */
:invalid      /* champ invalide */
:required     /* champ requis */
:optional     /* champ optionnel */
:focus        /* champ avec focus */
:disabled     /* champ desactive */
:read-only    /* champ en lecture seule */
:placeholder-shown /* placeholder visible */
:checked      /* checkbox/radio coche */
:indeterminate /* checkbox indetermine */
```
