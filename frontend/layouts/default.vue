<template>
  <div class="h-screen min-h-0 bg-zinc-100 text-zinc-900 flex flex-col">
    <header class="border-b border-zinc-200 bg-white px-4 py-2 shrink-0">
      <h1 class="text-base font-semibold tracking-tight text-zinc-800">AI COS 工作台</h1>
    </header>
    <main class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <slot />
    </main>
  </div>
</template>
