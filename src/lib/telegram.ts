import type { TelegramUser, ThemeParams } from '@/types'

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void
        expand: () => void
        close: () => void
        enableClosingConfirmation: () => void
        isVersionAtLeast: (version: string) => boolean
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            language_code?: string
            is_premium?: boolean
          }
          auth_date: number
          hash: string
          query_id?: string
        }
        themeParams: Partial<ThemeParams>
        colorScheme: 'light' | 'dark'
        platform: string
        version: string
        isExpanded: boolean
        viewportHeight: number
        viewportStableHeight: number
        headerColor: string
        backgroundColor: string
        setHeaderColor: (color: string) => void
        setBackgroundColor: (color: string) => void
        MainButton: {
          text: string
          color: string
          textColor: string
          isVisible: boolean
          isActive: boolean
          isProgressVisible: boolean
          setText: (text: string) => void
          show: () => void
          hide: () => void
          enable: () => void
          disable: () => void
          showProgress: (leaveActive: boolean) => void
          hideProgress: () => void
          onClick: (cb: () => void) => void
          offClick: (cb: () => void) => void
        }
        BackButton: {
          isVisible: boolean
          onClick: (cb: () => void) => void
          offClick: (cb: () => void) => void
          show: () => void
          hide: () => void
        }
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
          selectionChanged: () => void
        }
        onEvent: (eventType: string, eventHandler: () => void) => void
        offEvent: (eventType: string, eventHandler: () => void) => void
      }
    }
  }
}

const isTelegramAvailable = typeof window !== 'undefined' && window.Telegram?.WebApp

export const tg = {
  isAvailable: isTelegramAvailable,

  getWebApp() {
    if (!isTelegramAvailable) {
      throw new Error('Telegram WebApp SDK is not available')
    }
    return window.Telegram.WebApp
  },

  init() {
    if (!isTelegramAvailable) return

    const webApp = this.getWebApp()
    webApp.ready()
    webApp.expand()
    webApp.enableClosingConfirmation()

    this.applyTheme()

    document.documentElement.style.setProperty(
      '--tg-viewport-height',
      `${webApp.viewportHeight}px`,
    )
    document.documentElement.style.setProperty(
      '--tg-viewport-stable-height',
      `${webApp.viewportStableHeight}px`,
    )
  },

  applyTheme() {
    if (!isTelegramAvailable) return

    const webApp = this.getWebApp()
    const root = document.documentElement

    const themeMap: Record<string, keyof ThemeParams> = {
      '--tg-theme-bg-color': 'bg_color',
      '--tg-theme-secondary-bg-color': 'secondary_bg_color',
      '--tg-theme-text-color': 'text_color',
      '--tg-theme-hint-color': 'hint_color',
      '--tg-theme-link-color': 'link_color',
      '--tg-theme-button-color': 'button_color',
      '--tg-theme-button-text-color': 'button_text_color',
      '--tg-theme-header-bg-color': 'header_bg_color',
      '--tg-theme-section-bg-color': 'section_bg_color',
      '--tg-theme-section-header-text-color': 'section_header_text_color',
      '--tg-theme-section-separator-color': 'section_separator_color',
      '--tg-theme-destructive-text-color': 'destructive_text_color',
    }

    for (const [cssVar, themeKey] of Object.entries(themeMap)) {
      const value = webApp.themeParams[themeKey]
      if (value) {
        root.style.setProperty(cssVar, value)
      }
    }

    if (webApp.colorScheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  },

  getUser(): TelegramUser | null {
    if (!isTelegramAvailable) return null

    const webApp = this.getWebApp()
    const tgUser = webApp.initDataUnsafe.user
    if (!tgUser) return null

    return {
      id: tgUser.id,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name,
      username: tgUser.username,
      languageCode: tgUser.language_code,
      isPremium: tgUser.is_premium,
    }
  },

  getInitData(): string {
    if (!isTelegramAvailable) return ''
    return this.getWebApp().initData
  },

  hapticFeedback(type: 'impact' | 'notification' | 'selection', style?: string) {
    if (!isTelegramAvailable) return

    const webApp = this.getWebApp()
    const haptic = webApp.HapticFeedback

    if (type === 'impact') {
      haptic.impactOccurred((style as 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') || 'light')
    } else if (type === 'notification') {
      haptic.notificationOccurred((style as 'error' | 'success' | 'warning') || 'success')
    } else {
      haptic.selectionChanged()
    }
  },

  onThemeChanged(callback: () => void) {
    if (!isTelegramAvailable) return
    this.getWebApp().onEvent('themeChanged', callback)
  },

  offThemeChanged(callback: () => void) {
    if (!isTelegramAvailable) return
    this.getWebApp().offEvent('themeChanged', callback)
  },

  onViewportChanged(callback: () => void) {
    if (!isTelegramAvailable) return
    this.getWebApp().onEvent('viewportChanged', callback)
  },

  offViewportChanged(callback: () => void) {
    if (!isTelegramAvailable) return
    this.getWebApp().offEvent('viewportChanged', callback)
  },
}
