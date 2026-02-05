export type AppView = 'home' | 'contacts' | 'bots'

const currentView = ref<AppView>('home')

export function useAppView() {
  function setView(view: AppView) {
    currentView.value = view
  }
  return {
    currentView: readonly(currentView),
    setView,
  }
}
