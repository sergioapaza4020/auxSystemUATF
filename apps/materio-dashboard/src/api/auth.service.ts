import { type ILogin } from '@/interfaces/IAuth.interface'

import { instance } from '@/api/config'

import { clearTokens, getRefreshToken, saveTokens } from '@/utils/auth-cookies'

export const Login = async ({ username, password }: ILogin): Promise<any> => {
  try {
    const response = await instance.post('/auth/login', { username, password })

    const { accessToken, refreshToken } = response.data.data

    saveTokens(accessToken, refreshToken)

    return response.data
  } catch (error: any) {
    console.error('Login failed:', error)
    throw error
  }
}

export const Logout = async (): Promise<void> => {
  const refreshToken = getRefreshToken()

  if (refreshToken) {
    try {
      await instance.post('/sessions/logout', { refreshToken })
    } catch (error: any) {
      console.error('Logout failed:', error)
      throw error
    }
  }

  clearTokens()
}
