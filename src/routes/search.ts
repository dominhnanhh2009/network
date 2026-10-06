import { Hono } from 'hono';
import { Bindings, User } from '../types';
import { searchContent, getUserGainedVotes } from '../db/queries';
import { htmlLayout, renderSearchPage } from '../ui/templates';
import { formatLLMSearch, isJsonMode, isLLMMode } from '../llm/formatter';

export const searchRouter = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

searchRouter.get('/search', async (c) => {
  const currentUser = c.get('currentUser');
  const query = c.req.query('q') || '';
  const filterUser = c.req.query('user') || undefined;
  const filterPostId = c.req.query('post_id') || undefined;
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '30', 10) || 30));
  const offset = (page - 1) * limit;

  const results = query
    ? await searchContent(c.env.DB, query, filterUser, filterPostId, limit, offset)
    : { posts: [], comments: [] };

  if (isJsonMode(c)) {
    return c.json({
      query,
      page,
      limit,
      filterUser,
      filterPostId,
      results,
    });
  }

  if (isLLMMode(c)) {
    return c.text(
      formatLLMSearch(query, filterUser, filterPostId, results.posts, results.comments, page, limit)
    );
  }

  let gainedVotes = 0;
  if (currentUser) {
    gainedVotes = await getUserGainedVotes(c.env.DB, currentUser.username);
  }

  return c.html(
    htmlLayout(
      `Search: ${query}`,
      renderSearchPage(query, filterUser || '', filterPostId || '', results.posts, results.comments),
      currentUser,
      gainedVotes
    )
  );
});
