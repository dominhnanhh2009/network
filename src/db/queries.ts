import { Post, Comment, CommentTreeNode, Notification, User, MediaRecord } from '../types';

/**
 * Users
 */
export async function getUserByUsername(db: D1Database, username: string): Promise<User | null> {
  return await db
    .prepare('SELECT username, password, created_at FROM users WHERE username = ?')
    .bind(username)
    .first<User>();
}

export async function createUser(db: D1Database, username: string, password: string): Promise<User> {
  const now = Date.now();
  await db
    .prepare('INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)')
    .bind(username, password, now)
    .run();

  return { username, password, created_at: now };
}

export async function getUserGainedVotes(db: D1Database, username: string): Promise<number> {
  const postVotesRes = await db
    .prepare('SELECT COALESCE(SUM(upvotes - downvotes), 0) as total FROM posts WHERE author_username = ?')
    .bind(username)
    .first<{ total: number }>();

  const commentVotesRes = await db
    .prepare('SELECT COALESCE(SUM(upvotes - downvotes), 0) as total FROM comments WHERE author_username = ?')
    .bind(username)
    .first<{ total: number }>();

  const postTotal = postVotesRes?.total || 0;
  const commentTotal = commentVotesRes?.total || 0;
  return postTotal + commentTotal;
}

/**
 * Posts
 */
export async function getPostById(db: D1Database, id: string): Promise<Post | null> {
  return await db
    .prepare('SELECT * FROM posts WHERE id = ?')
    .bind(id)
    .first<Post>();
}

export async function getRecentPosts(db: D1Database, limit = 30): Promise<Post[]> {
  const res = await db
    .prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<Post>();
  return res.results || [];
}

export async function getPostsByUser(db: D1Database, username: string, limit = 50): Promise<Post[]> {
  const res = await db
    .prepare('SELECT * FROM posts WHERE author_username = ? ORDER BY created_at DESC LIMIT ?')
    .bind(username, limit)
    .all<Post>();
  return res.results || [];
}

export function sanitizeSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'post';
}

export async function createPost(
  db: D1Database,
  authorUsername: string,
  rawSlug: string,
  title: string,
  content: string,
  mediaUrl?: string | null
): Promise<Post> {
  let slug = sanitizeSlug(rawSlug || title || `p-${Date.now().toString(36)}`);
  let id = `/${authorUsername}/${slug}`;

  // Check if id already exists for this user, append random suffix if needed
  const existing = await getPostById(db, id);
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    id = `/${authorUsername}/${slug}`;
  }

  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO posts (id, author_username, slug, title, content, media_url, views, upvotes, downvotes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
    )
    .bind(id, authorUsername, slug, title, content, mediaUrl || null, now, now)
    .run();

  // Trigger initial notification distribution
  const gainedVotes = await getUserGainedVotes(db, authorUsername);
  const recipientCount = Math.max(3, Math.min(50, 3 + Math.floor(gainedVotes * 0.5)));
  await distributePostNotification(db, id, authorUsername, title || slug, recipientCount);

  return {
    id,
    author_username: authorUsername,
    slug,
    title,
    content,
    media_url: mediaUrl || null,
    views: 0,
    upvotes: 0,
    downvotes: 0,
    created_at: now,
    updated_at: now,
  };
}

export async function updatePost(
  db: D1Database,
  id: string,
  authorUsername: string,
  title: string,
  content: string,
  mediaUrl?: string | null
): Promise<boolean> {
  const now = Date.now();
  const res = await db
    .prepare(
      `UPDATE posts 
       SET title = ?, content = ?, media_url = COALESCE(?, media_url), updated_at = ?
       WHERE id = ? AND author_username = ?`
    )
    .bind(title, content, mediaUrl || null, now, id, authorUsername)
    .run();

  return (res.meta.changes || 0) > 0;
}

export async function deletePost(db: D1Database, id: string, authorUsername: string): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM posts WHERE id = ? AND author_username = ?')
    .bind(id, authorUsername)
    .run();

  return (res.meta.changes || 0) > 0;
}

export async function incrementPostViews(db: D1Database, id: string): Promise<void> {
  await db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').bind(id).run();
}

/**
 * Comments
 */
