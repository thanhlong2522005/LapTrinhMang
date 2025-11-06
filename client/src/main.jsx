import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'      // <-- Import App.jsx của em
import './App.jsx'      // <-- Import CSS của em

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)