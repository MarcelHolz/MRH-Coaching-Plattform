import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [coachie, setCoachie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [istErsterLogin, setIstErsterLogin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
        if (!newSession) {
          setCoachie(null)
          setLoading(false)
        }
      },
    )

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return

    let cancelled = false
    setLoading(true)

    supabase
      .from('coachies')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Fehler beim Laden der Coachie-Daten:', error)
        }
        setCoachie(data ?? null)
        setLoading(false)

        // Erster Login erkennen: kein bisheriger Zeitstempel vorhanden.
        // Wird einmalig gesetzt und nie wieder verändert (siehe Migration
        // erster_login.sql). istErsterLogin bleibt für diese Sitzung bis
        // zum Konsum durch die Dashboard-Weiterleitung bestehen.
        if (data && !data.erster_login_am) {
          setIstErsterLogin(true)
          supabase
            .from('coachies')
            .update({ erster_login_am: new Date().toISOString() })
            .eq('id', session.user.id)
            .then(({ error: updateError }) => {
              if (updateError) {
                console.error('Fehler beim Setzen von erster_login_am:', updateError)
              }
            })
        }
      })

    return () => {
      cancelled = true
    }
  }, [session])

  // Lädt die coachies-Zeile neu, z. B. nachdem EinstellungenPage.jsx das
  // Profilbild aktualisiert hat -- damit der Header (CoachieLayout.jsx)
  // ohne Reload das neue Bild zeigt.
  async function refreshCoachie() {
    if (!session?.user) return
    const { data } = await supabase
      .from('coachies')
      .select('*')
      .eq('id', session.user.id)
      .single()
    setCoachie(data ?? null)
  }

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setCoachie(null)
  }

  function konsumiereErstenLogin() {
    setIstErsterLogin(false)
  }

  const value = {
    session,
    coachie,
    loading,
    isAuthenticated: !!session,
    istErsterLogin,
    konsumiereErstenLogin,
    login,
    logout,
    refreshCoachie,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth muss innerhalb eines AuthProvider verwendet werden.')
  }
  return context
}
