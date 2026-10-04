import { Context, MiddlewareHandler } from 'hono';
import { Bindings, User } from './types';

export interface AuthContext {
  user: User | null;
}

/**
 * Parses user credentials from Cookie header:
 * Supports format: `u=username&p=password` or standard `u=username; p=password`
 */
export function getCredentialsFromCookie(cookieHeader: string | undefined): { username: string; password: string } | null {
  if (!cookieHeader) return null;

  let username = '';
  let password = '';

  // Case 1: Raw combined string `u=username&p=password` in Cookie header
  if (cookieHeader.includes('&')) {
    const pairs = cookieHeader.split('&');
    for (const pair of pairs) {
      const [k, v] = pair.trim().split('=');
      if (k === 'u') username = decodeURIComponent(v || '');
      if (k === 'p') password = decodeURIComponent(v || '');
    }
  }

  // Case 2: Standard semicolon-delimited cookies `u=username; p=password`
  if (!username || !password) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const trimmed = pair.trim();
      if (trimmed.startsWith('u=') && !trimmed.includes('&')) {
        username = decodeURIComponent(trimmed.slice(2));
      } else if (trimmed.startsWith('p=') && !trimmed.includes('&')) {
        password = decodeURIComponent(trimmed.slice(2));
      } else if (trimmed.includes('u=') && trimmed.includes('&p=')) {
        // e.g. cookie like auth="u=admin&p=123"
        const inner = trimmed.split('=')[1] || '';
        const innerPairs = inner.split('&');
        for (const ip of innerPairs) {
          const [k, v] = ip.trim().split('=');
          if (k === 'u') username = decodeURIComponent(v || '');
          if (k === 'p') password = decodeURIComponent(v || '');
        }
      }
    }
  }

  if (username && password) {
    return { username, password };
  }
  return null;
}

/**
 * Creates Set-Cookie header value conforming to spec "u=username&p=password"
 */
export function createAuthCookieHeader(username: string, password: string, maxAge = 86400 * 30): string[] {
  const encUser = encodeURIComponent(username);
  const encPass = encodeURIComponent(password);
  return [
    `u=${encUser}&p=${encPass}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
    `u=${encUser}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
    `p=${encPass}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  ];
}

export function createClearCookieHeader(): string[] {
  return [
    `u=&p=; Path=/; HttpOnly; Max-Age=0`,
    `u=; Path=/; HttpOnly; Max-Age=0`,
    `p=; Path=/; HttpOnly; Max-Age=0`
  ];
}

/**
 * Verifies credentials against D1 users table
 */
export async function authenticate(db: D1Database, cookieHeader: string | undefined): Promise<User | null> {
  const creds = getCredentialsFromCookie(cookieHeader);
  if (!creds) return null;

  const result = await db
    .prepare('SELECT username, password, created_at FROM users WHERE username = ? AND password = ?')
    .bind(creds.username, creds.password)
    .first<User>();

  return result || null;
}

/**
 * Middleware to populate c.get('currentUser')
 */
export const authMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: { currentUser: User | null } }> = async (c, next) => {
  const cookie = c.req.header('Cookie');
  const user = await authenticate(c.env.DB, cookie);
  c.set('currentUser', user);
  await next();
};
