import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const settings = new Hono<{ Bindings: Bindings }>()

// GET /api/settings - 获取所有配置
settings.get('/settings', async (c) => {
  const result = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const config: Record<string, string> = {}
  for (const row of result.results as { key: string; value: string }[]) {
    config[row.key] = row.value
  }
  return c.json({ settings: config })
})

// PUT /api/settings - 更新配置
settings.put('/settings', async (c) => {
  const body = await c.req.json<Record<string, string>>()

  const allowedKeys = ['auto_create_enabled', 'auto_create_min_length', 'auto_create_max_length', 'auto_create_start_type']

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) continue
    await c.env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?').bind(value, key).run()
  }

  return c.json({ success: true })
})

export { settings }
