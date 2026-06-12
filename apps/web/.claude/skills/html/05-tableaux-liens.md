# Tableaux et Liens HTML — Reference

## Tableau accessible
```html
<table>
  <caption>Liste des utilisateurs</caption>
  <thead>
    <tr>
      <th scope="col">Nom</th>
      <th scope="col">Email</th>
      <th scope="col">Role</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>John Doe</td>
      <td>john@example.com</td>
      <td>Admin</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td colspan="3">Total : 1 utilisateur</td>
    </tr>
  </tfoot>
</table>
```

## Attributs de tableau
```html
<th scope="col">     <!-- en-tete de colonne -->
<th scope="row">     <!-- en-tete de ligne -->
<td colspan="2">     <!-- fusionner 2 colonnes -->
<td rowspan="3">     <!-- fusionner 3 lignes -->
<colgroup>           <!-- grouper les colonnes pour le style -->
  <col span="2" style="background: #f0f0f0">
</colgroup>
```

## Liens
```html
<!-- Lien basique -->
<a href="/page">Texte du lien</a>

<!-- Lien externe (nouvel onglet) -->
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  Site externe
</a>

<!-- Lien ancre -->
<a href="#section-id">Aller a la section</a>
<section id="section-id">...</section>

<!-- Lien email -->
<a href="mailto:contact@example.com">Envoyer un email</a>

<!-- Lien telephone -->
<a href="tel:+33612345678">Appeler</a>

<!-- Lien de telechargement -->
<a href="/fichier.pdf" download="document.pdf">Telecharger le PDF</a>

<!-- Lien skip to content (accessibilite) -->
<a href="#main" class="sr-only focus:not-sr-only">Aller au contenu principal</a>
```

## Attributs de lien
```html
href="url"                   <!-- destination -->
target="_blank"              <!-- nouvel onglet -->
target="_self"               <!-- meme onglet (defaut) -->
rel="noopener noreferrer"   <!-- securite pour _blank -->
rel="nofollow"              <!-- ne pas suivre (SEO) -->
rel="external"              <!-- lien externe -->
download="filename.pdf"     <!-- forcer le telechargement -->
hreflang="en"               <!-- langue de la destination -->
type="application/pdf"      <!-- type MIME -->
```
