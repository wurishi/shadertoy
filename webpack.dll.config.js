const webpack = require('webpack');
const path = require('path');

const options = webpack({
  entry: ['stats.js', 'dat.gui', 'three'],
  output: {
    filename: '[name].dll.js',
    path: path.resolve(__dirname, 'dist/dll'),
    library: '[name]_dll_[hash]',
  },
  plugins: [
    new webpack.DllPlugin({
      name: '[name]_dll_[hash]',
      path: path.join(__dirname, 'dist/dll', '[name].manifest.json'),
    }),
  ],
}).options;

module.exports = options;
