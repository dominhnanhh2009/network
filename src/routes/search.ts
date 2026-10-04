import { Hono } from 'hono';
import { Bindings, User } from '../types';
import { searchContent, getUserGainedVotes } from '../db/queries';
import { htmlLayout, renderSearchPage } from '../ui/templates';
import { isJsonMode, isLLMMode } from '../llm/formatter';

export const searchRouter = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

searchRouter.get('/search', async (c) => {
  const currentUser = c.get('currentUser');
  const query = c.req.query('q') || '';
  const filterUser = c.req.query('user') || undefined;
  const filterPostId = c.req.query('post_id') || undefined;

  const results = query ? await searchContent(c.env.DB, query, filterUser, filterPostId) : { posts: [], comments: [] };

  if (isJsonMode(c)) {
    return c.json({
      query,
      filterUser,
      filterPostId,
      results,
    });
  }

  if (isLLMMode(c)) {
    let md = `# Search Results for "${query}"\n\n`;
    if (filterUser) md += `- Filtered by user: @${filterUser}\n`;
    if (filterPostId) md += `- Filtered by post: ${filterPostId}\n`;
    md += `\n## Posts Found (${results.posts.length})\n`;
    for (const p of results.posts) {
      md += `- [${p.title || p.slug}](${p.id}?mode=llm) by @${p.author_username} (Votes: +${p.upvotes}/-${p.downvotes})\n`;
    }
    md += `\n## Comments Found (${results.comments.length})\n`;
    for (const cm of results.comments) {
      md += `- In [${cm.post_id}](${cm.post_id}?mode=llm) by @${cm.author_username}: "${cm.content}"\n`;
    }
    return c.text(md);
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
