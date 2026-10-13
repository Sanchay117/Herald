import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFS, PROFILES, profilePatch, sanitizePrefs } from '../lib/prefs.ts'

test('sanitizePrefs falls back to the defaults for anything that is not an object', () => {
  for (const junk of [null, undefined, 42, 'deaf', true, [], {}]) {
    assert.deepEqual(sanitizePrefs(junk), DEFAULT_PREFS, JSON.stringify(junk))
  }
})

test('sanitizePrefs keeps well-typed fields and replaces the rest with defaults', () => {
  const stored = { profile: 'blind', speak: false, flash: 'yes', vibrate: 0, minPriority: 'urgent', voiceRate: 1.2, extra: 1 }
  assert.deepEqual(sanitizePrefs(stored), {
    ...DEFAULT_PREFS,
    profile: 'blind',
    speak: false,
    minPriority: 'urgent',
    voiceRate: 1.2,
  })
})

test('sanitizePrefs rejects unknown profiles and priorities', () => {
  const prefs = sanitizePrefs({ profile: 'admin', minPriority: 'everything' })
  assert.equal(prefs.profile, null)
  assert.equal(prefs.minPriority, 'normal')
})

test('voice speed is clamped to 0.7 to 1.5', () => {
  assert.equal(sanitizePrefs({ voiceRate: 9 }).voiceRate, 1.5)
  assert.equal(sanitizePrefs({ voiceRate: 0.1 }).voiceRate, 0.7)
  assert.equal(sanitizePrefs({ voiceRate: Number.POSITIVE_INFINITY }).voiceRate, 1)
  assert.equal(sanitizePrefs({ voiceRate: '1.2' }).voiceRate, 1)
})

test('picking a profile applies its outputs; "Choose myself" keeps the current ones', () => {
  assert.deepEqual(profilePatch('deaf'), { profile: 'deaf', speak: false, flash: true, vibrate: true, announce: true })
  assert.deepEqual(profilePatch('blind'), { profile: 'blind', speak: true, flash: false, vibrate: true, announce: true })
  assert.deepEqual(profilePatch('deafblind'), { profile: 'deafblind', speak: false, flash: false, vibrate: true, announce: true })
  assert.deepEqual(profilePatch('custom'), { profile: 'custom' })
})

test('every profile leaves at least one output the person can perceive', () => {
  for (const [name, profile] of Object.entries(PROFILES)) {
    assert.ok(Object.values(profile.outputs).some(Boolean), name)
  }
  // Each profile must not rely on the sense it is for.
  assert.equal(PROFILES.deaf.outputs.speak, false)
  assert.equal(PROFILES.blind.outputs.flash, false)
  assert.equal(PROFILES.deafblind.outputs.speak, false)
  assert.equal(PROFILES.deafblind.outputs.flash, false)
})
