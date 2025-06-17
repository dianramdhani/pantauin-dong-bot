import 'dotenv/config'
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { search } from './api'

describe('test api', () => {
  test('search', async () => {
    const data = await search({ q: 'vivo v50 12/256', source: 'search' })
    console.log(data)
    assert.ok(data)
  })
})
