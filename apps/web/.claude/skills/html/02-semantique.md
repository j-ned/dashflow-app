# HTML Semantique — Reference

## Structure de page
```html
<header>       <!-- en-tete de page ou de section -->
<nav>          <!-- navigation principale -->
<main>         <!-- contenu principal (1 seul par page) -->
<section>      <!-- section thematique avec un titre -->
<article>      <!-- contenu autonome (article, post, commentaire) -->
<aside>        <!-- contenu lateral (sidebar, encart) -->
<footer>       <!-- pied de page ou de section -->
```

## Exemple de page semantique
```html
<body>
  <header>
    <nav aria-label="Navigation principale">
      <ul>
        <li><a href="/">Accueil</a></li>
        <li><a href="/about">A propos</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <article>
      <header>
        <h1>Titre de l'article</h1>
        <time datetime="2025-03-19">19 mars 2025</time>
      </header>
      <p>Contenu...</p>
      <footer>
        <p>Ecrit par <address>John Doe</address></p>
      </footer>
    </article>

    <aside>
      <h2>Articles connexes</h2>
      <ul>...</ul>
    </aside>
  </main>

  <footer>
    <p>&copy; 2025 Mon site</p>
  </footer>
</body>
```

## Titres (hierarchie)
```html
<h1>Titre principal (1 seul par page)</h1>
<h2>Sous-titre</h2>
<h3>Sous-sous-titre</h3>
<!-- h1 → h6, ne pas sauter de niveaux -->
```

## Groupement de contenu
```html
<p>         <!-- paragraphe -->
<blockquote> <!-- citation longue -->
<figure>    <!-- illustration avec legende -->
  <img src="photo.jpg" alt="Description">
  <figcaption>Legende de l'image</figcaption>
</figure>
<details>   <!-- contenu pliable -->
  <summary>Cliquer pour voir</summary>
  <p>Contenu cache...</p>
</details>
<dialog>    <!-- modale native -->
<hr>        <!-- separation thematique -->
<pre>       <!-- texte preformate -->
<code>      <!-- code inline -->
```

## Listes
```html
<ul>        <!-- liste non ordonnee -->
<ol>        <!-- liste ordonnee -->
<li>        <!-- element de liste -->
<dl>        <!-- liste de definitions -->
  <dt>Terme</dt>
  <dd>Definition</dd>
</dl>
```

## Texte inline
```html
<strong>    <!-- importance forte (gras) -->
<em>        <!-- emphase (italique) -->
<mark>      <!-- surbrillance -->
<small>     <!-- petits caracteres (mentions legales) -->
<del>       <!-- texte supprime -->
<ins>       <!-- texte insere -->
<sub>       <!-- indice -->
<sup>       <!-- exposant -->
<abbr title="HyperText Markup Language">HTML</abbr>
<time datetime="2025-03-19">19 mars 2025</time>
<kbd>       <!-- touche clavier -->
<var>       <!-- variable -->
<samp>      <!-- sortie programme -->
```
