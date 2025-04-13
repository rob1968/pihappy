// frontend/i18next-parser.config.js
module.exports = {
  contextSeparator: '_',
  createOldCatalogs: false,
  defaultNamespace: 'translation',
  defaultValue: '', // Set to empty string, will be populated by parser
  indentation: 2,
  keepRemoved: false,
  keySeparator: '.', // Default separator
  // Configure lexers for different file types
  lexers: {
    js: ['JavascriptLexer'],
    jsx: ['JsxLexer'],
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
    default: ['JavascriptLexer'],
  },
  lineEnding: 'auto',
  // List all your supported languages
  locales: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'ru', 'pt', 'ur', 'id', 'de', 'ja', 'sw', 'pa', 'nl'],
  namespaceSeparator: ':', // Default separator
  // Path where translation files will be generated/updated
  output: 'public/locales/$LOCALE/$NAMESPACE.json',
  // Glob patterns for source files to scan
  input: ['src/**/*.{js,jsx,ts,tsx}'],
  sort: true, // Sort keys alphabetically
  verbose: false,
  failOnWarnings: false,
  failOnUpdate: false,
  customValueTemplate: null,
  resetDefaultValueLocale: null,
  i18nextOptions: null,
  yamlOptions: null,
};