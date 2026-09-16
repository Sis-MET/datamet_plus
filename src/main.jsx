import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/figtree/wght.css'
import App from './App.jsx'
import { ThemeProvider } from './shared/context/ThemeProvider.jsx'
import './index.css'


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
