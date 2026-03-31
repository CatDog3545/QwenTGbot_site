import axios from 'axios'
import { tg } from '@/lib/telegram'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const initData = tg.getInitData()
  if (initData) {
    config.headers['X-Telegram-Init-Data'] = initData
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tg.hapticFeedback('notification', 'error')
    }
    return Promise.reject(error)
  },
)

export interface ChatRequest {
  message: string
  chatId: string
  history: { role: string; content: string }[]
}

export interface ChatResponse {
  reply: string
  chatId: string
}

export interface ChatHistoryResponse {
  chats: {
    id: string
    title: string
    lastMessage: string
    lastMessageTime: number
  }[]
}

export interface MessagesResponse {
  messages: {
    id: string
    role: string
    content: string
    timestamp: number
  }[]
}

export const chatApi = {
  sendMessage: async (data: ChatRequest): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>('/chat', data)
    return response.data
  },

  sendMessageStream: async (
    data: ChatRequest,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
  ): Promise<AbortController> => {
    const abortController = new AbortController()
    const initData = tg.getInitData()

    fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData,
      },
      body: JSON.stringify(data),
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('ReadableStream not supported')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                onComplete()
                return
              }
              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  onChunk(parsed.content)
                }
              } catch {
                onChunk(data)
              }
            }
          }
        }

        if (buffer) {
          onChunk(buffer)
        }
        onComplete()
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          onError(err)
        }
      })

    return abortController
  },

  getChatHistory: async (): Promise<ChatHistoryResponse> => {
    const response = await api.get<ChatHistoryResponse>('/chats')
    return response.data
  },

  getMessages: async (chatId: string): Promise<MessagesResponse> => {
    const response = await api.get<MessagesResponse>(`/chats/${chatId}/messages`)
    return response.data
  },

  deleteChat: async (chatId: string): Promise<void> => {
    await api.delete(`/chats/${chatId}`)
  },

  renameChat: async (chatId: string, title: string): Promise<void> => {
    await api.patch(`/chats/${chatId}`, { title })
  },
}

export default api
