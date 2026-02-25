import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import Markdown from 'react-native-markdown-display'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  flagged: boolean
  created_at: string
}

interface CareProfile {
  careRecipientName: string
  relationship: string
  durationMonths: number
  biggestChallenge: string
  supportSituation: string
}

const RAILWAY_URL = process.env.EXPO_PUBLIC_RAILWAY_URL

export default function Conversation() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [careProfile, setCareProfile] = useState<CareProfile | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const router = useRouter()
  const [sendError, setSendError] = useState('')
  const [conversationSummary, setConversationSummary] = useState<string | null>(null)
  

  useEffect(() => {
    initialise()
  }, [conversationId])

  async function initialise() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load the care profile — passed to backend for personalised AI responses
      const { data: profile } = await supabase
        .from('care_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        setCareProfile({
          careRecipientName: profile.care_recipient_name,
          relationship: profile.relationship,
          durationMonths: profile.duration_months,
          biggestChallenge: profile.biggest_challenge,
          supportSituation: profile.support_situation,
        })
      }

      // Load conversation summary if it exists
      const { data: convoData } = await supabase
        .from('conversations')
        .select('summary')
        .eq('id', conversationId)
        .single()

      if (convoData?.summary) setConversationSummary(convoData.summary)
      // Load existing messages for this conversation
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (existingMessages && existingMessages.length > 0) {
        setMessages(existingMessages as Message[])
      } else if (profile) {
        // No messages yet — send the opening greeting from the companion
        await sendGreeting(user.id, profile)
      }
    } finally {
      setLoading(false)
    }
  }

  async function sendGreeting(userId: string, profile: any) {
    // The greeting is triggered by sending a hidden system message to the backend
    // The user never sees this prompt — they only see the companion's warm response
    const greetingPrompt = `[SYSTEM: This is the start of a new conversation. Generate a warm, personal opening greeting for this caregiver. Reference who they are caring for and acknowledge the weight of what they carry. Do not ask too many questions — just make them feel welcome and safe. Keep it to 2-3 sentences.]`

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${RAILWAY_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: greetingPrompt }],
          careProfile: {
            careRecipientName: profile.care_recipient_name,
            relationship: profile.relationship,
            durationMonths: profile.duration_months,
            biggestChallenge: profile.biggest_challenge,
            supportSituation: profile.support_situation,
          },
          userId,
          conversationId,
        }),
      })

      const data = await response.json()
      if (!data.message) return

      // Save the greeting as an assistant message in the database
      const { data: savedMessage } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: data.message,
          flagged: false,
        })
        .select()
        .single()

      if (savedMessage) {
        setMessages([savedMessage as Message])
      }

      // Update conversation's last_message_at timestamp
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)

    } catch (err) {
      console.error('Greeting error:', err)
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending || !careProfile) return
    const userText = input.trim()
    setInput('')
    setSending(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!user || !session) return

      // Save user message to database immediately so it appears in the UI
      const { data: userMessage } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: userText,
          flagged: false,
        })
        .select()
        .single()

      if (userMessage) {
        setMessages(prev => [...prev, userMessage as Message])
      }

      // Build message history to send to the backend for context
      // We send all messages so the AI has full conversation context
      const allMessages = [...messages, userMessage as Message]
      const messageHistory = allMessages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      // Call Railway backend — never call Anthropic directly from the app
      const response = await fetch(`${RAILWAY_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      body: JSON.stringify({
        messages: messageHistory,
        careProfile,
        userId: user.id,
        conversationId,
        existingSummary: conversationSummary,
      }),
      })

      // Check content type before parsing — Railway timeouts return HTML not JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server temporarily unavailable. Please try again.')
      }

      const data = await response.json()
      if (!data.message) throw new Error('No response from companion')

      // Persist updated summary if the backend generated one
      if (data.updatedSummary && data.updatedSummary !== conversationSummary) {
        setConversationSummary(data.updatedSummary)
        await supabase
          .from('conversations')
          .update({ summary: data.updatedSummary })
          .eq('id', conversationId)
      }

      // Save assistant response to database
      const { data: assistantMessage } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: data.message,
          flagged: data.flagged || false,
        })
        .select()
        .single()

      if (assistantMessage) {
        setMessages(prev => [...prev, assistantMessage as Message])
      }

      // Update conversation timestamp so it sorts to top of list
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)

    } catch (err: any) {
      console.error('Send error:', err)
      // Show friendly message in UI rather than silent failure
      setSendError('Harbor had trouble responding. Please try sending again.')
      setTimeout(() => setSendError(''), 4000) // auto-clear after 4 seconds
    } finally {
      setSending(false)
    }
  }

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Harbor</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble,
            item.role === 'user' ? styles.userBubble : styles.assistantBubble
          ]}>
            {item.role === 'assistant' ? (
              // Markdown rendering for assistant — supports bold, line breaks etc
              <Markdown style={markdownStyles}>{item.content}</Markdown>
            ) : (
              <Text style={styles.userText}>{item.content}</Text>
            )}
          </View>
        )}
      />

      {/* Sending indicator */}
      {sending && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>Harbor is here with you...</Text>
        </View>
      )}

      {/* Transient error message — shows briefly then disappears */}
        {sendError ? (
        <View style={styles.sendErrorBox}>
            <Text style={styles.sendErrorText}>{sendError}</Text>
        </View>
      ) : null}
      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Share what's on your mind..."
          placeholderTextColor="#9DB5AA"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F4' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F7F4' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#CAE0D8',
  },
  backButton: { width: 60 },
  backText: { color: '#52796F', fontSize: 15 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#2D6A4F' },
  messageList: { padding: 16, gap: 12, paddingBottom: 8 },
  messageBubble: { maxWidth: '85%', borderRadius: 16, padding: 14 },
  userBubble: {
    backgroundColor: '#2D6A4F', alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff', alignSelf: 'flex-start',
    borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#CAE0D8',
  },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  typingIndicator: { paddingHorizontal: 20, paddingVertical: 8 },
  typingText: { color: '#52796F', fontSize: 13, fontStyle: 'italic' },
  sendErrorBox: {
      backgroundColor: '#FEE2E2', paddingHorizontal: 16, paddingVertical: 8,
      borderTopWidth: 1, borderTopColor: '#FECACA',
  },
  sendErrorText: { color: '#DC2626', fontSize: 13, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12,
    paddingVertical: 10, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#CAE0D8', gap: 8,
  },
  input: {
    flex: 1, backgroundColor: '#F0F7F4', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    color: '#2D3A35', maxHeight: 120, borderWidth: 1, borderColor: '#CAE0D8',
  },
  sendButton: {
    backgroundColor: '#2D6A4F', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})

// Markdown styles for assistant messages
const markdownStyles = {
  body: { color: '#2D3A35', fontSize: 15, lineHeight: 22 },
  strong: { fontWeight: '700' as const, color: '#1B3A2D' },
  paragraph: { marginTop: 0, marginBottom: 4 },
}
