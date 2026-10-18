import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import LoginPage from './pages/LoginPage'
import Repository from './pages/Repository'
import SetupPage from './pages/SetupPage'
import TagDetail from './pages/TagDetail'
import { api, setUnauthorizedHandler } from './api'

type Gate = 'loading' | 'setup' | 'login' | 'ready'

export default function App() {
  const [gate, setGate] = useState<Gate>('loading')
  const [username, setUsername] = useState('')

  useEffect(() => {
    api.auth
      .status()
      .then((st) => {
        if (st.authDisabled) {
          setGate('ready')
          return
        }
        if (!st.initialized) {
          setGate('setup')
          return
        }
        if (!st.authenticated) {
          setGate('login')
          return
        }
        setUsername(st.username ?? '')
        setGate('ready')
      })
      .catch(() => setGate('login'))

    setUnauthorizedHandler(() => {
      setUsername('')
      setGate('login')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  if (gate === 'loading') {
    return (
      <div className="auth-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (gate === 'setup') {
    return (
      <SetupPage
        onDone={(user) => {
          setUsername(user)
          setGate('ready')
        }}
      />
    )
  }

  if (gate === 'login') {
    return (
      <LoginPage
        onDone={(user) => {
          setUsername(user)
          setGate('ready')
        }}
      />
    )
  }

  return (
    <Layout
      username={username}
      onLogout={() => {
        setUsername('')
        setGate('login')
      }}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/repo/:name" element={<Repository />} />
        <Route path="/repo/:name/:ref" element={<TagDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
