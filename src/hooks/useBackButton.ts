import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/store/chatStore'
import { tg } from '@/lib/telegram'

export function useBackButton(enabled: boolean, onBack?: () => void) {
  const navigate = useNavigate()
  const selectChat = useChatStore((state) => state.selectChat)

  useEffect(() => {
    if (!tg.isAvailable || !enabled) return

    const handleBack = () => {
      if (onBack) {
        onBack()
      } else {
        selectChat('')
        navigate('/')
      }
    }

    tg.getWebApp().BackButton.show()
    tg.getWebApp().BackButton.onClick(handleBack)

    return () => {
      tg.getWebApp().BackButton.offClick(handleBack)
      tg.getWebApp().BackButton.hide()
    }
  }, [enabled, navigate, onBack, selectChat])
}
