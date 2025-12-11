import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { jwt } from '../utils/jwt'

const PUBLIC_PATHS = ['/api/login', '/api/health', '/api/config']

export async function authMiddleware(c: Context, next: Next) {
  const path = new URL(c.req.url).pathname

  // Skip auth for public paths
  if (PUBLIC_PATHS.includes(path)) {
    return next()
  }

  // Skip auth for non-api paths (static files)
  if (!path.startsWith('/api/')) {
    return next()
  }

  const token = getCookie(c, 'token')
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const payload = await jwt.verify(token, c.env.JWT_SECRET)
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  return next()
}
