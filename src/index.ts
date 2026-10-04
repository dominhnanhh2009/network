import { Hono } from 'hono';
import { Bindings, User } from './types';
import { authMiddleware } from './auth';
import { getRecentPosts, getUserGainedVotes, getUserNotifications } from './db/queries';
import { htmlLayout, renderHomePage } from './ui/templates';
import { formatLLMHome, isJsonMode, isLLMMode } from './llm/formatter';

import { authRouter } from './routes/auth';
import { notificationsRouter } from './routes/notifications';
import { voteRouter } from './routes/vote';
import { searchRouter } from './routes/search';
import { mediaRouter } from './routes/media';
import { usersRouter } from './routes/users';
import { postsRouter } from './routes/posts';

const app = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

// Auth middleware across all routes
app.use('*', authMiddleware);

// Home route
app.get('/', async (c) => {
  const posts = await getRecentPosts(c.env.DB, 30);
  const currentUser = c.get('currentUser');

  if (isJsonMode(c)) {
    return c.json({ posts });
  }

  if (isLLMMode(c)) {
    return c.text(formatLLMHome(posts, currentUser));
  }

  let gainedVotes = 0;
  let unreadNotifications = 0;
  if (currentUser) {
    gainedVotes = await getUserGainedVotes(c.env.DB, currentUser.username);
    const notifications = await getUserNotifications(c.env.DB, currentUser.username);
    unreadNotifications = notifications.filter((n) => !n.is_read).length;
  }

  return c.html(
    htmlLayout('Home', renderHomePage(posts), currentUser, gainedVotes, unreadNotifications)
  );
});

// Mount specialized routers
app.route('/', authRouter);
app.route('/', notificationsRouter);
app.route('/', voteRouter);
app.route('/', searchRouter);
app.route('/', mediaRouter);
app.route('/', usersRouter);
app.route('/', postsRouter);

// 404 handler
app.notFound((c) => {
  if (isJsonMode(c) || isLLMMode(c)) {
    return c.json({ error: 'Endpoint or resource not found' }, 404);
  }
  return c.text('404 Not Found', 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled Server Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
