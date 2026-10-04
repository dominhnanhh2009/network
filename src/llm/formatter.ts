import { Post, CommentTreeNode, Notification, User } from '../types';

export function isLLMMode(c: any): boolean {
  const queryMode = c.req.query('mode') || c.req.query('format');
  if (queryMode === 'llm' || queryMode === 'md' || queryMode === 'markdown') return true;

  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/markdown') || accept.includes('text/x-markdown')) return true;

  const userAgent = (c.req.header('User-Agent') || '').toLowerCase();
  if (userAgent.includes('curl') || userAgent.includes('python') || userAgent.includes('agent')) {
    // If Accept is not explicitly HTML, prefer text/markdown for agents/curl
    if (!accept.includes('text/html')) return true;
  }

  return false;
}

export function isJsonMode(c: any): boolean {
  const queryMode = c.req.query('mode') || c.req.query('format');
  if (queryMode === 'json') return true;
  const accept = c.req.header('Accept') || '';
  if (accept.includes('application/json')) return true;
  const contentType = c.req.header('Content-Type') || '';
  if (contentType.includes('application/json')) return true;
  return false;
}

export function formatLLMHome(posts: Post[], currentUser: User | null): string {
  let md = `# NETWORK SOCIAL (LLM-Optimized Interface)\n\n`;
  md += `> Status: Minimalist early web 2.0 social edge node.\n`;
  md += `> Auth: Cookie \`u=USERNAME&p=PASSWORD\`\n\n`;

  if (currentUser) {
    md += `### Session: Logged in as @${currentUser.username}\n`;
    md += `- Notifications: [GET /notifications?mode=llm](/notifications?mode=llm)\n`;
    md += `- Create Post: POST /posts (JSON: { title, slug, content, media_url })\n`;
    md += `- Logout: POST /logout\n\n`;
  } else {
    md += `### Session: Guest (Public Mode)\n`;
    md += `- Signup: POST /signup (Form or JSON: { username, password })\n`;
    md += `- Login: POST /login (Form or JSON: { username, password })\n\n`;
  }

  md += `## Recent Posts (${posts.length})\n\n`;
  if (posts.length === 0) {
    md += `No posts yet.\n\n`;
  } else {
    for (const p of posts) {
      const sum = p.upvotes - p.downvotes;
      md += `### [${p.title || p.slug}](${p.id}?mode=llm)\n`;
      md += `- ID: \`${p.id}\`\n`;
      md += `- Author: @${p.author_username}\n`;
      md += `- Views: ${p.views} | Votes: +${p.upvotes}/-${p.downvotes} (Sum: ${sum})\n`;
      md += `- Date: ${new Date(p.created_at).toISOString()}\n`;
      if (p.media_url) md += `- Media: ${p.media_url}\n`;
      md += `\n${p.content.slice(0, 300)}${p.content.length > 300 ? '...' : ''}\n\n---\n\n`;
    }
  }

  md += `## Available Actions\n`;
  md += `- Vote: POST /vote { target_type: 'post'|'comment', target_id: ID, vote_type: 1|-1 }\n`;
  md += `- Search: GET /search?q=KEYWORD&user=USERNAME&post_id=POST_ID&mode=llm\n`;

  return md;
}

export function formatLLMPostDetail(
  post: Post,
  commentTree: CommentTreeNode[],
  currentUser: User | null
): string {
  const sum = post.upvotes - post.downvotes;
  let md = `# Post: ${post.title || post.slug}\n\n`;
  md += `- ID: \`${post.id}\`\n`;
  md += `- Author: @${post.author_username}\n`;
  md += `- Views: ${post.views}\n`;
  md += `- Votes: +${post.upvotes} / -${post.downvotes} (Sum: ${sum})\n`;
  md += `- Created: ${new Date(post.created_at).toISOString()}\n`;
  if (post.media_url) md += `- Media URL: ${post.media_url}\n`;
  md += `\n## Content\n\n${post.content}\n\n`;

  md += `## Actions for this Post\n`;
  md += `- Upvote: POST /vote { "target_type": "post", "target_id": "${post.id}", "vote_type": 1 }\n`;
  md += `- Downvote: POST /vote { "target_type": "post", "target_id": "${post.id}", "vote_type": -1 }\n`;
  md += `- Add Comment: POST ${post.id}/comments { "content": "...", "parent_id": null }\n`;
  if (currentUser && currentUser.username === post.author_username) {
    md += `- Edit Post: PUT ${post.id} { "title": "...", "content": "..." }\n`;
    md += `- Delete Post: DELETE ${post.id}\n`;
  }
  md += `\n## Comments (${countComments(commentTree)} / 100 max)\n\n`;

  if (commentTree.length === 0) {
    md += `No comments yet.\n\n`;
  } else {
    md += renderCommentTreeLLM(commentTree, 0);
  }

  return md;
}

function countComments(nodes: CommentTreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1 + countComments(n.replies);
  }
  return count;
}

function renderCommentTreeLLM(nodes: CommentTreeNode[], depth: number): string {
  let out = '';
  const indent = '  '.repeat(depth);
  for (const n of nodes) {
    const sum = n.upvotes - n.downvotes;
    out += `${indent}* [${n.id}] @${n.author_username} (Score: ${sum}): ${n.content}\n`;
    if (n.media_url) out += `${indent}  [Media: ${n.media_url}]\n`;
    if (n.replies.length > 0) {
      out += renderCommentTreeLLM(n.replies, depth + 1);
    }
  }
  return out;
}

export function formatLLMNotifications(notifications: Notification[], username: string): string {
  let md = `# Notifications for @${username}\n\n`;
  if (notifications.length === 0) {
    md += `No notifications found.\n`;
  } else {
    for (const n of notifications) {
      const readStatus = n.is_read ? '[READ]' : '[NEW]';
      md += `- ${readStatus} ${n.message} (Post: [${n.post_id}](${n.post_id}?mode=llm)) - ${new Date(n.created_at).toISOString()}\n`;
    }
  }
  return md;
}
