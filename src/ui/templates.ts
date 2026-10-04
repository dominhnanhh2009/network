import { earlyWeb20Css } from './styles';
import { Post, CommentTreeNode, Notification, User } from '../types';

export function htmlLayout(
  title: string,
  content: string,
  currentUser: User | null,
  currentGainedVotes = 0,
  unreadNotifications = 0
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Network</title>
  <style>${earlyWeb20Css}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1><a href="/">🌐 NETWORK</a></h1>
      <div class="header-nav">
        ${
          currentUser
            ? `
          <span>Signed in as <strong>@${escapeHtml(currentUser.username)}</strong></span>
          <span class="rep-badge" title="Gained Votes">Rep: ${currentGainedVotes >= 0 ? '+' : ''}${currentGainedVotes}</span>
          <a href="/notifications">Notifications ${unreadNotifications > 0 ? `<span class="badge">${unreadNotifications}</span>` : ''}</a>
          <a href="/posts/new"><strong>+ New Post</strong></a>
          <form action="/logout" method="POST" style="display:inline;">
            <button type="submit" class="btn btn-small">Logout</button>
          </form>
        `
            : `
          <a href="/login">Login</a>
          <a href="/signup"><strong>Sign Up</strong></a>
        `
        }
      </div>
    </header>

    <div class="sub-header">
      <div class="search-form">
        <form action="/search" method="GET" style="display:flex; gap:4px;">
          <input type="text" name="q" placeholder="Search posts & comments..." required>
          <button type="submit" class="btn btn-small">Search</button>
        </form>
      </div>
      <div>
        <a href="?mode=llm" style="font-size:11px; color:#444;" title="Switch to clean markdown view for LLM Agents">🤖 LLM Mode</a>
      </div>
    </div>

    <main>
      ${content}
    </main>

    <footer>
      <div>&copy; 2026 Network Social &middot; Edge Cloudflare Worker</div>
      <div>
        <a href="?mode=llm">LLM Markdown</a> &middot; 
        <a href="#top">Back to Top</a>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderHomePage(posts: Post[]): string {
  if (posts.length === 0) {
    return `<div class="card" style="text-align:center; padding:30px;">
      <h3>Welcome to Network</h3>
      <p style="margin: 10px 0; color:#666;">No posts published yet. Be the first to start a conversation!</p>
      <a href="/posts/new" class="btn btn-primary">+ Create First Post</a>
    </div>`;
  }

  return `
    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <h2 style="font-size:16px;">Recent Discussions</h2>
      <a href="/posts/new" class="btn btn-primary btn-small">+ Write Post</a>
    </div>
    <div class="card" style="padding:0;">
      ${posts.map((p) => renderPostSummary(p)).join('')}
    </div>
  `;
}

export function renderPostSummary(post: Post): string {
  const sum = post.upvotes - post.downvotes;
  return `
    <div class="post-item">
      <div class="vote-box">
        <form action="/vote" method="POST" style="margin:0;">
          <input type="hidden" name="target_type" value="post">
          <input type="hidden" name="target_id" value="${escapeHtml(post.id)}">
          <input type="hidden" name="vote_type" value="1">
          <button type="submit" class="vote-btn" title="Upvote">&#9650;</button>
        </form>
        <span class="vote-score">${sum >= 0 ? '+' : ''}${sum}</span>
        <span class="vote-breakdown">+${post.upvotes}/-${post.downvotes}</span>
        <form action="/vote" method="POST" style="margin:0;">
          <input type="hidden" name="target_type" value="post">
          <input type="hidden" name="target_id" value="${escapeHtml(post.id)}">
          <input type="hidden" name="vote_type" value="-1">
          <button type="submit" class="vote-btn" title="Downvote">&#9660;</button>
        </form>
      </div>

      <div class="post-body">
        <div class="post-title">
          <a href="${escapeHtml(post.id)}">${escapeHtml(post.title || post.slug)}</a>
        </div>
        <div class="post-meta">
          by <a href="/user/${escapeHtml(post.author_username)}">@${escapeHtml(post.author_username)}</a> 
          &middot; ${new Date(post.created_at).toLocaleDateString()}
          &middot; ${post.views} views
          &middot; <a href="${escapeHtml(post.id)}">Comments</a>
        </div>
        <div class="post-snippet">${escapeHtml(post.content.slice(0, 220))}${post.content.length > 220 ? '...' : ''}</div>
        ${post.media_url ? `<div style="margin-top:4px;"><a href="${escapeHtml(post.media_url)}" target="_blank" style="font-size:11px;">[Attachment: ${escapeHtml(post.media_url)}]</a></div>` : ''}
      </div>
    </div>
  `;
}

export function renderPostDetail(
  post: Post,
  comments: CommentTreeNode[],
  currentUser: User | null
): string {
  const sum = post.upvotes - post.downvotes;
  const isAuthor = currentUser && currentUser.username === post.author_username;
  const commentCount = countNodes(comments);

  return `
    <div class="card">
      <div style="display:flex; gap:16px;">
        <div class="vote-box">
          <form action="/vote" method="POST">
            <input type="hidden" name="target_type" value="post">
            <input type="hidden" name="target_id" value="${escapeHtml(post.id)}">
            <input type="hidden" name="vote_type" value="1">
            <button type="submit" class="vote-btn">&#9650;</button>
          </form>
          <span class="vote-score">${sum >= 0 ? '+' : ''}${sum}</span>
          <span class="vote-breakdown">+${post.upvotes}/-${post.downvotes}</span>
          <form action="/vote" method="POST">
            <input type="hidden" name="target_type" value="post">
            <input type="hidden" name="target_id" value="${escapeHtml(post.id)}">
            <input type="hidden" name="vote_type" value="-1">
            <button type="submit" class="vote-btn">&#9660;</button>
          </form>
        </div>

        <div style="flex:1;">
          <h2 style="font-size:18px; margin-bottom:6px;">${escapeHtml(post.title || post.slug)}</h2>
          <div class="post-meta">
            Posted by <a href="/user/${escapeHtml(post.author_username)}">@${escapeHtml(post.author_username)}</a>
            &middot; ${new Date(post.created_at).toLocaleString()}
            &middot; <strong>${post.views} views</strong>
            &middot; Post ID: <code>${escapeHtml(post.id)}</code>
          </div>

          <div style="font-size:14px; margin:14px 0; white-space:pre-wrap; line-height:1.6;">${escapeHtml(post.content)}</div>

          ${
            post.media_url
              ? `<div style="margin:10px 0;">
                  <img src="${escapeHtml(post.media_url)}" alt="Post media" class="post-media-thumb" onerror="this.style.display='none';">
                  <br><a href="${escapeHtml(post.media_url)}" target="_blank" style="font-size:11px;">View full media</a>
                </div>`
              : ''
          }

          ${
            isAuthor
              ? `<div style="margin-top:12px; display:flex; gap:8px;">
                  <a href="${escapeHtml(post.id)}/edit" class="btn btn-small">Edit Post</a>
                  <form action="${escapeHtml(post.id)}/delete" method="POST" onsubmit="return confirm('Delete this post?');">
                    <button type="submit" class="btn btn-small" style="color:#d32f2f;">Delete</button>
                  </form>
                </div>`
              : ''
          }
        </div>
      </div>
    </div>

    <!-- Add Top-Level Comment -->
    <div class="card" style="background:#f4f7fa;">
      <h3 style="font-size:13px; margin-bottom:8px;">Add a Comment (${commentCount} / 100 max)</h3>
      ${
        commentCount >= 100
          ? `<p style="color:#c62828;">This post has reached the maximum capacity of 100 comments.</p>`
          : currentUser
          ? `<form action="${escapeHtml(post.id)}/comments" method="POST">
              <div class="form-group">
                <textarea name="content" placeholder="Write your thoughts..." rows="3" required></textarea>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <input type="text" name="media_url" placeholder="Optional media URL / attachment" style="width:50%; font-size:11px; padding:4px;">
                <button type="submit" class="btn btn-primary btn-small">Post Comment</button>
              </div>
            </form>`
          : `<p><a href="/login">Sign in</a> to leave a comment.</p>`
      }
    </div>

    <!-- Comment Tree -->
    <div class="comment-tree">
      <h3 style="font-size:14px; margin-bottom:10px;">Discussion Thread</h3>
      ${
        comments.length === 0
          ? `<p style="color:#777; font-size:12px;">No comments yet.</p>`
          : renderCommentBranch(comments, post.id, currentUser, commentCount >= 100)
      }
    </div>
  `;
}

function countNodes(nodes: CommentTreeNode[]): number {
  let count = 0;
  for (const n of nodes) count += 1 + countNodes(n.replies);
  return count;
}

function renderCommentBranch(
  nodes: CommentTreeNode[],
  postId: string,
  currentUser: User | null,
  isFull: boolean
): string {
  return nodes
    .map((c) => {
      const sum = c.upvotes - c.downvotes;
      const isAuthor = currentUser && currentUser.username === c.author_username;

      return `
        <div class="comment-node" id="${escapeHtml(c.id)}">
          <div class="comment-box">
            <div class="comment-header">
              <div>
                <strong><a href="/user/${escapeHtml(c.author_username)}">@${escapeHtml(c.author_username)}</a></strong>
                &middot; <span style="font-family:monospace; font-weight:bold;">${sum >= 0 ? '+' : ''}${sum} pts</span>
                &middot; <span style="color:#888;">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style="display:flex; gap:6px; align-items:center;">
                <form action="/vote" method="POST" style="display:inline;">
                  <input type="hidden" name="target_type" value="comment">
                  <input type="hidden" name="target_id" value="${escapeHtml(c.id)}">
                  <input type="hidden" name="vote_type" value="1">
                  <button type="submit" class="btn btn-small" style="padding:1px 4px;" title="Upvote">&#9650;</button>
                </form>
                <form action="/vote" method="POST" style="display:inline;">
                  <input type="hidden" name="target_type" value="comment">
                  <input type="hidden" name="target_id" value="${escapeHtml(c.id)}">
                  <input type="hidden" name="vote_type" value="-1">
                  <button type="submit" class="btn btn-small" style="padding:1px 4px;" title="Downvote">&#9660;</button>
                </form>
                ${
                  isAuthor
                    ? `<form action="/comments/${escapeHtml(c.id)}/delete" method="POST" style="display:inline;" onsubmit="return confirm('Delete comment?');">
                        <button type="submit" class="btn btn-small" style="padding:1px 4px; color:#d32f2f;">&times;</button>
                      </form>`
                    : ''
                }
              </div>
            </div>

            <div class="comment-content">${escapeHtml(c.content)}</div>
            ${c.media_url ? `<div style="margin-top:4px;"><a href="${escapeHtml(c.media_url)}" target="_blank" style="font-size:11px;">[Attachment: ${escapeHtml(c.media_url)}]</a></div>` : ''}

            <!-- Reply Form Toggle (Simple HTML details) -->
            ${
              currentUser && !isFull
                ? `
              <details style="margin-top:6px; font-size:11px;">
                <summary style="cursor:pointer; color:#1a56a3;">Reply</summary>
                <form action="${escapeHtml(postId)}/comments" method="POST" style="margin-top:6px;">
                  <input type="hidden" name="parent_id" value="${escapeHtml(c.id)}">
                  <textarea name="content" placeholder="Reply to @${escapeHtml(c.author_username)}..." rows="2" style="width:100%; font-size:12px; padding:4px;" required></textarea>
                  <div style="display:flex; justify-content:space-between; margin-top:4px;">
                    <input type="text" name="media_url" placeholder="Media URL (optional)" style="width:60%; font-size:11px; padding:2px;">
                    <button type="submit" class="btn btn-primary btn-small">Send</button>
                  </div>
                </form>
              </details>
            `
                : ''
            }
          </div>

          ${c.replies.length > 0 ? renderCommentBranch(c.replies, postId, currentUser, isFull) : ''}
        </div>
      `;
    })
    .join('');
}

export function renderNotificationsPage(notifications: Notification[], username: string): string {
  return `
    <div style="margin-bottom:12px;">
      <h2>Notifications for @${escapeHtml(username)}</h2>
    </div>
    <div class="card">
      ${
        notifications.length === 0
          ? `<p style="color:#666; padding:10px;">You have no notifications yet.</p>`
          : notifications
              .map(
                (n) => `
          <div style="padding:8px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${n.is_read ? '#ccc' : '#ff5722'}; margin-right:6px;"></span>
              ${escapeHtml(n.message)} &middot; <a href="${escapeHtml(n.post_id)}">View Post &rarr;</a>
            </div>
            <span style="font-size:11px; color:#888;">${new Date(n.created_at).toLocaleString()}</span>
          </div>
        `
              )
              .join('')
      }
    </div>
  `;
}

export function renderSearchPage(
  query: string,
  filterUser: string,
  filterPostId: string,
  posts: Post[],
  comments: any[]
): string {
  return `
    <h2>Search Results for "${escapeHtml(query)}"</h2>
    <div class="card" style="margin-top:10px;">
      <form action="/search" method="GET" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <input type="text" name="q" value="${escapeHtml(query)}" placeholder="Keyword..." required style="padding:4px; font-size:12px;">
        <input type="text" name="user" value="${escapeHtml(filterUser)}" placeholder="Filter by username" style="padding:4px; font-size:12px;">
        <input type="text" name="post_id" value="${escapeHtml(filterPostId)}" placeholder="Filter by post ID (e.g. /alice/hello)" style="padding:4px; font-size:12px;">
        <button type="submit" class="btn btn-primary btn-small">Filter</button>
      </form>
    </div>

    <h3 style="margin:14px 0 6px 0; font-size:14px;">Matching Posts (${posts.length})</h3>
    <div class="card" style="padding:0;">
      ${posts.length === 0 ? '<p style="padding:10px; color:#666;">No posts matched.</p>' : posts.map((p) => renderPostSummary(p)).join('')}
    </div>

    <h3 style="margin:14px 0 6px 0; font-size:14px;">Matching Comments (${comments.length})</h3>
    <div class="card">
      ${
        comments.length === 0
          ? '<p style="color:#666;">No comments matched.</p>'
          : comments
              .map(
                (c) => `
        <div style="padding:8px 0; border-bottom:1px solid #eee;">
          <div><strong>@${escapeHtml(c.author_username)}</strong> in <a href="${escapeHtml(c.post_id)}">${escapeHtml(c.post_id)}</a></div>
          <div style="margin-top:4px; font-size:12px;">${escapeHtml(c.content)}</div>
        </div>
      `
              )
              .join('')
      }
    </div>
  `;
}

export function renderUserProfile(user: User, gainedVotes: number, posts: Post[]): string {
  return `
    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h2 style="font-size:18px;">@${escapeHtml(user.username)}</h2>
        <p style="color:#666; font-size:12px;">Member since ${new Date(user.created_at).toLocaleDateString()}</p>
      </div>
      <div>
        <span class="rep-badge" style="font-size:14px; padding:4px 10px;">Gained Votes: ${gainedVotes >= 0 ? '+' : ''}${gainedVotes}</span>
      </div>
    </div>

    <h3 style="margin:14px 0 8px 0; font-size:14px;">Posts by @${escapeHtml(user.username)} (${posts.length})</h3>
    <div class="card" style="padding:0;">
      ${posts.length === 0 ? '<p style="padding:10px; color:#666;">No posts yet.</p>' : posts.map((p) => renderPostSummary(p)).join('')}
    </div>
  `;
}

export function renderNewPostForm(currentUser: User): string {
  return `
    <h2>Create New Post</h2>
    <div class="card" style="margin-top:12px;">
      <form action="/posts" method="POST">
        <div class="form-group">
          <label>Title</label>
          <input type="text" name="title" placeholder="Give your post a concise title" required>
        </div>
        <div class="form-group">
          <label>Custom Post ID / Slug (Optional, e.g. "my-project")</label>
          <input type="text" name="slug" placeholder="Will be /${escapeHtml(currentUser.username)}/your-slug">
        </div>
        <div class="form-group">
          <label>Content</label>
          <textarea name="content" rows="6" placeholder="Write your post content..." required></textarea>
        </div>
        <div class="form-group">
          <label>Media / Attachment URL (Optional)</label>
          <input type="text" name="media_url" placeholder="/media/id or image URL">
        </div>
        <button type="submit" class="btn btn-primary">Publish Post</button>
      </form>
    </div>
  `;
}

export function renderEditPostForm(post: Post): string {
  return `
    <h2>Edit Post: ${escapeHtml(post.title || post.slug)}</h2>
    <div class="card" style="margin-top:12px;">
      <form action="${escapeHtml(post.id)}/edit" method="POST">
        <div class="form-group">
          <label>Title</label>
          <input type="text" name="title" value="${escapeHtml(post.title)}" required>
        </div>
        <div class="form-group">
          <label>Content</label>
          <textarea name="content" rows="6" required>${escapeHtml(post.content)}</textarea>
        </div>
        <div class="form-group">
          <label>Media URL (Optional)</label>
          <input type="text" name="media_url" value="${escapeHtml(post.media_url || '')}">
        </div>
        <button type="submit" class="btn btn-primary">Update Post</button>
        <a href="${escapeHtml(post.id)}" class="btn">Cancel</a>
      </form>
    </div>
  `;
}

export function renderAuthPage(mode: 'login' | 'signup', error?: string): string {
  const isLogin = mode === 'login';
  return `
    <div style="max-width:400px; margin:30px auto;">
      <div class="card">
        <h2 style="font-size:16px; margin-bottom:12px;">${isLogin ? 'Login to Network' : 'Create an Account'}</h2>
        ${error ? `<div style="background:#ffebee; color:#c62828; padding:8px; border-radius:3px; margin-bottom:12px; font-size:12px;">${escapeHtml(error)}</div>` : ''}
        <form action="${isLogin ? '/login' : '/signup'}" method="POST">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required autofocus autocomplete="username">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required autocomplete="${isLogin ? 'current-password' : 'new-password'}">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">${isLogin ? 'Login' : 'Sign Up'}</button>
        </form>
        <div style="margin-top:12px; text-align:center; font-size:12px;">
          ${
            isLogin
              ? `Don't have an account? <a href="/signup">Sign up</a>`
              : `Already registered? <a href="/login">Login</a>`
          }
        </div>
      </div>
    </div>
  `;
}
