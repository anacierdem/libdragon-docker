module.exports = {
  singleQuote: true,
  trailingComma: 'es5',
  overrides: [
    {
      files: ['**/*.{scss,less,css}'],
      options: {
        singleQuote: false,
      },
    },
  ],
};
