import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Admin from './pages/Admin.jsx'
import NotFound from './pages/NotFound.jsx'

const root = createRoot(document.getElementById('root'))
const path = window.location.pathname

if (path === '/admin') {
  root.render(<StrictMode><Admin /></StrictMode>)
} else if (path === '/') {
  root.render(<StrictMode><App /></StrictMode>)
} else {
  root.render(<StrictMode><NotFound /></StrictMode>)
}
