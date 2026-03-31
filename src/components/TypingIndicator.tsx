import { memo } from 'react'

const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex w-full justify-start animate-fade-in">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-tg-secondary-bg px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-tg-hint-color animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-tg-hint-color animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-tg-hint-color animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
})

export default TypingIndicator
