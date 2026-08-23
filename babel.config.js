module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        cwd: 'babelrc',
        root: ['./'],
        extensions: [
          '.ios.js',
          '.android.js',
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
          '.json',
        ],
        alias: {
          '@': './src',
        },
      },
    ],
    [
      'babel-plugin-styled-components',
      {
        displayName: true,
        fileName: false,
        topLevelImportPaths: ['styled-components/native', 'styled-components'],
      },
    ],
  ],
};
