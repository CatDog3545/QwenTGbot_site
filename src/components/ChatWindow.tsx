import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { useBackButton } from '@/hooks/useBackButton'
import MessageBubble from '@/components/MessageBubble'
import InputArea from '@/components/InputArea'
import TypingIndicator from '@/components/TypingIndicator'

export default function ChatWindow() {
  const { chatId } = useParams<{ chatId: string }>()
  const navigate = useNavigate()

  const messages = useChatStore((state) => state.messages)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const error = useChatStore((state) => state.error)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const stopStreaming = useChatStore((state) => state.stopStreaming)
  const selectChat = useChatStore((state) => state.selectChat)

  const messagesEndRef = useAutoScroll([messages, isStreaming])

  useBackButton(true, () => {
    navigate('/')
  })

  useEffect(() => {
    if (chatId) {
      selectChat(chatId)
    }
  }, [chatId, selectChat])

  const handleSend = async (content: string) => {
    await sendMessage(content)
  }

  return (
    <div className="flex flex-col h-full bg-tg-bg">
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-tg-section-separator bg-tg-header flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-1 rounded-full hover:bg-tg-secondary-bg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-tg-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-tg-text truncate">
            {messages.length > 0
              ? messages.find((m) => m.role === 'user')?.content?.slice(0, 40) || 'Chat'
              : 'New Chat'}
          </h2>
          <p className="text-xs text-tg-hint-color">
            {isStreaming ? 'typing...' : 'AI Assistant'}
          </p>
        </div>
      </header>

      <div
        ref={messagesEndRef}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
      >
        {messages.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--tg-theme-button-color, #3390ec)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-tg-button-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 0 0-7.07 17.07l1.41-1.41A8 8 0 1 1 12 20v4l4-4h4a10 10 0 0 0 0-20z" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-tg-text mb-1">
              How can I help you?
            </h3>
            <p className="text-sm text-tg-hint-color max-w-xs">
              Send a message to start a conversation with AI
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={idx === messages.length - 1}
              />
            ))}
            {isStreaming && <TypingIndicator />}
            {error && (
              <div className="flex justify-center">
                <div className="bg-tg-destructive/10 text-tg-destructive text-xs px-3 py-2 rounded-lg">
                  {error}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <InputArea
        onSend={handleSend}
        disabled={false}
        isStreaming={isStreaming}
        onStop={stopStreaming}
      />
    </div>
  )
}
