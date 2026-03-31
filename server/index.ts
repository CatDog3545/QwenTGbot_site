import { createHmac, timingSafeEqual } from 'crypto'
import { fileURLToPath } from 'url'
import path from 'path'
import express from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

app.use(express.json())

if (isProduction) {
  app.use(express.static(path.join(__dirname, '..', 'dist')))
}

const BOT_TOKEN = process.env.BOT_TOKEN || ''
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const MODEL = 'qwen/qwen3.6-plus-preview:free'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatSession {
  messages: ChatMessage[]
  updatedAt: number
}

const chatSessions = new Map<string, ChatSession>()

const SYSTEM_PROMPT = `You are a helpful AI assistant. Respond in the same language the user writes in. Be concise, accurate, and friendly. Use markdown formatting for code blocks, lists, and tables when appropriate.`

function validateTelegramInitData(initData: string): Record<string, string> | null {
  if (!initData || !BOT_TOKEN) return null

  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get('hash')
  if (!hash) return null

  urlParams.delete('hash')

  const sortedParams = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const computedHash = createHmac('sha256', secretKey).update(sortedParams).digest('hex')

  if (!timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash))) {
    return null
  }

  const result: Record<string, string> = {}
  for (const [key, value] of urlParams.entries()) {
    result[key] = value
  }
  return result
}

function getAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const initData = req.headers['x-telegram-init-data'] as string
  const parsed = validateTelegramInitData(initData)

  if (!parsed) {
    return res.status(401).json({ error: 'Invalid or missing Telegram initData' })
  }

  const userStr = parsed.user
  if (!userStr) {
    return res.status(401).json({ error: 'Missing user data' })
  }

  try {
    const user = JSON.parse(decodeURIComponent(userStr))
    ;(req as any).telegramUser = user
  } catch {
    return res.status(401).json({ error: 'Invalid user data' })
  }

  next()
}

function getSessionKey(userId: number, chatId: string): string {
  return `${userId}:${chatId}`
}

function getOrCreateSession(userId: number, chatId: string): ChatSession {
  const key = getSessionKey(userId, chatId)
  let session = chatSessions.get(key)
  if (!session) {
    session = { messages: [], updatedAt: Date.now() }
    chatSessions.set(key, session)
  }
  return session
}

function buildMessages(session: ChatSession, newUserMessage: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...session.messages.slice(-20),
    { role: 'user', content: newUserMessage },
  ]
}

app.post('/api/chat', getAuthMiddleware, async (req, res) => {
  const { message, chatId } = req.body
  const telegramUser = (req as any).telegramUser

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' })
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'OpenRouter API key not configured' })
  }

  const session = getOrCreateSession(telegramUser.id, chatId)
  const messages = buildMessages(session, message)

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://github.com',
        'X-Title': 'Telegram Mini App Chat',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter error:', response.status, errorText)
      throw new Error(`OpenRouter responded with ${response.status}`)
    }

    const data: { choices?: { message?: { content?: string } }[] } = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'No response'

    session.messages.push({ role: 'user', content: message })
    session.messages.push({ role: 'assistant', content: reply })
    session.updatedAt = Date.now()

    res.json({ reply, chatId })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(502).json({ error: 'Failed to get AI response' })
  }
})

app.post('/api/chat/stream', getAuthMiddleware, async (req, res) => {
  const { message, chatId } = req.body
  const telegramUser = (req as any).telegramUser

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  if (!OPENROUTER_API_KEY) {
    res.write(`data: ${JSON.stringify({ error: 'OpenRouter API key not configured' })}\n\n`)
    return res.end()
  }

  const session = getOrCreateSession(telegramUser.id, chatId)
  const messages = buildMessages(session, message)

  let fullReply = ''

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://github.com',
        'X-Title': 'Telegram Mini App Chat',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter stream error:', response.status, errorText)
      res.write(`data: ${JSON.stringify({ error: `OpenRouter error: ${response.status}` })}\n\n`)
      return res.end()
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No readable stream')
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
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            fullReply += content
            res.write(`data: ${JSON.stringify({ content })}\n\n`)
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    session.messages.push({ role: 'user', content: message })
    session.messages.push({ role: 'assistant', content: fullReply })
    session.updatedAt = Date.now()

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Stream error:', err)
    res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`)
    res.end()
  }
})

app.get('/api/chats', getAuthMiddleware, async (req, res) => {
  const telegramUser = (req as any).telegramUser
  const userId = telegramUser.id
  const prefix = `${userId}:`

  const chats = []
  for (const [key, session] of chatSessions) {
    if (key.startsWith(prefix)) {
      const chatId = key.slice(prefix.length)
      const lastUserMsg = [...session.messages].reverse().find((m) => m.role === 'user')
      const lastMsg = session.messages[session.messages.length - 1]
      chats.push({
        id: chatId,
        title: lastUserMsg?.content?.slice(0, 50) || 'Chat',
        lastMessage: lastMsg?.content?.slice(0, 100) || '',
        lastMessageTime: session.updatedAt,
      })
    }
  }

  chats.sort((a, b) => b.lastMessageTime - a.lastMessageTime)
  res.json({ chats })
})

app.get('/api/chats/:chatId/messages', getAuthMiddleware, async (req, res) => {
  const { chatId } = req.params
  const telegramUser = (req as any).telegramUser
  const userId = telegramUser.id

  const session = chatSessions.get(getSessionKey(userId, chatId))
  if (!session) {
    return res.json({ messages: [] })
  }

  const messages = session.messages.map((msg, idx) => ({
    id: `${chatId}-${idx}`,
    role: msg.role,
    content: msg.content,
    timestamp: session.updatedAt,
  }))

  res.json({ messages })
})

app.delete('/api/chats/:chatId', getAuthMiddleware, async (req, res) => {
  const { chatId } = req.params
  const telegramUser = (req as any).telegramUser
  const userId = telegramUser.id

  chatSessions.delete(getSessionKey(userId, chatId))
  res.json({ success: true })
})

app.patch('/api/chats/:chatId', getAuthMiddleware, async (_req, res) => {
  res.json({ success: true })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

if (isProduction) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'))
  })
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${isProduction ? 'production' : 'development'})`)
})
