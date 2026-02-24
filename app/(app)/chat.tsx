import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'

interface Conversation {
  id: string
  created_at: string
  last_message_at: string
  preview?: string
}

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const router = useRouter()

  // Reload conversations every time this screen comes into focus
  // so the list updates after returning from a conversation
  useFocusEffect(
    useCallback(() => {
      loadConversations()
    }, [])
  )

  async function loadConversations() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load care profile to personalise the header greeting
      const { data: careProfile } = await supabase
        .from('care_profiles')
        .select('care_recipient_name')
        .eq('user_id', user.id)
        .single()

      if (careProfile) setUserName(careProfile.care_recipient_name)

      // Load conversations ordered by most recent activity
      const { data: convos } = await supabase
        .from('conversations')
        .select('id, created_at, last_message_at')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })

      if (!convos) return

      // For each conversation, fetch the last message as a preview
      const withPreviews = await Promise.all(
        convos.map(async (convo) => {
          const { data: messages } = await supabase
            .from('messages')
            .select('content, role')
            .eq('conversation_id', convo.id)
            .order('created_at', { ascending: false })
            .limit(1)

          const lastMsg = messages?.[0]
          const preview = lastMsg
            ? `${lastMsg.role === 'user' ? 'You: ' : 'Harbor: '}${lastMsg.content.slice(0, 60)}...`
            : 'New conversation'

          return { ...convo, preview }
        })
      )

      setConversations(withPreviews)
    } finally {
      setLoading(false)
    }
  }

  async function startNewConversation() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create a new conversation row and navigate into it
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (error || !data) return
    router.push({ pathname: '/(app)/conversation', params: { id: data.id } })
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/(auth)/sign-in')
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Harbor</Text>
          {userName ? (
            <Text style={styles.headerSub}>Caring for {userName}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Conversation list or empty state */}
      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Welcome to Harbor 💙</Text>
          <Text style={styles.emptyText}>
            This is your safe space. Start a conversation whenever you need support, want to talk through something, or just need someone to listen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.conversationCard}
              onPress={() => router.push({
                pathname: '/(app)/conversation',
                params: { id: item.id }
              })}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardDate}>{formatDate(item.last_message_at)}</Text>
              </View>
              <Text style={styles.cardPreview} numberOfLines={2}>
                {item.preview}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* New conversation button — always visible */}
      <TouchableOpacity style={styles.newButton} onPress={startNewConversation}>
        <Text style={styles.newButtonText}>+ New Conversation</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F4' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F7F4' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#CAE0D8',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#2D6A4F', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: '#52796F', marginTop: 2 },
  signOut: { fontSize: 14, color: '#52796F' },
  list: { padding: 16, gap: 12 },
  conversationCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#CAE0D8',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardDate: { fontSize: 12, color: '#52796F', fontWeight: '500' },
  cardPreview: { fontSize: 14, color: '#2D3A35', lineHeight: 20 },
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#2D6A4F', marginBottom: 16, textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#52796F', lineHeight: 24, textAlign: 'center' },
  newButton: {
    margin: 16, backgroundColor: '#2D6A4F', borderRadius: 14,
    padding: 18, alignItems: 'center',
  },
  newButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})