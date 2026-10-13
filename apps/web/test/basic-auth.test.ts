import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBasicAuth, secretsMatch } from '../lib/server/basic-auth.ts'

const basic = (s: string) => `Basic ${Buffer.from(s, 'utf8').toString('base64')}`

test('parses user and password, splitting at the first colon', () => {
  assert.deepEqual(parseBasicAuth(basic('herald:open sesame')), { user: 'herald', password: 'open sesame' })
  assert.deepEqual(parseBasicAuth(basic(':a:b:c')), { user: '', password: 'a:b:c' })
})

test('decodes UTF-8 passwords', () => {
  assert.deepEqual(parseBasicAuth(basic('दरवाज़ा:घंटी🔔')), { user: 'दरवाज़ा', password: 'घंटी🔔' })
})

test('rejects missing, non-Basic and malformed headers', () => {
  for (const header of [null, '', 'Bearer abc', 'Basic', 'Basic !!!', basic('no-colon'), 'Basic /w==']) {
    assert.equal(parseBasicAuth(header), null, String(header))
  }
})

test('secretsMatch is true only for identical strings', async () => {
  assert.equal(await secretsMatch('correct horse', 'correct horse'), true)
  assert.equal(await secretsMatch('correct horse', 'correct hors'), false)
  assert.equal(await secretsMatch('', 'x'), false)
  assert.equal(await secretsMatch('Correct horse', 'correct horse'), false)
})
