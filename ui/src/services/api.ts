import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add Basic auth from localStorage
client.interceptors.request.use((config) => {
  const credentials = localStorage.getItem('auth_credentials')
  if (credentials) {
    config.headers.Authorization = `Basic ${credentials}`
  }
  return config
})

// Response interceptor to handle 401 (redirect to login)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_credentials')
      localStorage.removeItem('auth_username')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
