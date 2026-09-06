import { useState } from 'react'
import { lessons } from './lessons'
import './App.css'

function App() {
  const [activeId, setActiveId] = useState(lessons[0].id)
  const active = lessons.find((l) => l.id === activeId) ?? lessons[0]

  return (
    <div className="layout">
      <nav>
        <h1>Browser Security &amp; Storage</h1>
        <ul>
          {lessons.map((l) => (
            <li key={l.id}>
              <button
                className={l.id === activeId ? 'active' : ''}
                onClick={() => setActiveId(l.id)}
              >
                {l.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main>
        <active.Component />
      </main>
    </div>
  )
}

export default App
