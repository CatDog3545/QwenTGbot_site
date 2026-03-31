import { useState, useRef, useCallback, memo } from 'react'
import { tg } from '@/lib/telegram'

interface InputAreaProps {
  onSend: (message: string) => void
  disabled: boolean
  isStreaming: boolean
  onStop?: () => void
}

const InputArea = memo(function InputArea({ onSend, disabled, isStreaming, onStop }: InputAreaProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return

    tg.hapticFeedback('impact', 'soft')
    onSend(trimmed)
    setValue('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      adjustHeight()
    },
    [adjustHeight],
  )

  return (
    <div className="border-t border-tg-section-separator bg-tg-bg px-3 py-2">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            disabled={disabled && !isStreaming}
            className="w-full resize-none rounded-xl border border-tg-section-separator bg-tg-secondary-bg text-tg-text placeholder:text-tg-hint-color px-3.5 py-2.5 text-sm leading-relaxed focus:outline-none focus:border-tg-link disabled:opacity-50 transition-colors max-h-40 overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          />
        </div>

        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-tg-destructive text-white transition-transform active:scale-95"
            aria-label="Stop generating"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            style={{
              backgroundColor: value.trim() && !disabled
                ? 'var(--tg-theme-button-color, #3390ec)'
                : 'var(--tg-theme-secondary-bg-color, #e8e8e8)',
              color: value.trim() && !disabled
                ? 'var(--tg-theme-button-text-color, #ffffff)'
                : 'var(--tg-theme-hint-color, #999999)',
            }}
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
})

export default InputArea