export async function getCommentsByPostId(db: D1Database, postId: string): Promise<Comment[]> {
  const res = await db
    .prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 100')
    .bind(postId)
    .all<Comment>();

  return res.results || [];
}

export function buildCommentTree(comments: Comment[]): CommentTreeNode[] {
  const map = new Map<string, CommentTreeNode>();
  const roots: CommentTreeNode[] = [];

  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function addComment(
  db: D1Database,
  postId: string,
  parentId: string | null,
  authorUsername: string,
  content: string,
  mediaUrl?: string | null
): Promise<{ success: boolean; comment?: Comment; error?: string }> {
  // Check max 100 comments constraint
  const countRes = await db
    .prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?')
    .bind(postId)
    .first<{ count: number }>();

  if ((countRes?.count || 0) >= 100) {
    return { success: false, error: 'Maximum 100 comments reached for this post' };
  }

  // Ensure unique id within post
  const id = `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO comments (id, post_id, parent_id, author_username, content, media_url, upvotes, downvotes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
    )
    .bind(id, postId, parentId || null, authorUsername, content, mediaUrl || null, now, now)
    .run();

  const comment: Comment = {
    id,
    post_id: postId,
    parent_id: parentId || null,
    author_username: authorUsername,
    content,
    media_url: mediaUrl || null,
    upvotes: 0,
    downvotes: 0,
    created_at: now,
    updated_at: now,
  };

  return { success: true, comment };
}

export async function updateComment(
  db: D1Database,
  id: string,
  authorUsername: string,
  content: string
): Promise<boolean> {
  const now = Date.now();
  const res = await db
    .prepare('UPDATE comments SET content = ?, updated_at = ? WHERE id = ? AND author_username = ?')
    .bind(content, now, id, authorUsername)
    .run();

  return (res.meta.changes || 0) > 0;
}

export async function deleteComment(db: D1Database, id: string, authorUsername: string): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM comments WHERE id = ? AND author_username = ?')
    .bind(id, authorUsername)
    .run();

  return (res.meta.changes || 0) > 0;
}

/**
 * Voting
 */
export async function castVote(
  db: D1Database,
  username: string,
  targetType: 'post' | 'comment',
  targetId: string,
  voteType: 1 | -1
): Promise<{ success: boolean; upvotes: number; downvotes: number; sum: number }> {
  // Check existing vote
  const existing = await db
    .prepare('SELECT vote_type FROM votes WHERE username = ? AND target_type = ? AND target_id = ?')
    .bind(username, targetType, targetId)
    .first<{ vote_type: number }>();

  let upDelta = 0;
  let downDelta = 0;
  const now = Date.now();

  if (!existing) {
    // New vote
    await db
      .prepare('INSERT INTO votes (username, target_type, target_id, vote_type, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(username, targetType, targetId, voteType, now)
      .run();

    if (voteType === 1) upDelta = 1;
    else downDelta = 1;
  } else if (existing.vote_type !== voteType) {
    // Changing vote
    await db
      .prepare('UPDATE votes SET vote_type = ?, created_at = ? WHERE username = ? AND target_type = ? AND target_id = ?')
      .bind(voteType, now, username, targetType, targetId)
      .run();

    if (voteType === 1) {
      upDelta = 1;
      downDelta = -1;
    } else {
      upDelta = -1;
      downDelta = 1;
    }
  } else {
    // Same vote clicked again -> remove vote (toggle)
    await db
      .prepare('DELETE FROM votes WHERE username = ? AND target_type = ? AND target_id = ?')
      .bind(username, targetType, targetId)
      .run();

    if (voteType === 1) upDelta = -1;
    else downDelta = -1;
  }

  // Update target counts
  const table = targetType === 'post' ? 'posts' : 'comments';
  await db
    .prepare(`UPDATE ${table} SET upvotes = MAX(0, upvotes + ?), downvotes = MAX(0, downvotes + ?) WHERE id = ?`)
    .bind(upDelta, downDelta, targetId)
    .run();

  const updated = await db
    .prepare(`SELECT upvotes, downvotes FROM ${table} WHERE id = ?`)
    .bind(targetId)
    .first<{ upvotes: number; downvotes: number }>();

  const upvotes = updated?.upvotes || 0;
  const downvotes = updated?.downvotes || 0;
  const sum = upvotes - downvotes;

  // Mechanical distribution triggered if positive vote on a post
  if (targetType === 'post' && voteType === 1 && upDelta > 0) {
    const post = await getPostById(db, targetId);
    if (post) {
      await distributePostNotification(db, targetId, post.author_username, post.title || post.slug, 2);
    }
  }

  return { success: true, upvotes, downvotes, sum };
}

/**
 * Distribution Mechanics & Notifications
 */
export async function distributePostNotification(
  db: D1Database,
  postId: string,
  authorUsername: string,
  title: string,
  limitCount: number
): Promise<number> {
  if (limitCount <= 0) return 0;

  // Find random users who are NOT the author and have NOT received notification for this post yet
  const candidates = await db
    .prepare(
      `SELECT username FROM users 
       WHERE username != ? 
         AND username NOT IN (SELECT recipient_username FROM notifications WHERE post_id = ?)
       ORDER BY RANDOM() 
       LIMIT ?`
    )
    .bind(authorUsername, postId, limitCount)
    .all<{ username: string }>();

  const users = candidates.results || [];
  if (users.length === 0) return 0;

  const now = Date.now();
  const message = `New post from @${authorUsername}: "${title}"`;

  for (const u of users) {
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO notifications (recipient_username, post_id, message, is_read, created_at)
           VALUES (?, ?, ?, 0, ?)`
        )
        .bind(u.username, postId, message, now)
        .run();
    } catch {
      // Ignore duplicate insert errors
    }
  }

  return users.length;
}

