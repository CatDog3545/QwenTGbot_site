import { create } from 'zustand'
import type { Message, Chat } from '@/types'
import { db } from '@/lib/db'
import { chatApi } from '@/lib/api'
import { generateId } from '@/lib/utils'

interface ChatState {
  chats: Chat[]
  currentChatId: string | null
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  abortController: AbortController | null

  loadChats: () => Promise<void>
  createChat: () => Promise<string>
  selectChat: (chatId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  renameChat: (chatId: string, title: string) => Promise<void>
  syncWithBackend: () => Promise<void>
  setError: (error: string | null) => void
  stopStreaming: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  abortController: null,

  loadChats: async () => {
    set({ isLoading: true, error: null })
    try {
      const localChats = await db.getAllChats()
      set({ chats: localChats })
    } catch (err) {
      set({ error: 'Failed to load chats' })
    } finally {
      set({ isLoading: false })
    }
  },

  createChat: async () => {
    const id = generateId()
    const now = Date.now()
    const newChat: Chat = {
      id,
      title: 'New Chat',
      lastMessage: '',
      lastMessageTime: now,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    await db.saveChat(newChat)

    set((state) => ({
      chats: [newChat, ...state.chats],
      currentChatId: id,
      messages: [],
    }))

    return id
  },

  selectChat: async (chatId: string) => {
    set({ currentChatId: chatId, isLoading: true, error: null, messages: [] })

    try {
      const messages = await db.getMessages(chatId)
      set({ messages, isLoading: false })
    } catch {
      set({ messages: [], isLoading: false })
    }
  },

  sendMessage: async (content: string) => {
    const { currentChatId, messages } = get()
    if (!currentChatId || !content.trim()) return

    const userMessage: Message = {
      id: generateId(),
      chatId: currentChatId,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      status: 'sending',
    }

    const assistantMessageId = generateId()
    const assistantMessage: Message = {
      id: assistantMessageId,
      chatId: currentChatId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'sending',
    }

    set((state) => ({
      messages: [...state.messages, userMessage],
      isStreaming: true,
      error: null,
    }))

    await db.addMessage(userMessage)

    const chat = get().chats.find((c) => c.id === currentChatId)
    if (chat) {
      const updatedChat = {
        ...chat,
        lastMessage: content.trim(),
        lastMessageTime: Date.now(),
        messageCount: chat.messageCount + 1,
        updatedAt: Date.now(),
        title: chat.title === 'New Chat' ? content.trim().slice(0, 50) : chat.title,
      }
      await db.saveChat(updatedChat)
      set((state) => ({
        chats: state.chats.map((c) => (c.id === currentChatId ? updatedChat : c)),
      }))
    }

    const historyForApi = messages
      .filter((m) => m.status !== 'error')
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      await db.updateMessage(userMessage.id, { status: 'sent' })

      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }))

      await chatApi.sendMessageStream(
        {
          message: content.trim(),
          chatId: currentChatId,
          history: historyForApi,
        },
        (chunk) => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: m.content + chunk }
                : m,
            ),
          }))
        },
        () => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMessageId ? { ...m, status: 'sent' as const } : m,
            ),
            isStreaming: false,
            abortController: null,
          }))

          const finalMsg = get().messages.find((m) => m.id === assistantMessageId)
          if (finalMsg?.content) {
            db.addMessage({ ...finalMsg, status: 'sent' })
            const currentChat = get().chats.find((c) => c.id === currentChatId)
            if (currentChat) {
              const updatedChat = {
                ...currentChat,
                lastMessage: finalMsg.content.slice(0, 100),
                lastMessageTime: Date.now(),
                messageCount: currentChat.messageCount + 1,
                updatedAt: Date.now(),
              }
              db.saveChat(updatedChat)
              set((state) => ({
                chats: state.chats.map((c) => (c.id === currentChatId ? updatedChat : c)),
              }))
            }
          }
        },
        (error) => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: 'Error: Failed to get response', status: 'error' as const }
                : m,
            ),
            isStreaming: false,
            error: error.message,
            abortController: null,
          }))
        },
      ).then((controller) => {
        set({ abortController: controller })
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      set({
        error: errorMessage,
        isStreaming: false,
        abortController: null,
      })
    }
  },

  deleteChat: async (chatId: string) => {
    await db.deleteChat(chatId)

    set((state) => ({
      chats: state.chats.filter((c) => c.id !== chatId),
      currentChatId: state.currentChatId === chatId ? null : state.currentChatId,
      messages: state.currentChatId === chatId ? [] : state.messages,
    }))
  },

  renameChat: async (chatId: string, title: string) => {
    const chat = get().chats.find((c) => c.id === chatId)
    if (!chat) return

    const updatedChat = { ...chat, title, updatedAt: Date.now() }
    await db.saveChat(updatedChat)

    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? updatedChat : c)),
    }))
  },

  syncWithBackend: async () => {
    try {
      const response = await chatApi.getChatHistory()
      for (const remoteChat of response.chats) {
        const localChat = await db.getChat(remoteChat.id)
        if (!localChat || localChat.updatedAt < remoteChat.lastMessageTime) {
          const messagesResponse = await chatApi.getMessages(remoteChat.id)
          for (const msg of messagesResponse.messages) {
            const localMsg = await db.getMessages(remoteChat.id).then((msgs) =>
              msgs.find((m) => m.id === msg.id),
            )
            if (!localMsg) {
              await db.addMessage({
                id: msg.id,
                chatId: remoteChat.id,
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
                timestamp: msg.timestamp,
                status: 'sent',
              })
            }
          }

          const chatToSave: Chat = {
            id: remoteChat.id,
            title: remoteChat.title,
            lastMessage: remoteChat.lastMessage,
            lastMessageTime: remoteChat.lastMessageTime,
            messageCount: messagesResponse.messages.length,
            createdAt: remoteChat.lastMessageTime,
            updatedAt: remoteChat.lastMessageTime,
          }
          await db.saveChat(chatToSave)
        }
      }

      const updatedChats = await db.getAllChats()
      set({ chats: updatedChats })
    } catch {
      // Silent fail — offline mode is fine
    }
  },

  setError: (error: string | null) => {
    set({ error })
  },

  stopStreaming: () => {
    const { abortController } = get()
    if (abortController) {
      abortController.abort()
      set({ abortController: null, isStreaming: false })
    }
  },
}))
