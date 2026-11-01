# PrimeNG — Installation & Configuration

## Installation

```bash
pnpm add primeng @primeuix/themes primeicons primeflex
```

## app.config.ts minimal

```typescript
import { ApplicationConfig } from "@angular/core";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { providePrimeNG } from "primeng/config";
import Aura from "@primeuix/themes/aura";

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: { preset: Aura },
      ripple: true,
    }),
  ],
};
```

> **Zoneless** : compatible avec `provideZonelessChangeDetection()` — ajouter avant `provideAnimationsAsync()`.

## Presets disponibles

| Preset     | Style                               |
| ---------- | ----------------------------------- |
| `Aura`     | Vision PrimeTek (défaut recommandé) |
| `Material` | Google Material Design v2           |
| `Lara`     | Basé Bootstrap                      |
| `Nora`     | Applications enterprise             |

```typescript
import Aura from "@primeuix/themes/aura";
import Lara from "@primeuix/themes/lara";
import Material from "@primeuix/themes/material";
import Nora from "@primeuix/themes/nora";
```

## Options providePrimeNG

```typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      prefix: "p", // CSS vars : var(--p-primary-color)
      darkModeSelector: ".my-app-dark", // défaut : 'system' (prefers-color-scheme)
      // darkModeSelector: false,        // désactiver le dark mode
      cssLayer: {
        name: "primeng",
        order: "app-styles, primeng, another-css-library",
      },
    },
  },
  ripple: true,
});
```

## styles.scss — imports requis

```scss
@import "primeicons/primeicons.css";
// PrimeFlex (optionnel — voir skill primeflex)
@import "primeflex/primeflex.css";
```

## Dark mode toggle

```typescript
toggleDarkMode(): void {
  document.querySelector('html')!.classList.toggle('my-app-dark');
}
```

## Services globaux — fournir dans app.config.ts

```typescript
import { MessageService, ConfirmationService } from "primeng/api";

providers: [
  // ...providers PrimeNG...
  MessageService,
  ConfirmationService,
];
```

## Convention d'import composants

```typescript
// Dans le @Component.imports[] — importer le module ou la classe standalone
import { ButtonModule } from "primeng/button";
import { ButtonGroupModule } from "primeng/buttongroup";
import { InputTextModule } from "primeng/inputtext";
import { FloatLabelModule } from "primeng/floatlabel";
import { TextareaModule } from "primeng/textarea";
import { SelectModule } from "primeng/select";
import { MultiSelectModule } from "primeng/multiselect";
import { CheckboxModule } from "primeng/checkbox";
import { RadioButtonModule } from "primeng/radiobutton";
import { AutoCompleteModule } from "primeng/autocomplete";
import { DatePickerModule } from "primeng/datepicker";
import { FileUploadModule } from "primeng/fileupload";
import { TableModule } from "primeng/table";
import { PaginatorModule } from "primeng/paginator";
import { DialogModule } from "primeng/dialog";
import { ToastModule } from "primeng/toast";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { MessageModule } from "primeng/message";
import { TagModule } from "primeng/tag";
import { BadgeModule } from "primeng/badge";
import { ChipModule } from "primeng/chip";
import { SkeletonModule } from "primeng/skeleton";
import { ProgressBarModule } from "primeng/progressbar";
import { IconFieldModule } from "primeng/iconfield";
import { InputIconModule } from "primeng/inputicon";
```

## Gotchas installation

- `provideAnimationsAsync()` est **obligatoire** — sans lui, les overlays (Dialog, Toast) ne s'animent pas.
- `primeicons` doit être importé dans les styles globaux, pas dans les composants.
- Depuis v18 : `Calendar` → `DatePicker`, `InputTextarea` → `Textarea` (anciens modules supprimés).
- Depuis v19 : composants standalone disponibles en import direct (ex: `import { Button } from 'primeng/button'`).
