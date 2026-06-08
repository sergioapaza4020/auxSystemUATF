import Cookies from 'js-cookie'

export const getAccessToken = () => Cookies.get('accessToken')

export const getRefreshToken = () => Cookies.get('refreshToken')

export const setAccessToken = (accessToken: string) =>
  Cookies.set('accessToken', accessToken, {
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  })

export const setRefreshToken = (refreshToken: string) =>
  Cookies.set('refreshToken', refreshToken, {
    expires: 7,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  })

export const saveTokens = (accessToken: string, refreshToken: string) => {
  setAccessToken(accessToken)
  setRefreshToken(refreshToken)
}

export const clearTokens = () => {
  Cookies.remove('accessToken')
  Cookies.remove('refreshToken')
}
