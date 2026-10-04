import { Hono } from 'hono';
import { Bindings, User } from '../types';
import { getUserNotifications, markNotificationsRead, getUserGainedVotes } from '../db/queries';
import { htmlLayout, renderNotificationsPage } from '../ui/templates';
import { formatLLMNotifications, isJsonMode, isLLMMode } from '../llm/formatter';

export const notificationsRouter = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

notificationsRouter.get('/notifications', async (c) => {
  const currentUser = c.get('currentUser');

  // Verify login status per spec
  if (!currentUser) {
    if (isJsonMode(c)) {
      return c.json({ error: 'Unauthorized', logged_in: false }, 401);
    }
    if (isLLMMode(c)) {
      return c.text('# Unauthorized\nPlease login first via POST /login or provide Cookie: u=USERNAME&p=PASSWORD\n', 401);
    }
    return c.redirect('/login');
  }

  const notifications = await getUserNotifications(c.env.DB, currentUser.username);
  const gainedVotes = await getUserGainedVotes(c.env.DB, currentUser.username);

  // Mark all as read after viewing
  await markNotificationsRead(c.env.DB, currentUser.username);

  if (isJsonMode(c)) {
    return c.json({
      status: 'success',
      logged_in: true,
      username: currentUser.username,
      gained_votes: gainedVotes,
      notifications,
    });
  }

  if (isLLMMode(c)) {
    return c.text(formatLLMNotifications(notifications, currentUser.username));
  }

  return c.html(
    htmlLayout(
      'Notifications',
      renderNotificationsPage(notifications, currentUser.username),
      currentUser,
      gainedVotes,
      0
    )
  );
});
