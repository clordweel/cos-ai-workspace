<template>
  <div class="h-screen min-h-0 bg-zinc-100 text-zinc-900 flex flex-col">
    <header class="border-b border-zinc-200 bg-white/80 px-4 py-3 shrink-0">
      <h1 class="text-lg font-medium tracking-tight text-zinc-800">AI 工作台</h1>
    </header>
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <slot />
    </main>
  </div>
</template>
