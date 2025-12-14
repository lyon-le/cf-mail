import { Hono } from 'hono'
import { authMiddleware } from './middleware/auth'
import { auth } from './routes/auth'
import { mailbox } from './routes/mailbox'
import { message } from './routes/message'
import { settings } from './routes/settings'
import { handleEmail } from './services/email'
import { initDatabase } from './db/init'

type Bindings = {
  DB: D1Database
  R2: R2Bucket
  MAIL_DOMAIN: string
  ADMIN_PASSWORD: string
  JWT_SECRET: string
  TG_BOT_TOKEN?: string
  TG_CHAT_ID?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Database init middleware
app.use('*', async (c, next) => {
  await initDatabase(c.env.DB)
  return next()
})

// Auth middleware
app.use('*', authMiddleware)

// Routes
app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.route('/api', auth)
app.route('/api', mailbox)
app.route('/api', message)
app.route('/api', settings)

export default {
  fetch: app.fetch,

  // Email Workers handler
  async email(message: EmailMessage, env: Bindings, ctx: ExecutionContext) {
    console.log(`Received email from: ${message.from} to: ${message.to}`)

    try {
      // 确保数据库已初始化
      await initDatabase(env.DB)
      await handleEmail(message, env)
    } catch (error) {
      console.error('Failed to handle email:', error)
      message.setReject('Internal error')
    }
  },
}
