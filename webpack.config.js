const webpack = require('webpack');
const path = require('path');
const HTMLWebpackPlugin = require('html-webpack-plugin');

const options = webpack({
  entry: './index.ts',
  devtool: 'cheap-eval-source-map',
  devServer: {
    open: true,
    port: 9009,
    contentBase: path.join(__dirname),
    // host: '172.16.2.0'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(jpg|png|jpeg)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              outputPath: 'images/',
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  plugins: [
    new webpack.DllReferencePlugin({
      context: __dirname,
      manifest: require('./dist/dll/main.manifest.json'),
    }),
    new HTMLWebpackPlugin({
      templateContent: `<html>
      <head>
      <script src="./dist/dll/main.dll.js"></script>
      </head>
      <body>
        
      </body>
    </html>`,
    }), //
  ],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
}).options;

module.exports = options;
