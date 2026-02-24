import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSignUp() {
    setErrorMessage('')

    if (!email || !password) {
      setErrorMessage('Please enter your email and password.')
      return
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        setErrorMessage('An account with this email already exists. Please sign in instead.')
      } else if (error.message.includes('invalid')) {
        setErrorMessage('Please enter a valid email address.')
      } else if (error.message.includes('weak') || error.message.includes('password')) {
        setErrorMessage('Please choose a stronger password.')
      } else {
        setErrorMessage(error.message)
      }
      return
    }

    if (data.session) {
      router.replace('/(app)/onboarding')
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.logo}>Harbor</Text>
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Check your email 💙</Text>
            <Text style={styles.successText}>
              We sent a confirmation link to {email}. Click it to activate your account, then come back to sign in.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/(auth)/sign-in')}
          >
            <Text style={styles.buttonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Harbor</Text>
        <Text style={styles.tagline}>A safe place to breathe.</Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9DB5AA"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 8 characters)"
          placeholderTextColor="#9DB5AA"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F4' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: {
    fontSize: 48, fontWeight: '700', color: '#2D6A4F',
    textAlign: 'center', marginBottom: 8, letterSpacing: -1,
  },
  tagline: {
    fontSize: 16, color: '#52796F', textAlign: 'center',
    marginBottom: 48, fontStyle: 'italic',
  },
  errorBox: {
    backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center' },
  successBox: {
    backgroundColor: '#E8F4EF', borderRadius: 14, padding: 24,
    marginBottom: 32, borderWidth: 1, borderColor: '#CAE0D8',
  },
  successTitle: {
    fontSize: 20, fontWeight: '700', color: '#2D6A4F',
    marginBottom: 12, textAlign: 'center',
  },
  successText: {
    fontSize: 15, color: '#52796F', lineHeight: 22, textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    fontSize: 16, color: '#2D3A35', marginBottom: 12,
    borderWidth: 1, borderColor: '#CAE0D8',
  },
  button: {
    backgroundColor: '#2D6A4F', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#52796F', textAlign: 'center', fontSize: 14 },
})