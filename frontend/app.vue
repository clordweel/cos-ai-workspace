<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
  html,
  body,
  #__nuxt {
    font-family: 'HarmonyOS Sans SC', HarmonyOSHans-Regular, HarmonyOSHans-fallback,
      PingFangSC-Regular, 'Microsoft YaHei', Arial, Helvetica, sans-serif !important;
  }

  /* 全局选中样式：柔和主题色，易读不刺眼 */
  ::selection {
    background: rgb(59 130 246 / 0.2);
    color: inherit;
  }
  ::-moz-selection {
    background: rgb(59 130 246 / 0.2);
    color: inherit;
  }
  :root.dark ::selection,
  .dark ::selection {
    background: rgb(96 165 250 / 0.25);
    color: inherit;
  }
  :root.dark ::-moz-selection,
  .dark ::-moz-selection {
    background: rgb(96 165 250 / 0.25);
    color: inherit;
  }
</style>
