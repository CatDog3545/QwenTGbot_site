export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  chatId: string
  role: MessageRole
  content: string
  timestamp: number
  status: 'sending' | 'sent' | 'error'
}

export interface Chat {
  id: string
  title: string
  lastMessage: string
  lastMessageTime: number
  messageCount: number
  createdAt: number
  updatedAt: number
}

export interface TelegramUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
  isPremium?: boolean
}

export interface ThemeParams {
  bg_color: string
  secondary_bg_color: string
  text_color: string
  hint_color: string
  link_color: string
  button_color: string
  button_text_color: string
  header_bg_color: string
  section_bg_color: string
  section_header_text_color: string
  section_separator_color: string
  destructive_text_color: string
}
