<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
    <header class="border-b border-zinc-800 px-4 py-3 shrink-0">
      <h1 class="text-lg font-medium tracking-tight">AI 工作台</h1>
    </header>
    <main class="flex-1 flex flex-col overflow-hidden">
      <slot />
    </main>
  </div>
</template>
