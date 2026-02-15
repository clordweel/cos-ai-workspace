/**
 * Shim：Webpack 打包时 base-x 的 default 可能被包成命名空间，导致 bs58 中 basex(ALPHABET) 报 "is not a function"。
 * 通过子路径请求真实 CJS 入口，避免别名循环，并统一导出为可调用函数。
 */
const baseX = require('base-x-cjs');
module.exports = baseX.default || baseX;
