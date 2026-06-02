import { getAccessToken } from '@/utils/auth-cookies'
import { instance } from '../config'

export const requestInterceptor = (config: any) => {
  const token = getAccessToken()

  if (token) config.headers.Authorization = `Bearer ${token}`

  return config
}

instance.interceptors.request.use(requestInterceptor)
