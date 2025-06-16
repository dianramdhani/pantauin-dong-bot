import { checkOut, getAddressId, login } from '../src/api'

describe('jtdc auto co', () => {
  test('login', async () => {
    const token = await login('lunar.enigma@gmx.com')
    console.log(token)
    expect(token).toBeTruthy()
  })

  test('getAddress', async () => {
    const addressId = await getAddressId(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NfdXVpZCI6Ijk4ZWQ3YjUwLWM2N2MtNGMyZC1hYzQ4LWRhMTRhODU3YTA0YSIsImFjY291bnRfZW1haWwiOiJsdW5hci5lbmlnbWFAZ214LmNvbSIsImFjY291bnRfaWQiOjgzODYxNSwiYWNjb3VudF90eXBlIjoiVVNFUiIsImV4cCI6MTc0OTc4NTUxMiwiaXNfbG9naW4iOnRydWV9.QpsX0wm_AHkxNLqGqCHzXHLw_2O1tMgeALs9xZKciDI'
    )
    console.log(addressId)
    expect(addressId).toBeTruthy()
  })

  test('checkout', async () => {
    const isSuccess = await checkOut({
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NfdXVpZCI6Ijk4ZWQ3YjUwLWM2N2MtNGMyZC1hYzQ4LWRhMTRhODU3YTA0YSIsImFjY291bnRfZW1haWwiOiJsdW5hci5lbmlnbWFAZ214LmNvbSIsImFjY291bnRfaWQiOjgzODYxNSwiYWNjb3VudF90eXBlIjoiVVNFUiIsImV4cCI6MTc0OTc4NTUxMiwiaXNfbG9naW4iOnRydWV9.QpsX0wm_AHkxNLqGqCHzXHLw_2O1tMgeALs9xZKciDI',
      addressId: 681613,
    })
    expect(isSuccess).toBeTruthy()
  })
})
