import { Hono } from 'hono';
import { Bindings, User } from '../types';
import { castVote } from '../db/queries';
import { isJsonMode, isLLMMode } from '../llm/formatter';

export const voteRouter = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

voteRouter.post('/vote', async (c) => {
  const currentUser = c.get('currentUser');
  if (!currentUser) {
    if (isJsonMode(c) || isLLMMode(c)) {
      return c.json({ error: 'Unauthorized. Login required to vote.' }, 401);
    }
    return c.redirect('/login');
  }

  let target_type: 'post' | 'comment' = 'post';
  let target_id = '';
  let vote_type: 1 | -1 = 1;

  const contentType = c.req.header('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const body = await c.req.json<any>().catch(() => ({}));
    target_type = body.target_type === 'comment' ? 'comment' : 'post';
    target_id = body.target_id || '';
    vote_type = Number(body.vote_type) === -1 ? -1 : 1;
  } else {
    const body = await c.req.parseBody();
    target_type = body.target_type === 'comment' ? 'comment' : 'post';
    target_id = (body.target_id as string) || '';
    vote_type = Number(body.vote_type) === -1 ? -1 : 1;
  }

  if (!target_id) {
    return c.json({ error: 'target_id is required' }, 400);
  }

  const result = await castVote(c.env.DB, currentUser.username, target_type, target_id, vote_type);

  if (isJsonMode(c)) {
    return c.json(result);
  }
  if (isLLMMode(c)) {
    return c.text(`# Vote Registered\nTarget: ${target_id} (${target_type})\nScore: ${result.sum} (+${result.upvotes}/-${result.downvotes})\n`);
  }

  // Redirect back to referer or post
  const referer = c.req.header('Referer');
  if (referer) {
    return c.redirect(referer);
  }
  if (target_type === 'post') {
    return c.redirect(target_id);
  }
  return c.redirect('/');
});
