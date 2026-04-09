import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import NotFound from './pages/NotFound.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const Admin = lazy(() => import('./pages/Admin.jsx'))

const root = createRoot(document.getElementById('root'))
const path = window.location.pathname

if (path === '/admin') {
  root.render(<StrictMode><ErrorBoundary><Suspense fallback={<div style={{display:'flex',justifyContent:'center',paddingTop:'4rem',color:'#888'}}>…</div>}><Admin /></Suspense></ErrorBoundary></StrictMode>)
} else if (path === '/') {
  root.render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>)
} else {
  root.render(<StrictMode><NotFound /></StrictMode>)
}
