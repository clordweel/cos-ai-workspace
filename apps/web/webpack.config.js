const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

// 仅加载本目录 apps/web/.env，不读取根目录 .env（与根 .env 彻底隔离）；INVITE_CODE、LOGTO_*、WEBPACK_PROXY_TARGET 等在此配置；override: false 保证命令行传入的变量优先
try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: false });
} catch {
  // 无 dotenv 时忽略，依赖命令行或系统环境变量
}

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
      /** 测试版部署：设置后启用邀请码门控，未输入正确邀请码无法进入主应用；主应用路由懒加载 */
      'process.env.INVITE_CODE': JSON.stringify(process.env.INVITE_CODE || ''),
    }),
    ...(dev ? [new ReactRefreshPlugin()] : []),
  ],
  devServer: {
    port: 3001,
    host: '0.0.0.0',
    // 反向代理通过域名访问（如 cosai.junhai.work → 3001）时，需允许该 Host，否则会报 Invalid Host header
    allowedHosts: ['cosai.junhai.work', 'cosapi.junhai.work'],
    // 反向代理时 HMR WebSocket 需走代理域名（同源），否则会连到 wss://域名:3001/ws 失败；设置后使用该 URL 的 host+protocol，path 固定 /ws
    ...(process.env.DEV_SERVER_WS_PUBLIC_URL && (() => {
      try {
        const u = new URL(process.env.DEV_SERVER_WS_PUBLIC_URL);
        const defaultPort = u.protocol === 'https:' ? 443 : 80;
        const port = u.port ? Number(u.port) : defaultPort;
        // 必须显式传 port：省略时 dev-server 会用本机 port 3001，导致 wss://域名:3001/ws
        return {
          client: {
            webSocketURL: {
              protocol: u.protocol === 'https:' ? 'wss' : 'ws',
              hostname: u.hostname,
              port: String(port),
              pathname: '/ws',
            },
          },
        };
      } catch {
        return {};
      }
    })()),
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