export async function getUserNotifications(db: D1Database, username: string, limit = 50): Promise<Notification[]> {
  const res = await db
    .prepare('SELECT * FROM notifications WHERE recipient_username = ? ORDER BY created_at DESC LIMIT ?')
    .bind(username, limit)
    .all<Notification>();

  return res.results || [];
}

export async function markNotificationsRead(db: D1Database, username: string): Promise<void> {
  await db
    .prepare('UPDATE notifications SET is_read = 1 WHERE recipient_username = ?')
    .bind(username)
    .run();
}

/**
 * Search
 */
export async function searchContent(
  db: D1Database,
  query: string,
  filterUser?: string,
  filterPostId?: string,
  limit = 50
): Promise<{ posts: Post[]; comments: Comment[] }> {
  const likeQuery = `%${query}%`;

  // Search posts
  let postSql = 'SELECT * FROM posts WHERE (title LIKE ? OR content LIKE ?)';
  const postParams: any[] = [likeQuery, likeQuery];

  if (filterUser) {
    postSql += ' AND author_username = ?';
    postParams.push(filterUser);
  }
  if (filterPostId) {
    postSql += ' AND id = ?';
    postParams.push(filterPostId);
  }
  postSql += ' ORDER BY created_at DESC LIMIT ?';
  postParams.push(limit);

  const postsRes = await db.prepare(postSql).bind(...postParams).all<Post>();

  // Search comments
  let commentSql = 'SELECT * FROM comments WHERE content LIKE ?';
  const commentParams: any[] = [likeQuery];

  if (filterUser) {
    commentSql += ' AND author_username = ?';
    commentParams.push(filterUser);
  }
  if (filterPostId) {
    commentSql += ' AND post_id = ?';
    commentParams.push(filterPostId);
  }
  commentSql += ' ORDER BY created_at DESC LIMIT ?';
  commentParams.push(limit);

  const commentsRes = await db.prepare(commentSql).bind(...commentParams).all<Comment>();

  return {
    posts: postsRes.results || [],
    comments: commentsRes.results || [],
  };
}

/**
 * Media
 */
export async function saveMedia(
  db: D1Database,
  id: string,
  uploaderUsername: string,
  filename: string,
  mimeType: string,
  data: ArrayBuffer,
  sizeBytes: number
): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO media (id, uploader_username, filename, mime_type, data, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, uploaderUsername, filename, mimeType, data, sizeBytes, now)
    .run();
}

export async function getMediaById(db: D1Database, id: string): Promise<MediaRecord | null> {
  return await db
    .prepare('SELECT * FROM media WHERE id = ?')
    .bind(id)
    .first<MediaRecord>();
}
