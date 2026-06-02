import axios from 'axios'

export const instance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  timeout: 5000,
  withCredentials: true,
  headers: { 'X-Custom-Header': 'foobar' }
})
