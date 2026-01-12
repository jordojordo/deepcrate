export interface AuthCredentials {
  username: string
  password: string
}

export interface AuthState {
  isAuthenticated: boolean
  username:        string | null
}
