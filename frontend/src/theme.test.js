import { describe, it, expect, beforeEach } from 'vitest'
import { getTheme, setTheme, toggleTheme } from './theme'

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('setTheme applies the data-theme attribute and persists it', () => {
    setTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('kge-theme')).toBe('light')
    expect(getTheme()).toBe('light')
  })

  it('toggleTheme flips between light and dark', () => {
    setTheme('dark')
    toggleTheme()
    expect(getTheme()).toBe('light')
    toggleTheme()
    expect(getTheme()).toBe('dark')
  })
})
