import { instance } from '../config'

export const responseErrorInterceptor = (error: any) => {
  console.error('Response error:', error)

  return Promise.reject(error)
}

instance.interceptors.response.use(response => response, responseErrorInterceptor)
