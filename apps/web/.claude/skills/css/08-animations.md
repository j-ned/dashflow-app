# Animations et Transitions CSS — Reference

## Transitions
```css
transition: all 0.3s ease;
transition: background-color 0.3s ease, transform 0.2s ease-out;
transition-property: transform, opacity;
transition-duration: 0.3s;
transition-timing-function: ease | ease-in | ease-out | ease-in-out | linear | cubic-bezier(0.4, 0, 0.2, 1);
transition-delay: 0.1s;
transition-behavior: allow-discrete;  /* animer display/visibility */
```

## @keyframes
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

## Animation
```css
animation: fadeIn 0.3s ease-out;
animation-name: fadeIn;
animation-duration: 0.3s;
animation-timing-function: ease-out;
animation-delay: 0s;
animation-iteration-count: 1 | infinite;
animation-direction: normal | reverse | alternate | alternate-reverse;
animation-fill-mode: none | forwards | backwards | both;
animation-play-state: running | paused;
```

## Transform
```css
transform: translateX(50px);
transform: translateY(-20px);
transform: translate(50px, -20px);
transform: scale(1.5);
transform: scale(1.2, 0.8);
transform: rotate(45deg);
transform: skew(10deg, 5deg);

/* Proprietes individuelles (CSS moderne — preferer) */
translate: 50px -20px;
scale: 1.5;
rotate: 45deg;

transform-origin: center;  /* point de reference */
```

## @starting-style (animer l'apparition)
```css
dialog[open] {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.3s, transform 0.3s;
}

@starting-style {
  dialog[open] {
    opacity: 0;
    transform: scale(0.95);
  }
}
```

## Prefer reduced motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Scroll animations (CSS moderne)
```css
.element {
  animation: fadeIn linear;
  animation-timeline: view();    /* lie au scroll du viewport */
  animation-range: entry 0% entry 100%;
}
```
