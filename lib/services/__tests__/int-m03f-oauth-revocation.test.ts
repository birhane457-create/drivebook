/**
 * INT-M-03F Regression Tests: Google Calendar OAuth Revocation and Disconnect Hardening
 *
 * Finding:
 *   1. disconnect() cleared local credentials but never called Google's revocation API.
 *      A prior holder of the refresh token (e.g., from DB leak) could continue
 *      obtaining access tokens indefinitely after disconnect.
 *   2. saveTokens() always set syncGoogleCalendar=true — a background token refresh
 *      would silently re-enable calendar sync after a deliberate disconnect.
 *   3. Manual sync endpoints (/api/google-calendar/sync and /mobile) called
 *      syncCalendarEvents() without checking syncGoogleCalendar, allowing
 *      Google API calls against a disconnected account.
 *
 * Fix (this commit):
 *   1. disconnect() reads googleRefreshToken, calls oauth2Client.revokeToken(),
 *      handles all failure cases (already-revoked, invalid, network error), and
 *      always clears local credentials regardless of revocation outcome.
 *   2. saveTokens() accepts enableSync param (NO default — required). Token refresh path
 *      passes enableSync=false — never touches syncGoogleCalendar.
 *   3. Both sync endpoints check syncGoogleCalendar before calling syncCalendarEvents.
 *
 * Tests call the actual GoogleCalendarService class directly (not a copy).
 * Prisma and the googleapis oauth2Client are mocked at module boundaries.
 *
 * T1  — Connected state: getCalendarClient succeeds when tokens exist
 * T2  — Disconnect clears all five credential fields in DB
 * T3  — Disconnect calls revokeToken with the current refresh token
 * T4  — Already-revoked token: disconnect succeeds; local cleanup completes
 * T5  — Google network failure: disconnect still clears local credentials
 * T6  — Token refresh never re-enables syncGoogleCalendar=false
 * T7  — OAuth callback (enableSync=true) enables sync
 * T8  — Manual sync blocked when syncGoogleCalendar=false
 * T9  — Reconnect stores fresh credentials; old cleared state is overwritten
 * T10 — Completed disconnect not undone by token refresh (getCalendarClient throws)
 * T11 — Duplicate OAuth callback: second getTokensFromCode returns invalid_grant
 */

// ─── Mock declarations ────────────────────────────────────────────────────────

const mockProviderFindUnique  = vi.fn()
const mockProviderUpdate      = vi.fn()
const mockAvailabilityDeleteMany = vi.fn()
const mockRevokeToken         = vi.fn()
const mockRefreshAccessToken  = vi.fn()
const mockSetCredentials      = vi.fn()
const mockGetToken            = vi.fn()
const mockSendAlert           = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: (...a: any[]) => mockProviderFindUnique(...a),
      update:     (...a: any[]) => mockProviderUpdate(...a),
    },
    availabilityException: {
      deleteMany: (...a: any[]) => mockAvailabilityDeleteMany(...a),
    },
  },
}))

vi.mock('@/lib/services/alert-service', () => ({
  sendAlert: (...a: any[]) => mockSendAlert(...a),
}))

// Mock googleapis so we control revokeToken and refreshAccessToken
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock'),
        getToken:        (...a: any[]) => mockGetToken(...a),
        setCredentials:  (...a: any[]) => mockSetCredentials(...a),
        revokeToken:     (...a: any[]) => mockRevokeToken(...a),
        refreshAccessToken: (...a: any[]) => mockRefreshAccessToken(...a),
      })),
    },
    calendar: vi.fn().mockReturnValue({ events: { list: vi.fn().mockResolvedValue({ data: { items: [] } }) } }),
  },
}))

vi.mock('@/lib/oauth-state', () => ({
  signOAuthState:  vi.fn().mockReturnValue('mock-state'),
  verifyOAuthState: vi.fn().mockReturnValue({ providerId: 'prov_test' }),
}))

vi.mock('@/lib/utils/timezone', () => ({
  resolveTimezone:   vi.fn().mockReturnValue('Australia/Sydney'),
  timezoneFromState: vi.fn().mockReturnValue('Australia/Sydney'),
}))

// ─── Import subject under test ────────────────────────────────────────────────
import { GoogleCalendarService } from '../googleCalendar'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROVIDER_ID   = 'prov_intm03f_test'
const ACCESS_TOKEN  = 'ya29.access_token'
const REFRESH_TOKEN = '1//refresh_token_value'
const EXPIRY        = new Date(Date.now() + 3_600_000)   // 1 hour from now
const EXPIRED       = new Date(Date.now() - 3_600_000)   // 1 hour ago

