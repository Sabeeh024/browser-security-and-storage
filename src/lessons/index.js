import StorageLab from './StorageLab.jsx'
import XssLab from './XssLab.jsx'
import CsrfLab from './CsrfLab.jsx'

// Add a line here as each lesson lands.
export const lessons = [
  { id: 'storage', title: '1 · Client-side storage', Component: StorageLab },
  { id: 'xss', title: '2 · XSS', Component: XssLab },
  { id: 'csrf', title: '3 · CSRF', Component: CsrfLab },
]
