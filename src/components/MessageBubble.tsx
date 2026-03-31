import { memo } from 'react'
import type { Message } from '@/types'
import { formatMessageTime } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'

interface MessageBubbleProps {
  message: Message
  isLast: boolean
}

const MessageBubble = memo(function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isError = message.status === 'error'

  return (
    <div
      className={clsx(
        'flex w-full animate-slide-up',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={clsx(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-md text-tg-button-text'
            : 'rounded-bl-md bg-tg-secondary-bg text-tg-text',
          isError && 'border border-tg-destructive/30',
        )}
        style={
          isUser
            ? { backgroundColor: 'var(--tg-theme-button-color, #3390ec)' }
            : undefined
        }
      >
        {message.role === 'assistant' ? (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:text-xs prose-pre:bg-tg-bg prose-pre:border prose-pre:border-tg-section-separator">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || (isLast && message.status === 'sending' ? '▌' : '')}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}

        <div
          className={clsx(
            'flex items-center justify-end gap-1.5 mt-1',
            isUser ? 'text-tg-button-text/60' : 'text-tg-hint-color',
          )}
        >
          <span className="text-[10px]">
            {formatMessageTime(message.timestamp)}
          </span>
          {isUser && message.status === 'sending' && (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isUser && message.status === 'sent' && (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {isUser && message.status === 'error' && (
            <svg className="w-3 h-3 text-tg-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
})

export default MessageBubble
