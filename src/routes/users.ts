import { Hono } from 'hono';
import { Bindings, User } from '../types';
import { getUserByUsername, getUserGainedVotes, getPostsByUser } from '../db/queries';
import { htmlLayout, renderUserProfile } from '../ui/templates';
import { isJsonMode, isLLMMode } from '../llm/formatter';

export const usersRouter = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

usersRouter.get('/user/:username', async (c) => {
  const targetUsername = c.req.param('username');
  const targetUser = await getUserByUsername(c.env.DB, targetUsername);

  if (!targetUser) {
    if (isJsonMode(c) || isLLMMode(c)) {
      return c.json({ error: 'User not found' }, 404);
    }
    return c.text('User not found', 404);
  }

  const gainedVotes = await getUserGainedVotes(c.env.DB, targetUsername);
  const posts = await getPostsByUser(c.env.DB, targetUsername);
  const currentUser = c.get('currentUser');

  if (isJsonMode(c)) {
    return c.json({
      username: targetUser.username,
      created_at: targetUser.created_at,
      gained_votes: gainedVotes,
      posts,
    });
  }

  if (isLLMMode(c)) {
    let md = `# Profile: @${targetUser.username}\n\n`;
    md += `- Joined: ${new Date(targetUser.created_at).toISOString()}\n`;
    md += `- Gained Votes (Reputation): ${gainedVotes}\n`;
    md += `- Total Posts: ${posts.length}\n\n`;
    md += `## Posts by @${targetUser.username}\n`;
    for (const p of posts) {
      md += `- [${p.title || p.slug}](${p.id}?mode=llm) (Votes: +${p.upvotes}/-${p.downvotes}, Views: ${p.views})\n`;
    }
    return c.text(md);
  }

  let currentGainedVotes = 0;
  if (currentUser) {
    currentGainedVotes = await getUserGainedVotes(c.env.DB, currentUser.username);
  }

  return c.html(
    htmlLayout(
      `@${targetUser.username}`,
      renderUserProfile(targetUser, gainedVotes, posts),
      currentUser,
      currentGainedVotes
    )
  );
});
