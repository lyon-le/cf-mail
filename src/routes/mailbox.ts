import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  MAIL_DOMAIN: string
}

const mailbox = new Hono<{ Bindings: Bindings }>()

// 生成随机地址
function generateRandomAddress(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// GET /api/config - 获取配置信息
mailbox.get('/config', (c) => {
  const domains = (c.env.MAIL_DOMAIN || '').split(',').map((d) => d.trim()).filter(Boolean)
  return c.json({ domains })
})

// GET /api/mailboxes - 列表
mailbox.get('/mailboxes', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT id, address, local_part, domain, is_auto_created, created_at FROM mailboxes ORDER BY created_at DESC'
  ).all()

  return c.json({ mailboxes: result.results })
})

// POST /api/mailboxes - 创建
mailbox.post('/mailboxes', async (c) => {
  const body = await c.req.json<{ address?: string; domain?: string }>()
  // 从环境变量获取允许的域名列表
  const allowedDomains = (c.env.MAIL_DOMAIN || '').split(',').map((d) => d.trim()).filter(Boolean)
  // 如果没有配置域名，回退到默认行为（取第一个，或者报错，这里暂时取第一个作为默认）
  const defaultDomain = allowedDomains[0] || 'localhost'

  // 确定使用的域名
  let domain = defaultDomain
  if (body.domain) {
    if (!allowedDomains.includes(body.domain)) {
      return c.json({ error: 'Invalid domain' }, 400)
    }
    domain = body.domain
  }

  let localPart: string
  if (body.address) {
    // 自定义地址：只取 @ 前面部分
    localPart = body.address.split('@')[0].toLowerCase().trim()
    if (!localPart || !/^[a-z0-9._-]+$/.test(localPart)) {
      return c.json({ error: 'Invalid address format' }, 400)
    }
  } else {
    // 随机生成
    localPart = generateRandomAddress()
  }

  const fullAddress = `${localPart}@${domain}`

  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO mailboxes (address, local_part, domain) VALUES (?, ?, ?) RETURNING id, address, local_part, domain, created_at'
    )
      .bind(fullAddress, localPart, domain)
      .first()

    return c.json({ mailbox: result }, 201)
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'Address already exists' }, 409)
    }
    throw e
  }
})

// DELETE /api/mailboxes/:id - 删除
mailbox.delete('/mailboxes/:id', async (c) => {
  const id = c.req.param('id')

  // 先查询邮箱是否存在
  const mailboxRow = await c.env.DB.prepare('SELECT id FROM mailboxes WHERE id = ?').bind(id).first()

  if (!mailboxRow) {
    return c.json({ error: 'Mailbox not found' }, 404)
  }

  // 删除邮箱（关联的 messages 和 attachments 会级联删除）
  await c.env.DB.prepare('DELETE FROM mailboxes WHERE id = ?').bind(id).run()

  // TODO: 清理 R2 中的邮件和附件文件

  return c.json({ success: true })
})

// DELETE /api/mailboxes/auto-created - 批量删除自动创建的邮箱
mailbox.delete('/mailboxes-auto-created', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM mailboxes WHERE is_auto_created = 1').run()
  return c.json({ success: true, deleted: result.meta.changes })
})

export { mailbox }
