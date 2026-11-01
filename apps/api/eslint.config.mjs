// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
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
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Couche métier (services, repositories, mailers, stockage, utilitaires) : sans framework,
    // pour être recâblée telle quelle sous un autre serveur HTTP. Nest reste confiné à la
    // couche HTTP et au câblage, listés ci-dessous.
    files: ['src/**/*.ts'],
    ignores: [
      'src/main.ts',
      'src/instrument.ts',
      '**/*.spec.ts',
      '**/*.module.ts',
      '**/*.controller.ts',
      '**/*.interceptor.ts',
      '**/*.decorator.ts',
      'src/common/guards/**',
      'src/common/pipes/**',
      'src/common/filters/**',
      'src/common/decorators/**',
      'src/common/nest/**',
      'src/common/logger.ts',
      'src/auth/http-error.ts',
      'src/health/**',
      'src/scheduler/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*'],
              message:
                'Couche métier sans framework : passer par common/errors, common/logger ou un jeton injecté.',
            },
          ],
        },
      ],
    },
  },
  {
    // Les tests utilisent des mocks partiels et des fixtures non typés (Drizzle,
    // services, requêtes HTTP) : les règles `no-unsafe-*` type-aware y produisent
    // du bruit légitime. On les neutralise UNIQUEMENT dans les fichiers de test.
    // Les vraies erreurs (no-unused-vars, require-await) restent actives partout.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
