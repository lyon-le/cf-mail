/**
 * 数据库初始化
 * 首次访问时自动创建表结构
 */

let initialized = false

export async function initDatabase(db: D1Database): Promise<void> {
  if (initialized) return

  try {
    // 快速检查：如果所有表都存在，跳过初始化
    try {
      await db.prepare('SELECT 1 FROM mailboxes LIMIT 1').all()
      await db.prepare('SELECT 1 FROM messages LIMIT 1').all()
      await db.prepare('SELECT 1 FROM attachments LIMIT 1').all()
      await db.prepare('SELECT 1 FROM settings LIMIT 1').all()
      // 所有表都存在，跳过创建
      initialized = true
      return
    } catch {
      // 有表不存在，继续初始化
      console.log('Initializing database...')
    }

    // 逐条执行建表语句
    await db.exec("CREATE TABLE IF NOT EXISTS mailboxes (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT NOT NULL UNIQUE, local_part TEXT NOT NULL, domain TEXT NOT NULL, is_auto_created INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);")
    await db.exec("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, mailbox_id INTEGER NOT NULL, sender TEXT NOT NULL, subject TEXT NOT NULL, preview TEXT, verification_code TEXT, r2_key TEXT NOT NULL, received_at TEXT DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0, FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE);")
    await db.exec("CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL, filename TEXT NOT NULL, content_type TEXT, size INTEGER, hash TEXT NOT NULL, r2_key TEXT NOT NULL, FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE);")
    await db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);")

    // 逐条创建索引
    await db.exec("CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);")
    await db.exec("CREATE INDEX IF NOT EXISTS idx_messages_mailbox_id ON messages(mailbox_id);")
    await db.exec("CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);")
    await db.exec("CREATE INDEX IF NOT EXISTS idx_attachments_hash ON attachments(hash);")
    await db.exec("CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);")

    // 初始化默认配置
    await db.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_create_enabled', 'false');")
    await db.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_create_min_length', '6');")
    await db.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_create_max_length', '20');")
    await db.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_create_start_type', 'both');")

    console.log('Database initialized')
    initialized = true
  } catch (error) {
    console.error('Database init error:', error)
    throw error
  }
}
