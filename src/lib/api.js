const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

/** A failed request, with a message that is safe to show the user. */
export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

let authToken = null
let onUnauthorized = () => {}

export function setAuthToken(token) {
  authToken = token
}

/** Called when the server rejects a token that was sent, meaning the session has ended. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

function describeFailure(error) {
  const first = error?.details?.[0]
  if (first) return `${first.field}: ${first.message}`
  return error?.message || 'Something went wrong. Please try again.'
}

/** Sends a request and returns the parsed response. Throws ApiError if it fails. */
export async function api(path, { method = 'GET', body } = {}) {
  const sentToken = authToken
  let response
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the Dokan server. Check that the API is running.', 0, 'NETWORK')
  }

  const json = await response.json().catch(() => null)
  if (!response.ok) {
    // Ignore a late rejection from a session that has since been replaced.
    if (response.status === 401 && sentToken && sentToken === authToken) onUnauthorized()
    throw new ApiError(describeFailure(json?.error), response.status, json?.error?.code, json?.error?.details)
  }
  return json
}

/** Fetches every page of a list. */
export async function apiAll(path) {
  const separator = path.includes('?') ? '&' : '?'
  const rows = []
  let page = 1
  let pages = 1
  do {
    const { data, pagination } = await api(`${path}${separator}limit=1000&page=${page}`)
    rows.push(...data)
    pages = pagination.pages
    page += 1
  } while (page <= pages)
  return rows
}
