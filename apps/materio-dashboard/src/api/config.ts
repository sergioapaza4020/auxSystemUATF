import axios from 'axios'

import { getAccessToken } from '@/utils/auth-cookies'

export const instance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  timeout: 5000,
  withCredentials: true,
  headers: { 'X-Custom-Header': 'foobar' }
})

instance.interceptors.request.use((config: any) => {
  const token = getAccessToken()

  if (token) config.headers.Authorization = `Bearer ${token}`

  return config
})

instance.interceptors.response.use(
  response => response,
  error => {
    console.error('Response error:', error)

    return Promise.reject(error)
  }
)
