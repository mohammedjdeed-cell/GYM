import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { init } from './store'

void init()
createRoot(document.getElementById('root')!).render(<App />)
