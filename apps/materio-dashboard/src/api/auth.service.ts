import { type ILogin } from '@/interfaces/IAuth.interface'
import { instance } from '@/api/config'

export const Login = async ({ username, password }: ILogin): Promise<any> => {
  try {
    const response = await instance.post('/auth/login', { username, password })

    return response
  } catch (error: any) {
    console.error('Login failed:', error)
    throw error
  }
}

export const Logout = async (): Promise<any> => {
  try {
    const response = await instance.post('/auth/logout')

    return response
  } catch (error: any) {
    console.error('Logout failed:', error)
    throw error
  }
}
