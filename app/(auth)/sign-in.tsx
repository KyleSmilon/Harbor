import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()

  async function handleSignIn() {
    setErrorMessage('')

    if (!email || !password) {
      setErrorMessage('Please enter your email and password.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error || !data.session) {
      if (error?.message.includes('Email not confirmed')) {
        setErrorMessage('Please confirm your email before signing in.')
      } else if (error?.message.includes('Too many requests')) {
        setErrorMessage('Too many attempts. Please wait a moment.')
      } else {
        setErrorMessage('Incorrect email or password. Please try again.')
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Harbor</Text>
        <Text style={styles.tagline}>You don't have to do this alone.</Text>

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
          placeholder="Password"
          placeholderTextColor="#9DB5AA"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={styles.link}>Don't have an account? Sign up</Text>
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