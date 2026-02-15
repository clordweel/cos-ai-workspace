const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (_, { mode }) => ({
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: mode === 'production' ? '[name].[contenthash].js' : '[name].js',
    publicPath: '/',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: { loader: 'ts-loader', options: { transpileOnly: true } }, exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],
  devServer: {
    port: 3001,
    host: '0.0.0.0',
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api'],
        target: process.env.WEBPACK_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    ],
  },
});
