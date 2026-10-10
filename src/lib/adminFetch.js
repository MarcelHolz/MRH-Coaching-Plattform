const ADMIN_TOKEN_STORAGE_KEY = 'mrh_admin_token'

export function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
}

export function setAdminToken(token) {
  sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
}

export function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
}

export async function adminFetch(path, options = {}) {
  const token = getAdminToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(path, { ...options, headers })

  if (response.status === 401) {
    // Beim Login selbst bedeutet 401 "falsche Zugangsdaten".
    if (path.startsWith('/api/admin/login')) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || 'Anmeldung fehlgeschlagen.')
    }
    // Sitzung abgelaufen oder Admin deaktiviert: zurück zum Login.
    clearAdminToken()
    if (!window.location.pathname.startsWith('/admin/login')) {
      window.location.assign('/admin/login')
    }
    throw new Error('Admin-Sitzung abgelaufen. Bitte erneut anmelden.')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || 'Ein Fehler ist aufgetreten.')
  }

  return data
}
