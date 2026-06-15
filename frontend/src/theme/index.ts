import type { ThemePref } from '@/types/auth'

const STORAGE_KEY = 'kyt-theme'

export function getStoredTheme(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Apply a theme preference to <html> and persist it. */
export function applyTheme(pref: ThemePref): void {
  localStorage.setItem(STORAGE_KEY, pref)
  const dark = pref === 'dark' || (pref === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null

/** Keep the theme in sync with OS preference while in 'system' mode. */
export function watchSystemTheme(pref: ThemePref): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  if (mediaListener) mq.removeEventListener('change', mediaListener)
  if (pref === 'system') {
    mediaListener = () => applyTheme('system')
    mq.addEventListener('change', mediaListener)
  } else {
    mediaListener = null
  }
}

/** Initialise the theme as early as possible (before React renders). */
export function initTheme(): void {
  const pref = getStoredTheme()
  applyTheme(pref)
  watchSystemTheme(pref)
}
