import { useState, useEffect, useCallback } from 'react'
import type { TelegramUser } from '@/types'
import { tg } from '@/lib/telegram'

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!tg.isAvailable) {
      setIsReady(true)
      return
    }

    try {
      tg.init()
      setUser(tg.getUser())
      setIsDark(tg.getWebApp().colorScheme === 'dark')
      setIsReady(true)

      tg.onThemeChanged(() => {
        setIsDark(tg.getWebApp().colorScheme === 'dark')
      })

      tg.onViewportChanged(() => {
        document.documentElement.style.setProperty(
          '--tg-viewport-height',
          `${tg.getWebApp().viewportHeight}px`,
        )
      })
    } catch {
      setIsReady(true)
    }

    return () => {
      if (tg.isAvailable) {
        tg.offThemeChanged(() => {})
        tg.offViewportChanged(() => {})
      }
    }
  }, [])

  const haptic = useCallback(
    (type: 'impact' | 'notification' | 'selection', style?: string) => {
      tg.hapticFeedback(type, style)
    },
    [],
  )

  return {
    user,
    isDark,
    isReady,
    isAvailable: tg.isAvailable,
    haptic,
    initData: tg.getInitData(),
  }
}
