import { openDB, type IDBPDatabase } from 'idb'
import type { Message, Chat } from '@/types'

const DB_NAME = 'tg-mini-app-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('chats')) {
          const chatStore = db.createObjectStore('chats', { keyPath: 'id' })
          chatStore.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
          msgStore.createIndex('chatId', 'chatId')
          msgStore.createIndex('timestamp', 'timestamp')
        }
      },
    })
  }
  return dbPromise
}

export const db = {
  async getAllChats(): Promise<Chat[]> {
    const database = await getDB()
    const chats = await database.getAllFromIndex('chats', 'updatedAt')
    return chats.reverse()
  },

  async getChat(id: string): Promise<Chat | undefined> {
    const database = await getDB()
    return database.get('chats', id)
  },

  async saveChat(chat: Chat): Promise<void> {
    const database = await getDB()
    await database.put('chats', chat)
  },

  async deleteChat(id: string): Promise<void> {
    const database = await getDB()
    await database.delete('chats', id)
    const messages = await database.getAllFromIndex('messages', 'chatId', id)
    const tx = database.transaction('messages', 'readwrite')
    for (const msg of messages) {
      await tx.store.delete(msg.id)
    }
    await tx.done
  },

  async getMessages(chatId: string): Promise<Message[]> {
    const database = await getDB()
    const messages = await database.getAllFromIndex('messages', 'chatId', chatId)
    return messages.sort((a, b) => a.timestamp - b.timestamp)
  },

  async addMessage(message: Message): Promise<void> {
    const database = await getDB()
    await database.put('messages', message)
  },

  async updateMessage(id: string, updates: Partial<Message>): Promise<void> {
    const database = await getDB()
    const message = await database.get('messages', id)
    if (message) {
      await database.put('messages', { ...message, ...updates })
    }
  },

  async deleteMessages(chatId: string): Promise<void> {
    const database = await getDB()
    const messages = await database.getAllFromIndex('messages', 'chatId', chatId)
    const tx = database.transaction('messages', 'readwrite')
    for (const msg of messages) {
      await tx.store.delete(msg.id)
    }
    await tx.done
  },

  async clear(): Promise<void> {
    const database = await getDB()
    await database.clear('chats')
    await database.clear('messages')
  },
}
