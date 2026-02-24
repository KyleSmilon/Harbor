import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { AppState } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing Supabase env vars. URL: ${supabaseUrl ? 'OK' : 'MISSING'}, KEY: ${supabaseAnonKey ? 'OK' : 'MISSING'}`
  )
}

// SecureStore has a 2048 byte limit per key.
// Large tokens (like Supabase JWTs) are chunked across multiple keys
// to stay within that limit and avoid storage failures.
const CHUNK_SIZE = 1800

async function setItemChunked(key: string, value: string): Promise<void> {
  const chunks = []
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE))
  }
  await SecureStore.setItemAsync(`${key}_count`, String(chunks.length))
  await Promise.all(
    chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_${i}`, chunk))
  )
}

async function getItemChunked(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${key}_count`)
  if (!countStr) return null
  const count = parseInt(countStr)
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}_${i}`))
  )
  if (chunks.some(c => c === null)) return null
  return chunks.join('')
}

async function removeItemChunked(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}_count`)
  if (!countStr) return
  const count = parseInt(countStr)
  await Promise.all([
    SecureStore.deleteItemAsync(`${key}_count`),
    ...Array.from({ length: count }, (_, i) =>
      SecureStore.deleteItemAsync(`${key}_${i}`)
    )
  ])
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: getItemChunked,
      setItem: setItemChunked,
      removeItem: removeItemChunked,
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Pause token refresh when app is backgrounded, resume when foregrounded
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})