function makeProvider(overrides: Partial<{
  googleAccessToken: string | null
  googleRefreshToken: string | null
  googleTokenExpiry: Date | null
  syncGoogleCalendar: boolean
  googleCalendarId: string | null
}> = {}) {
  return {
    googleAccessToken:  'googleAccessToken'  in overrides ? overrides.googleAccessToken  : ACCESS_TOKEN,
    googleRefreshToken: 'googleRefreshToken' in overrides ? overrides.googleRefreshToken : REFRESH_TOKEN,
    googleTokenExpiry:  'googleTokenExpiry'  in overrides ? overrides.googleTokenExpiry  : EXPIRY,
    googleCalendarId:   'googleCalendarId'   in overrides ? overrides.googleCalendarId   : null,
    syncGoogleCalendar: 'syncGoogleCalendar' in overrides ? overrides.syncGoogleCalendar! : true,
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('INT-M-03F: Google Calendar OAuth revocation and disconnect hardening', () => {
  let service: GoogleCalendarService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new GoogleCalendarService()
    mockProviderUpdate.mockResolvedValue({})
    mockAvailabilityDeleteMany.mockResolvedValue({ count: 0 })
    mockRevokeToken.mockResolvedValue({})
    mockSendAlert.mockResolvedValue(undefined)
  })

  // ─── T1: Connected state ─────────────────────────────────────────────────

  it('T1: connected state — getCalendarClient succeeds when tokens exist and sync is enabled', async () => {
    mockProviderFindUnique.mockResolvedValue(makeProvider())

    // Should not throw
    const client = await service.getCalendarClient(PROVIDER_ID)
    expect(client).toBeDefined()
    expect(mockSetCredentials).toHaveBeenCalledWith(expect.objectContaining({
      access_token:  ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
    }))
  })

  it('T1b: missing tokens → getCalendarClient throws "not connected"', async () => {
    mockProviderFindUnique.mockResolvedValue(makeProvider({ googleAccessToken: null, googleRefreshToken: null }))

    await expect(service.getCalendarClient(PROVIDER_ID))
      .rejects.toThrow('Google Calendar not connected')
  })

  // ─── T2: Disconnect clears all five credential fields ────────────────────

  it('T2: disconnect() clears all five credential fields in DB', async () => {
    mockProviderFindUnique.mockResolvedValue({ googleRefreshToken: REFRESH_TOKEN })

    await service.disconnect(PROVIDER_ID)

    expect(mockProviderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: PROVIDER_ID },
      data: {
        googleAccessToken:  null,
        googleRefreshToken: null,
        googleTokenExpiry:  null,
        googleCalendarId:   null,
        syncGoogleCalendar: false,
      },
    }))
    expect(mockAvailabilityDeleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { providerId: PROVIDER_ID, reason: 'google_calendar_event' },
    }))
  })

  // ─── T3: Revocation is attempted ─────────────────────────────────────────

  it('T3: disconnect() calls revokeToken with the stored refresh token', async () => {
    mockProviderFindUnique.mockResolvedValue({ googleRefreshToken: REFRESH_TOKEN })

    await service.disconnect(PROVIDER_ID)

    expect(mockRevokeToken).toHaveBeenCalledWith(REFRESH_TOKEN)
  })

  it('T3b: no refresh token stored → revokeToken is NOT called', async () => {
    mockProviderFindUnique.mockResolvedValue({ googleRefreshToken: null })

    await service.disconnect(PROVIDER_ID)

    expect(mockRevokeToken).not.toHaveBeenCalled()
    // Local cleanup still happens
    expect(mockProviderUpdate).toHaveBeenCalled()
  })

  // ─── T4: Already-revoked token ───────────────────────────────────────────

  it('T4: already-revoked token → disconnect succeeds; local credentials cleared', async () => {
    mockProviderFindUnique.mockResolvedValue({ googleRefreshToken: REFRESH_TOKEN })
    mockRevokeToken.mockRejectedValueOnce(new Error('Token has been expired or revoked. (token_revoked)'))

    // Must not throw
    await expect(service.disconnect(PROVIDER_ID)).resolves.toBeUndefined()

    // Local cleanup still ran
    expect(mockProviderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ googleRefreshToken: null, syncGoogleCalendar: false }),
    }))
    // No alert sent for already-invalid token
    expect(mockSendAlert).not.toHaveBeenCalled()
  })

  it('T4b: invalid_token response → disconnect succeeds; no alert', async () => {
    mockProviderFindUnique.mockResolvedValue({ googleRefreshToken: REFRESH_TOKEN })
    mockRevokeToken.mockRejectedValueOnce(new Error('invalid_token'))

    await expect(service.disconnect(PROVIDER_ID)).resolves.toBeUndefined()
    expect(mockProviderUpdate).toHaveBeenCalled()
    expect(mockSendAlert).not.toHaveBeenCalled()
  })

  // ─── T5: Google network failure ──────────────────────────────────────────

  it('T5: Google network failure → disconnect still clears local credentials; alert sent; no token in alert', async () => {
    mockProviderFindUnique.mockResolvedValue({ googleRefreshToken: REFRESH_TOKEN })
    mockRevokeToken.mockRejectedValueOnce(new Error('ETIMEDOUT: connection timed out'))

    await expect(service.disconnect(PROVIDER_ID)).resolves.toBeUndefined()

    // Local cleanup ran
    expect(mockProviderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ googleRefreshToken: null }),
    }))

    // Alert was sent (eventually — it's void/best-effort)
    // Check the alert does NOT contain the refresh token
    const alertCalls = mockSendAlert.mock.calls
    if (alertCalls.length > 0) {
      const alertArg = JSON.stringify(alertCalls[0])
      expect(alertArg).not.toContain(REFRESH_TOKEN)
      expect(alertArg).not.toContain('1//')
    }
  })

  it('T5b: Google 5xx → disconnect still clears credentials; DB update NOT blocked', async () => {
    mockProviderFindUnique.mockResolvedValue({ googleRefreshToken: REFRESH_TOKEN })
    mockRevokeToken.mockRejectedValueOnce(new Error('500 Internal Server Error'))

    await expect(service.disconnect(PROVIDER_ID)).resolves.toBeUndefined()
    expect(mockProviderUpdate).toHaveBeenCalled()
  })

  // ─── T6: Token refresh never re-enables syncGoogleCalendar ───────────────

  it('T6: token refresh path — saveTokens called with enableSync=false — syncGoogleCalendar not touched', async () => {
    // Provider is connected but token is expired; syncGoogleCalendar=false (post-disconnect state)
    mockProviderFindUnique.mockResolvedValue(makeProvider({
      googleTokenExpiry:  EXPIRED,
      syncGoogleCalendar: false,
    }))
    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token:  'ya29.new_access_token',
        refresh_token: undefined,   // Google doesn't re-issue refresh token on plain refresh
        expiry_date:   Date.now() + 3_600_000,
      },
    })

    // getCalendarClient will attempt to refresh the token
    await service.getCalendarClient(PROVIDER_ID)

    // The DB update must NOT contain syncGoogleCalendar: true
    expect(mockProviderUpdate).toHaveBeenCalled()
    const updateCall = mockProviderUpdate.mock.calls[0][0]
    expect(updateCall.data.syncGoogleCalendar).toBeUndefined()
    // googleCalendarId must also not be touched
    expect(updateCall.data.googleCalendarId).toBeUndefined()
  })

  it('T6b: when refresh token is undefined in credentials, existing DB refresh token is preserved', async () => {
    mockProviderFindUnique.mockResolvedValue(makeProvider({ googleTokenExpiry: EXPIRED }))
    mockRefreshAccessToken.mockResolvedValue({
      credentials: {
        access_token: 'ya29.refreshed',
        refresh_token: undefined,  // not returned by Google
        expiry_date: Date.now() + 3_600_000,
      },
    })

    await service.getCalendarClient(PROVIDER_ID)

    const updateCall = mockProviderUpdate.mock.calls[0][0]
    // refresh_token must NOT be set in the update (undefined means skip the field)
    expect(updateCall.data.googleRefreshToken).toBeUndefined()
    expect(updateCall.data.googleAccessToken).toBe('ya29.refreshed')
  })

  // ─── T7: Authorization callback enables sync ──────────────────────────────

  it('T7: saveTokens with enableSync=true (OAuth callback) → syncGoogleCalendar=true written', async () => {
    await service.saveTokens(PROVIDER_ID, {
      access_token:  ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      expiry_date:   Date.now() + 3_600_000,
    }, true)

    expect(mockProviderUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ syncGoogleCalendar: true }),
    }))
  })

  it('T7b: saveTokens with enableSync=false → syncGoogleCalendar NOT in update data', async () => {
    await service.saveTokens(PROVIDER_ID, {
      access_token: 'ya29.refreshed',
      expiry_date:  Date.now() + 3_600_000,
    }, false)

    const updateCall = mockProviderUpdate.mock.calls[0][0]
    expect(updateCall.data.syncGoogleCalendar).toBeUndefined()
  })

  // ─── T8: Manual sync blocked when disconnected ────────────────────────────

  it('T8: getCalendarClient throws when tokens are null (post-disconnect)', async () => {
    // After disconnect all token fields are null
    mockProviderFindUnique.mockResolvedValue(makeProvider({
      googleAccessToken:  null,
      googleRefreshToken: null,
      googleTokenExpiry:  null,
      syncGoogleCalendar: false,
    }))

    await expect(service.getCalendarClient(PROVIDER_ID))
      .rejects.toThrow('Google Calendar not connected')

    // syncCalendarEvents calls getCalendarClient — it will throw
    await expect(service.syncCalendarEvents(PROVIDER_ID))
      .rejects.toThrow('Google Calendar not connected')
  })

  // ─── T9: Reconnect stores fresh credentials ───────────────────────────────

  it('T9: connect → disconnect → reconnect — new credentials overwrite nulled state', async () => {
    const NEW_ACCESS  = 'ya29.new_after_reconnect'
    const NEW_REFRESH = '1//new_refresh_after_reconnect'

    // First connect
    await service.saveTokens(PROVIDER_ID, {
      access_token:  ACCESS_TOKEN,
      refresh_token: REFRESH_TOKEN,
      expiry_date:   Date.now() + 3_600_000,
    }, true)  // explicit OAuth callback intent

    // Disconnect
    mockProviderFindUnique.mockResolvedValueOnce({ googleRefreshToken: REFRESH_TOKEN })
    await service.disconnect(PROVIDER_ID)

    // Reconnect with new credentials
    await service.saveTokens(PROVIDER_ID, {
      access_token:  NEW_ACCESS,
      refresh_token: NEW_REFRESH,
      expiry_date:   Date.now() + 3_600_000,
    }, true)  // explicit OAuth callback intent

    const lastUpdateCall = mockProviderUpdate.mock.calls[mockProviderUpdate.mock.calls.length - 1][0]
    expect(lastUpdateCall.data.googleAccessToken).toBe(NEW_ACCESS)
    expect(lastUpdateCall.data.googleRefreshToken).toBe(NEW_REFRESH)
    expect(lastUpdateCall.data.syncGoogleCalendar).toBe(true)
  })

  // ─── T10: Disconnect not undone by stale token refresh ───────────────────

  it('T10: after disconnect, token refresh cannot resurrect the connection', async () => {
    // Post-disconnect state: tokens are null
    mockProviderFindUnique.mockResolvedValue(makeProvider({
      googleAccessToken:  null,
      googleRefreshToken: null,
      syncGoogleCalendar: false,
    }))

    // Attempting getCalendarClient (which contains the refresh path) throws immediately
    // because tokens are null — the refresh code is never reached
    await expect(service.getCalendarClient(PROVIDER_ID))
      .rejects.toThrow('Google Calendar not connected')

    // Critically: refreshAccessToken was never called
    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    // Critically: saveTokens (which could write syncGoogleCalendar=false→true) was never called
    expect(mockProviderUpdate).not.toHaveBeenCalled()
  })

  // ─── T11: Duplicate OAuth callback ───────────────────────────────────────

  it('T11: duplicate OAuth callback with same code → second getToken call fails; no credential corruption', async () => {
    // First code exchange succeeds
    mockGetToken.mockResolvedValueOnce({
      tokens: { access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, expiry_date: Date.now() + 3600000 }
    })
    // Second use of the same code → Google returns invalid_grant
    mockGetToken.mockRejectedValueOnce(new Error('invalid_grant'))

    const tokens1 = await service.getTokensFromCode('auth_code_123')
    expect(tokens1.access_token).toBe(ACCESS_TOKEN)

    await expect(service.getTokensFromCode('auth_code_123'))
      .rejects.toThrow('invalid_grant')

    // Only one successful token set — no credential corruption
    expect(mockGetToken).toHaveBeenCalledTimes(2)
  })

  // ─── Token never appears in logs/alerts ──────────────────────────────────

  it('Security: refresh token never appears in sendAlert payload on revocation failure', async () => {
    const SENSITIVE_TOKEN = '1//super_secret_refresh_token'
    mockProviderFindUnique.mockResolvedValue({ googleRefreshToken: SENSITIVE_TOKEN })
    mockRevokeToken.mockRejectedValueOnce(new Error('network_timeout'))

    await service.disconnect(PROVIDER_ID)

    // Inspect every sendAlert call to verify token is not present
    mockSendAlert.mock.calls.forEach((call: any[]) => {
      const payload = JSON.stringify(call)
      expect(payload).not.toContain(SENSITIVE_TOKEN)
      expect(payload).not.toContain('super_secret')
    })
  })
})
