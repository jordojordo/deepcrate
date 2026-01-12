import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginVitest from '@vitest/eslint-plugin';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pluginCypress from 'eslint-plugin-cypress';
import pluginOxlint from 'eslint-plugin-oxlint';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfigWithVueTs(
  {
    name:  'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  {
    ...pluginCypress.configs.recommended,
    files: [
      'cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}',
      'cypress/support/**/*.{js,ts,jsx,tsx}'
    ],
  },
  ...pluginOxlint.configs['flat/recommended'],
  skipFormatting,

  {
    plugins: { '@stylistic': stylistic },
    rules:   {
      'no-explicit-any':                    'off',
      '@typescript-eslint/no-implicit-any': 'off',

      '@stylistic/indent':                ['warn', 2],
      '@stylistic/quotes':                ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: 'always' }],
      '@stylistic/semi':                  ['warn', 'always'],
      '@stylistic/comma-dangle':          ['warn', 'only-multiline'],
      '@stylistic/key-spacing':           ['warn', {
        align:     {
          beforeColon: false, afterColon: true, on: 'value', mode: 'minimum'
        },
        multiLine: { beforeColon: false, afterColon: true },
      }],
      '@stylistic/object-curly-spacing': ['warn', 'always'],
      '@stylistic/object-curly-newline': ['warn', {
        ObjectExpression:  { multiline: true, minProperties: 3 },
        ObjectPattern:     { multiline: true, minProperties: 4 },
        ImportDeclaration: { multiline: true, minProperties: 5 },
        ExportDeclaration: { multiline: true, minProperties: 3 },
      }],
      '@stylistic/arrow-spacing':                   ['warn', { before: true, after: true }],
      '@stylistic/brace-style':                     ['warn', '1tbs'],
      '@stylistic/block-spacing':                   ['warn', 'always'],
      '@stylistic/space-in-parens':                 ['warn', 'never'],
      '@stylistic/newline-per-chained-call':        ['warn', { ignoreChainWithDepth: 4 }],
      '@stylistic/multiline-ternary':               ['warn', 'never'],
      '@stylistic/padded-blocks':                   ['warn', 'never'],
      '@stylistic/padding-line-between-statements': ['warn',
        {
          blankLine: 'always', prev: '*', next: 'return'
        },
        {
          blankLine: 'always', prev: 'function', next: 'function'
        },
        // keep the “blank line after a declaration block, but not between consecutive declarations” pattern
        {
          blankLine: 'always', prev: ['const', 'let', 'var'], next: '*'
        },
        {
          blankLine: 'any',    prev: ['const', 'let', 'var'], next: ['const', 'let', 'var']
        },
      ],
      '@stylistic/template-curly-spacing':      ['warn', 'always'],
      '@stylistic/space-unary-ops':             ['warn', { words: true, nonwords: false }],
      '@stylistic/yield-star-spacing':          ['warn', 'both'],
      '@stylistic/lines-between-class-members': ['warn', 'always', { exceptAfterSingleLine: true }],
      '@stylistic/space-before-function-paren': ['warn', 'never'],
      '@stylistic/member-delimiter-style':      ['warn', {
        multiline:  { delimiter: 'semi', requireLast: true },
        singleline: { delimiter: 'semi', requireLast: false },
      }],

      'no-cond-assign': ['warn', 'except-parens'],
    },
  },
);
