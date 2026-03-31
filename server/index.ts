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
const AI_BACKEND_URL = process.env.AI_BACKEND_URL || ''

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

async function callAIBackend(
  userId: number,
  chatId: string,
  message: string,
  history: { role: string; content: string }[],
  endpoint: string,
): Promise<Response> {
  const url = `${AI_BACKEND_URL}${endpoint}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      chat_id: chatId,
      message,
      history: history || [],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI backend responded with ${response.status}`)
  }

  return response
}

app.post('/api/chat', getAuthMiddleware, async (req, res) => {
  const { message, chatId, history } = req.body
  const telegramUser = (req as any).telegramUser

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' })
  }

  if (!AI_BACKEND_URL) {
    return res.status(503).json({ error: 'AI backend not configured' })
  }

  try {
    const response = await callAIBackend(telegramUser.id, chatId, message, history, '/api/ai')
    const data = await response.json()
    res.json({ reply: data.reply, chatId })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(502).json({ error: 'Failed to get AI response' })
  }
})

app.post('/api/chat/stream', getAuthMiddleware, async (req, res) => {
  const { message, chatId, history } = req.body
  const telegramUser = (req as any).telegramUser

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  if (!AI_BACKEND_URL) {
    res.write(`data: ${JSON.stringify({ error: 'AI backend not configured' })}\n\n`)
    return res.end()
  }

  try {
    const response = await callAIBackend(telegramUser.id, chatId, message, history, '/api/ai/stream')

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No readable stream')
    }

    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      res.write(`data: ${chunk}\n\n`)
    }

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

  try {
    const response = await fetch(`${AI_BACKEND_URL}/api/chats?user_id=${userId}`)
    const data = await response.json()
    res.json(data)
  } catch {
    res.json({ chats: [] })
  }
})

app.get('/api/chats/:chatId/messages', getAuthMiddleware, async (req, res) => {
  const { chatId } = req.params
  const telegramUser = (req as any).telegramUser
  const userId = telegramUser.id

  try {
    const response = await fetch(`${AI_BACKEND_URL}/api/chats/${chatId}/messages?user_id=${userId}`)
    const data = await response.json()
    res.json(data)
  } catch {
    res.json({ messages: [] })
  }
})

app.delete('/api/chats/:chatId', getAuthMiddleware, async (req, res) => {
  const { chatId } = req.params
  const telegramUser = (req as any).telegramUser
  const userId = telegramUser.id

  try {
    await fetch(`${AI_BACKEND_URL}/api/chats/${chatId}?user_id=${userId}`, {
      method: 'DELETE',
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete chat' })
  }
})

app.patch('/api/chats/:chatId', getAuthMiddleware, async (req, res) => {
  const { chatId } = req.params
  const { title } = req.body

  try {
    await fetch(`${AI_BACKEND_URL}/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to rename chat' })
  }
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
