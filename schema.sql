-- Users table
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Posts table
-- Post ID format: "/{author_username}/{slug}"
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_username TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  media_url TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (author_username) REFERENCES users(username)
);

-- Comments table (Tree structure up to 100 per post)
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  parent_id TEXT,
  author_username TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_username) REFERENCES users(username)
);

-- Votes tracking table (prevent double voting, track up/down)
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'post' or 'comment'
  target_id TEXT NOT NULL,
  vote_type INTEGER NOT NULL, -- 1 for up, -1 for down
  created_at INTEGER NOT NULL,
  UNIQUE(username, target_type, target_id)
);

-- Notifications table (distributed per spec mechanics)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_username TEXT NOT NULL,
  post_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(recipient_username, post_id),
  FOREIGN KEY (recipient_username) REFERENCES users(username),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Native media storage table (images, attachments, files)
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  uploader_username TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BLOB NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (uploader_username) REFERENCES users(username)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_username);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_username);
CREATE INDEX IF NOT EXISTS idx_media_uploader ON media(uploader_username);
