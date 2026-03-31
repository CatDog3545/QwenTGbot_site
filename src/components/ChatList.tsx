import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/store/chatStore'
import { useTelegram } from '@/hooks/useTelegram'
import { formatTime, truncate } from '@/lib/utils'
import { tg } from '@/lib/telegram'

export default function ChatList() {
  const navigate = useNavigate()
  const { user } = useTelegram()
  const chats = useChatStore((state) => state.chats)
  const isLoading = useChatStore((state) => state.isLoading)
  const loadChats = useChatStore((state) => state.loadChats)
  const createChat = useChatStore((state) => state.createChat)
  const deleteChat = useChatStore((state) => state.deleteChat)

  useEffect(() => {
    loadChats()
  }, [loadChats])

  const handleNewChat = async () => {
    tg.hapticFeedback('impact', 'medium')
    const id = await createChat()
    navigate(`/chat/${id}`)
  }

  const handleSelectChat = (chatId: string) => {
    tg.hapticFeedback('selection')
    navigate(`/chat/${chatId}`)
  }

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    tg.hapticFeedback('notification', 'warning')
    await deleteChat(chatId)
  }

  return (
    <div className="flex flex-col h-full bg-tg-bg">
      <header className="flex items-center justify-between px-4 py-3 border-b border-tg-section-separator bg-tg-header">
        <div>
          <h1 className="text-lg font-semibold text-tg-text">AI Chat</h1>
          {user && (
            <p className="text-xs text-tg-hint-color">
              @{user.username || user.firstName}
            </p>
          )}
        </div>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-tg-button-text transition-opacity active:opacity-70"
          style={{ backgroundColor: 'var(--tg-theme-button-color, #3390ec)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading && chats.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-tg-hint-color border-t-tg-button rounded-full animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mb-3 text-tg-hint-color opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-tg-hint-color text-sm">No chats yet</p>
            <p className="text-tg-hint-color text-xs mt-1">Start a new conversation</p>
          </div>
        ) : (
          <ul className="divide-y divide-tg-section-separator">
            {chats.map((chat) => (
              <li
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-tg-secondary-bg"
                role="button"
                tabIndex={0}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${stringToColor(chat.title)}, ${stringToColor(chat.title + 'shift')})`,
                  }}
                >
                  {chat.title.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-tg-text truncate">
                      {chat.title}
                    </p>
                    <span className="text-xs text-tg-hint-color ml-2 flex-shrink-0">
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  </div>
                  <p className="text-xs text-tg-hint-color truncate mt-0.5">
                    {truncate(chat.lastMessage || 'Empty chat', 60)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  className="flex-shrink-0 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-tg-destructive"
                  aria-label="Delete chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = hash % 360
  return `hsl(${h}, 65%, 55%)`
}
