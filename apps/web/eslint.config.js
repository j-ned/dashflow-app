// @ts-check
const eslint = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier/flat');

// Préréglage AAK (ESM) chargé via import() dynamique : ce fichier est en
// CommonJS, un require() synchrone d'un .mjs est impossible. ESLint 9 accepte
// une config exportée sous forme de Promise.
module.exports = (async () => {
  const aak = (await import('./.claude/eslint/aak-conventions.mjs')).default;
  return defineConfig([
    globalIgnores(['dist/**', 'coverage/**', '.angular/**', 'out-tsc/**']),
    {
      files: ['**/*.ts'],
      extends: [
        eslint.configs.recommended,
        tseslint.configs.recommended,
        tseslint.configs.stylistic,
        angular.configs.tsRecommended,
      ],
      processor: angular.processInlineTemplates,
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: __dirname,
        },
      },
      rules: {
        '@angular-eslint/directive-selector': [
          'error',
          { type: 'attribute', prefix: 'app', style: 'camelCase' },
        ],
        '@angular-eslint/component-selector': [
          'error',
          { type: 'element', prefix: 'app', style: 'kebab-case' },
        ],

        // Conventions maison : modèles en `type`, tableaux en `T[]`
        '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
        '@typescript-eslint/array-type': ['error', { default: 'array' }],

        // `_`-prefixe = intentionnellement inutilisé ; catch best-effort autorisé vide
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
        'no-empty': ['error', { allowEmptyCatch: true }],

        // Conventions Angular 2025 (cf. CLAUDE.md / project-profile)
        '@angular-eslint/prefer-on-push-component-change-detection': 'error',
        '@angular-eslint/prefer-inject': 'error',
        '@angular-eslint/use-lifecycle-interface': 'error',
        '@angular-eslint/no-uncalled-signals': 'error',
        '@angular-eslint/prefer-signals': 'warn',
      },
    },
    {
      files: ['**/*.html'],
      extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
      rules: {
        '@angular-eslint/template/prefer-control-flow': 'error',
        '@angular-eslint/template/prefer-self-closing-tags': 'error',
        '@angular-eslint/template/prefer-ngsrc': 'error',
        '@angular-eslint/template/button-has-type': 'error',
      },
    },
    prettier,
    ...aak,
  ]);
})();
