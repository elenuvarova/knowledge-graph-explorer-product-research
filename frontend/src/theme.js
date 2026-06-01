import { useSyncExternalStore } from 'react'

const KEY = 'kge-theme'
const listeners = new Set()
let current = null

function preferred() {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch { /* ignore */ }
  return 'dark'
}

export function getTheme() {
  if (current == null) {
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'light' || attr === 'dark') current = attr
    else {
      try {
        const stored = localStorage.getItem(KEY)
        current = stored === 'light' || stored === 'dark' ? stored : preferred()
      } catch { current = preferred() }
    }
  }
  return current
}

export function setTheme(theme) {
  current = theme
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// All useTheme() consumers stay in sync — toggling anywhere updates everywhere.
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark')
  return { theme, toggle: toggleTheme, setTheme }
}
