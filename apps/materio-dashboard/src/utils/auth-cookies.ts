import Cookies from 'js-cookie'

const ACCESS_TOKEN_REFRESH_TIME = 1 / 24
const REFRESH_TOKEN_REFRESH_TIME = 7

export const saveTokens = (accessToken: string, refreshToken: string) => {
  Cookies.set('accessToken', accessToken, {
    expires: ACCESS_TOKEN_REFRESH_TIME,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  })
  Cookies.set('refreshToken', refreshToken, {
    expires: REFRESH_TOKEN_REFRESH_TIME,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  })
}

export const clearTokens = () => {
  Cookies.remove('accessToken')
  Cookies.remove('refreshToken')
}

export const getAccessToken = () => Cookies.get('accessToken')

export const getRefreshToken = () => Cookies.get('refreshToken')
