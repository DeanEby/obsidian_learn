---
uuid: 2a15aeda-4926-4256-bcdf-bb3f36dfde1f
---


[[Python]]
https://youtu.be/5aYpkLfkgRE

What is flask?
Web Application Framework that is written in python
It feels like python
`pip install flask`
`pip install requests`


python file:
``` python
from flask import Flask

# specifies that all the files we need are in the current directory
app = Flask(__name__)

# when someone visits the root of the website, do some stuff below
@app.route("/")

def index():
	return"
```

https://claude.ai/share/720a752a-9450-4bc6-856f-6ea3d588baa8




```
// src/App.jsx
import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch data from Flask backend
    axios.get('/api/hello')
      .then(response => {
        setMessage(response.data.message)
        setLoading(false)
      })
      .catch(error => {
        console.error("Error fetching data:", error)
        setLoading(false)
      })
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>Flask + React App with Vite</h1>
        {loading ? (
          <p>Loading message from backend...</p>
        ) : (
          <p>Message from backend: {message}</p>
        )}
      </header>
    </div>
  )
}

export default App
```



## 4. Development Workflow

During development, you'll run both servers:

1. Run the Flask backend:

bash

Copy

`# Navigate to backend directory cd backend source venv/bin/activate  # or venv\Scripts\activate on Windows python app.py`

2. In a separate terminal, run the Vite development server:

bash

Copy

`# Navigate to frontend directory cd frontend npm run dev`

Vite will typically start the development server on port 5173, and the proxy configuration will forward API requests to Flask on port 5000.

https://claude.ai/chat/4e510df7-3e0b-415c-b0b3-591e7f14c6b5