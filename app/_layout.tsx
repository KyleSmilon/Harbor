import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { View, ActivityIndicator } from 'react-native'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    // Get the current session on app launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for sign in / sign out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return

    async function redirect() {
      const inAuthGroup = segments[0] === '(auth)'

      if (!session) {
        if (!inAuthGroup) router.replace('/(auth)/sign-in')
        return
      }

      // Session exists — verify the user actually exists in our database.
      // If the DB was cleared manually, the session token is stale and we
      // should sign them out rather than letting them hit SQL errors.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        // Stale session — sign out and return to sign in
        await supabase.auth.signOut()
        router.replace('/(auth)/sign-in')
        return
      }

      // Profile exists — now check if onboarding is complete
      const { data: careProfile } = await supabase
        .from('care_profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (!careProfile) {
        router.replace('/(app)/onboarding')
      } else {
        router.replace('/(app)/chat')
      }
    }

    redirect()
  }, [session, loading])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F7F4' }}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    )
  }

  return <Slot />
}