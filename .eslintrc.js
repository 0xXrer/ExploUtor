module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'semi': ['error', 'always'],
    'curly': ['error', 'all'],
    'eqeqeq': ['error', 'always'],
    'no-throw-literal': 'warn'
  },
  ignorePatterns: ['dist', 'node_modules', '*.js']
};
