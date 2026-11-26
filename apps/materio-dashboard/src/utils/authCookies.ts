import Cookies from 'js-cookie';

// Keep short-lived access credentials in memory. The refresh credential is
// issued by the same-origin server handler as an HttpOnly cookie.
let accessToken: string | null = null;

export const getAccessToken = () => accessToken ?? undefined;

/** Only used to detect a legacy cookie during the one-way migration. */
export const getRefreshToken = () => Cookies.get('refreshToken');

export const setAccessToken = (token: string) => {
  accessToken = token;
};

export const saveTokens = (token: string) => setAccessToken(token);

export const clearTokens = () => {
  accessToken = null;

  // Remove cookies created by older frontend versions after the server handler
  // has had an opportunity to migrate/revoke them.
  Cookies.remove('accessToken');
  Cookies.remove('refreshToken');
};
