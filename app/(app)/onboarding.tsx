import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

const RELATIONSHIPS = ['Child', 'Spouse', 'Sibling', 'Parent', 'Friend', 'Other']
const SUPPORT_OPTIONS = ['Doing this alone', 'Some family help', 'Shared with family']
const CHALLENGES = [
  'Emotional stress & burnout',
  'Managing medications & appointments',
  'Balancing work and caregiving',
  'Communication with other family',
  'Financial strain',
  'Watching their decline',
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [recipientName, setRecipientName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [durationMonths, setDurationMonths] = useState('')
  const [biggestChallenge, setBiggestChallenge] = useState('')
  const [supportSituation, setSupportSituation] = useState('')
  const [currentFeeling, setCurrentFeeling] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleFinish() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { error } = await supabase.from('care_profiles').insert({
        user_id: user.id,
        care_recipient_name: recipientName,
        relationship: relationship.toLowerCase(),
        duration_months: parseInt(durationMonths) || 0,
        biggest_challenge: biggestChallenge,
        support_situation: supportSituation,
        current_feeling: currentFeeling,
      })

      if (error) throw error
      router.replace('/(app)/chat')
    } catch (err: any) {
      Alert.alert('Something went wrong', err.message)
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    // Step 0 — who they're caring for
    <View key={0} style={styles.stepContainer}>
      <Text style={styles.stepLabel}>Step 1 of 5</Text>
      <Text style={styles.question}>Who are you caring for?</Text>
      <Text style={styles.subtitle}>This helps Harbor understand your situation from the start.</Text>
      <TextInput
        style={styles.input}
        placeholder="Their first name"
        placeholderTextColor="#9DB5AA"
        value={recipientName}
        onChangeText={setRecipientName}
        autoCapitalize="words"
      />
      <Text style={styles.subQuestion}>Your relationship to them</Text>
      <View style={styles.optionGrid}>
        {RELATIONSHIPS.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, relationship === r && styles.chipSelected]}
            onPress={() => setRelationship(r)}
          >
            <Text style={[styles.chipText, relationship === r && styles.chipTextSelected]}>
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 1 — how long
    <View key={1} style={styles.stepContainer}>
      <Text style={styles.stepLabel}>Step 2 of 5</Text>
      <Text style={styles.question}>How long have you been caregiving?</Text>
      <Text style={styles.subtitle}>There's no right or wrong answer — every journey is different.</Text>
      <TextInput
        style={styles.input}
        placeholder="Approximate months (e.g. 6)"
        placeholderTextColor="#9DB5AA"
        value={durationMonths}
        onChangeText={setDurationMonths}
        keyboardType="number-pad"
      />
    </View>,

    // Step 2 — biggest challenge
    <View key={2} style={styles.stepContainer}>
      <Text style={styles.stepLabel}>Step 3 of 5</Text>
      <Text style={styles.question}>What's been the hardest part?</Text>
      <Text style={styles.subtitle}>Harbor will keep this in mind when you need support.</Text>
      <View style={styles.optionList}>
        {CHALLENGES.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.optionRow, biggestChallenge === c && styles.optionRowSelected]}
            onPress={() => setBiggestChallenge(c)}
          >
            <Text style={[styles.optionText, biggestChallenge === c && styles.optionTextSelected]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 3 — support situation
    <View key={3} style={styles.stepContainer}>
      <Text style={styles.stepLabel}>Step 4 of 5</Text>
      <Text style={styles.question}>Are you doing this alone?</Text>
      <Text style={styles.subtitle}>Many caregivers carry this without much help. Harbor sees that.</Text>
      <View style={styles.optionList}>
        {SUPPORT_OPTIONS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.optionRow, supportSituation === s && styles.optionRowSelected]}
            onPress={() => setSupportSituation(s)}
          >
            <Text style={[styles.optionText, supportSituation === s && styles.optionTextSelected]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 4 — how are they feeling today
    <View key={4} style={styles.stepContainer}>
      <Text style={styles.stepLabel}>Step 5 of 5</Text>
      <Text style={styles.question}>How are you feeling right now?</Text>
      <Text style={styles.subtitle}>Be honest — this is just for Harbor to understand where you're starting from.</Text>
      <View style={styles.feelingRow}>
        {[
          { value: 1, label: '😔' },
          { value: 2, label: '😟' },
          { value: 3, label: '😐' },
          { value: 4, label: '🙂' },
          { value: 5, label: '😊' },
        ].map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.feelingButton, currentFeeling === f.value && styles.feelingButtonSelected]}
            onPress={() => setCurrentFeeling(f.value)}
          >
            <Text style={styles.feelingEmoji}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.feelingLabel}>
        {currentFeeling === 1 ? 'Really struggling' :
         currentFeeling === 2 ? 'Not great' :
         currentFeeling === 3 ? 'Getting by' :
         currentFeeling === 4 ? 'Doing okay' :
         currentFeeling === 5 ? 'Feeling good' : 'Tap to select'}
      </Text>
    </View>,
  ]

  function canAdvance() {
    if (step === 0) return recipientName.trim().length > 0 && relationship.length > 0
    if (step === 1) return durationMonths.trim().length > 0
    if (step === 2) return biggestChallenge.length > 0
    if (step === 3) return supportSituation.length > 0
    if (step === 4) return currentFeeling > 0
    return false
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Harbor</Text>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / 5) * 100}%` }]} />
        </View>

        {steps[step]}

        <View style={styles.navRow}>
          {step > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canAdvance() && styles.nextButtonDisabled,
              step === 0 && { marginLeft: 'auto' }
            ]}
            onPress={() => step < 4 ? setStep(s => s + 1) : handleFinish()}
            disabled={!canAdvance() || loading}
          >
            <Text style={styles.nextText}>
              {loading ? 'Saving...' : step < 4 ? 'Continue' : "Let's begin"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7F4' },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  logo: {
    fontSize: 28, fontWeight: '700', color: '#2D6A4F',
    marginBottom: 20, letterSpacing: -0.5,
  },
  progressBar: {
    height: 4, backgroundColor: '#CAE0D8', borderRadius: 2, marginBottom: 36,
  },
  progressFill: {
    height: 4, backgroundColor: '#2D6A4F', borderRadius: 2,
  },
  stepContainer: { flex: 1, marginBottom: 32 },
  stepLabel: { fontSize: 12, color: '#52796F', marginBottom: 8, fontWeight: '500' },
  question: { fontSize: 24, fontWeight: '700', color: '#1B3A2D', marginBottom: 8, lineHeight: 32 },
  subtitle: { fontSize: 15, color: '#52796F', marginBottom: 24, lineHeight: 22 },
  subQuestion: { fontSize: 15, color: '#2D3A35', marginBottom: 12, marginTop: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    fontSize: 16, color: '#2D3A35', marginBottom: 16,
    borderWidth: 1, borderColor: '#CAE0D8',
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#CAE0D8',
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  chipText: { fontSize: 14, color: '#52796F', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  optionList: { gap: 10 },
  optionRow: {
    padding: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#CAE0D8', backgroundColor: '#fff',
  },
  optionRowSelected: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  optionText: { fontSize: 15, color: '#52796F', fontWeight: '500' },
  optionTextSelected: { color: '#fff' },
  feelingRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16
  },
  feelingButton: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#CAE0D8',
    justifyContent: 'center', alignItems: 'center',
  },
  feelingButtonSelected: { borderColor: '#2D6A4F', backgroundColor: '#E8F4EF' },
  feelingEmoji: { fontSize: 28 },
  feelingLabel: { textAlign: 'center', color: '#52796F', fontSize: 14, minHeight: 20 },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  backButton: { paddingVertical: 14, paddingHorizontal: 20 },
  backText: { color: '#52796F', fontSize: 16 },
  nextButton: {
    flex: 1, backgroundColor: '#2D6A4F', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginLeft: 12,
  },
  nextButtonDisabled: { opacity: 0.4 },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})