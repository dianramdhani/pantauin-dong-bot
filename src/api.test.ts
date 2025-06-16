import { search } from './api'

describe('test api', () => {
  test('search', async () => {
    const data = await search({ q: 'vivo v50 12/256', source: 'search' })
    console.log(data)
    expect(data).toBeTruthy()
  })
})
