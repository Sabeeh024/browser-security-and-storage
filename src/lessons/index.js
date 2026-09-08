import StorageLab from './StorageLab.jsx'
import XssLab from './XssLab.jsx'
import CsrfLab from './CsrfLab.jsx'
import AuthTokenLab from './AuthTokenLab.jsx'
import HeadersCorsLab from './HeadersCorsLab.jsx'

// Add a line here as each lesson lands.
export const lessons = [
  { id: 'storage', title: '1 · Client-side storage', Component: StorageLab },
  { id: 'xss', title: '2 · XSS', Component: XssLab },
  { id: 'csrf', title: '3 · CSRF', Component: CsrfLab },
  { id: 'auth', title: '4 · Auth token storage', Component: AuthTokenLab },
  { id: 'headers', title: '5 · Headers & CORS', Component: HeadersCorsLab },
]
