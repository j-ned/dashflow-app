# Media HTML — Reference

## Images
```html
<!-- Image basique -->
<img src="photo.jpg" alt="Description de l'image" width="800" height="600" loading="lazy">

<!-- Image responsive (srcset) -->
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
  alt="Description"
  loading="lazy"
  decoding="async"
>

<!-- Picture (format/media differents) -->
<picture>
  <source media="(max-width: 600px)" srcset="photo-mobile.webp" type="image/webp">
  <source media="(max-width: 600px)" srcset="photo-mobile.jpg">
  <source srcset="photo-desktop.webp" type="image/webp">
  <img src="photo-desktop.jpg" alt="Description">
</picture>

<!-- Figure avec legende -->
<figure>
  <img src="photo.jpg" alt="Description">
  <figcaption>Legende de la photo</figcaption>
</figure>
```

## Attributs importants des images
```
alt=""          — texte alternatif (obligatoire, vide si decoratif)
loading="lazy"  — chargement paresseux (hors viewport)
loading="eager" — chargement immediat (defaut)
decoding="async" — decodage asynchrone
width/height    — evite le layout shift (CLS)
fetchpriority="high" — priorite de chargement (LCP)
```

## Video
```html
<video controls width="640" height="360" poster="poster.jpg" preload="metadata">
  <source src="video.mp4" type="video/mp4">
  <source src="video.webm" type="video/webm">
  <track kind="subtitles" src="subs-fr.vtt" srclang="fr" label="Francais" default>
  <p>Votre navigateur ne supporte pas la video.</p>
</video>
```

## Audio
```html
<audio controls preload="metadata">
  <source src="audio.mp3" type="audio/mpeg">
  <source src="audio.ogg" type="audio/ogg">
  <p>Votre navigateur ne supporte pas l'audio.</p>
</audio>
```

## Iframe
```html
<iframe
  src="https://example.com"
  width="600"
  height="400"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
  allow="accelerometer; camera; microphone"
  title="Description du contenu"
></iframe>
```

## SVG inline
```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
</svg>
```

## Canvas
```html
<canvas id="myCanvas" width="400" height="300">
  Fallback text si canvas non supporte
</canvas>
```
