import { Hono } from 'hono';
import { Bindings, User } from '../types';
import { createUser, getUserByUsername, getUserGainedVotes, getUserNotifications } from '../db/queries';
import { createAuthCookieHeader, createClearCookieHeader } from '../auth';
import { htmlLayout, renderAuthPage } from '../ui/templates';
import { isJsonMode, isLLMMode } from '../llm/formatter';

export const authRouter = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

authRouter.get('/signup', async (c) => {
  const user = c.get('currentUser');
  if (user) return c.redirect('/notifications');
  return c.html(htmlLayout('Sign Up', renderAuthPage('signup'), null));
});

authRouter.post('/signup', async (c) => {
  let username = '';
  let password = '';

  const contentType = c.req.header('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => ({}))) as any;
    username = body?.username?.trim() || '';
    password = body?.password || '';
  } else {
    const body = await c.req.parseBody();
    username = (body.username as string)?.trim() || '';
    password = (body.password as string) || '';
  }

  if (!username || !password) {
    if (isJsonMode(c)) {
      return c.json({ error: 'Username and password are required' }, 400);
    }
    return c.html(htmlLayout('Sign Up', renderAuthPage('signup', 'Username and password are required'), null), 400);
  }

  // Validate username characters (alphanumeric and underscores)
  if (!/^[a-zA-Z0-9_-]{2,30}$/.test(username)) {
    const err = 'Username must be 2-30 characters long (letters, numbers, underscores, hyphens only)';
    if (isJsonMode(c)) return c.json({ error: err }, 400);
    return c.html(htmlLayout('Sign Up', renderAuthPage('signup', err), null), 400);
  }

  const existing = await getUserByUsername(c.env.DB, username);
  if (existing) {
    const err = 'Username is already taken';
    if (isJsonMode(c)) return c.json({ error: err }, 400);
    return c.html(htmlLayout('Sign Up', renderAuthPage('signup', err), null), 400);
  }

  await createUser(c.env.DB, username, password);

  // Set auth cookies
  const cookieHeaders = createAuthCookieHeader(username, password);
  for (const cookie of cookieHeaders) {
    c.header('Set-Cookie', cookie, { append: true });
  }

  if (isJsonMode(c)) {
    return c.json({ status: 'success', username, message: 'Account created successfully' }, 201);
  }
  if (isLLMMode(c)) {
    return c.text(`# Account Created: @${username}\nAuthentication cookie set.\nYou can now call POST /posts or GET /notifications\n`, 201);
  }

  return c.redirect('/notifications');
});

authRouter.get('/login', async (c) => {
  const user = c.get('currentUser');
  if (user) return c.redirect('/notifications');
  return c.html(htmlLayout('Login', renderAuthPage('login'), null));
});

authRouter.post('/login', async (c) => {
  let username = '';
  let password = '';

  const contentType = c.req.header('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => ({}))) as any;
    username = body?.username?.trim() || '';
    password = body?.password || '';
  } else {
    const body = await c.req.parseBody();
    username = (body.username as string)?.trim() || '';
    password = (body.password as string) || '';
  }

  const user = await getUserByUsername(c.env.DB, username);
  if (!user || user.password !== password) {
    const err = 'Invalid username or password';
    if (isJsonMode(c)) return c.json({ error: err }, 401);
    return c.html(htmlLayout('Login', renderAuthPage('login', err), null), 401);
  }

  // Set auth cookies
  const cookieHeaders = createAuthCookieHeader(username, password);
  for (const cookie of cookieHeaders) {
    c.header('Set-Cookie', cookie, { append: true });
  }

  if (isJsonMode(c)) {
    return c.json({ status: 'success', username, message: 'Logged in successfully' });
  }
  if (isLLMMode(c)) {
    return c.text(`# Logged in: @${username}\nAuthentication cookie set.\n`);
  }

  return c.redirect('/notifications');
});

authRouter.post('/logout', async (c) => {
  const clearCookies = createClearCookieHeader();
  for (const cookie of clearCookies) {
    c.header('Set-Cookie', cookie, { append: true });
  }

  if (isJsonMode(c)) {
    return c.json({ status: 'success', message: 'Logged out successfully' });
  }
  if (isLLMMode(c)) {
    return c.text('# Logged out\nSession cleared.\n');
  }

  return c.redirect('/');
});
