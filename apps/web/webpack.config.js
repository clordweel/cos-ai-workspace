const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

module.exports = (_, { mode }) => {
  const dev = mode === 'development';
  return {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: mode === 'production' ? '[name].[contenthash].js' : '[name].js',
    publicPath: '/',
  },
  experiments: {
    asyncWebAssembly: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // bs58 使用 import basex from 'base-x' 后调用 basex(ALPHABET)，Webpack 下 default 可能为命名空间导致 "is not a function"
      'base-x': path.resolve(__dirname, 'src/shims/base-x.js'),
      // shim 内部通过此别名请求真实 CJS，避免 base-x 别名把 base-x/xxx 也指到 shim（base-x 升级时版本号可能需同步）
      'base-x-cjs': path.resolve(__dirname, '../../node_modules/.pnpm/base-x@5.0.1/node_modules/base-x/src/cjs/index.cjs'),
    },
    conditionNames: ['matrix-org:wasm-esm', 'import', 'require', 'default'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: dev
          ? [
              { loader: require.resolve('babel-loader'), options: { plugins: [require.resolve('react-refresh/babel')] } },
              { loader: 'ts-loader', options: { transpileOnly: true } },
            ]
          : { loader: 'ts-loader', options: { transpileOnly: true } },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    // 中间层不可用时，Logto 页可依赖环境变量构建授权 URL（回调仍需中间层）
    new webpack.DefinePlugin({
      'process.env.LOGTO_ENDPOINT': JSON.stringify(process.env.LOGTO_ENDPOINT || ''),
      'process.env.LOGTO_APP_ID': JSON.stringify(process.env.LOGTO_APP_ID || ''),
      'process.env.APP_ORIGIN': JSON.stringify(process.env.APP_ORIGIN || ''),
    }),
    ...(dev ? [new ReactRefreshPlugin()] : []),
  ],
  devServer: {
    port: 3001,
    host: '0.0.0.0',
    hot: true,
    // SPA 路由：/space、/space/:id（含 Matrix room id 如 !xxx%3Ahost）等均返回 index.html
    historyApiFallback: {
      index: '/index.html',
      disableDotRule: true,
    },
    // 关闭压缩，避免代理缓冲 SSE 流导致“一次性蹦出”而非逐字/逐块
    compress: false,
    proxy: [
      {
        context: ['/api'],
        target: process.env.WEBPACK_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    ],
  },
};
};
