import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

// Lazily create the client so env vars are guaranteed to be loaded first
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
  }

  return createClient(url, key)
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const supabase = getSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    req.headers['x-user-id'] = user.id
    next()
  } catch (err) {
    console.error('Auth error:', err)
    res.status(500).json({ error: 'Authentication service unavailable' })
  }
}