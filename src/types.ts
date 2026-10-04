export type Bindings = {
  DB: D1Database;
};

export interface User {
  username: string;
  password: string;
  created_at: number;
}

export interface Post {
  id: string; // format: "/{author_username}/{slug}"
  author_username: string;
  slug: string;
  title: string;
  content: string;
  media_url?: string | null;
  views: number;
  upvotes: number;
  downvotes: number;
  created_at: number;
  updated_at: number;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id?: string | null;
  author_username: string;
  content: string;
  media_url?: string | null;
  upvotes: number;
  downvotes: number;
  created_at: number;
  updated_at: number;
}

export interface CommentTreeNode extends Comment {
  replies: CommentTreeNode[];
}

export interface Vote {
  id: number;
  username: string;
  target_type: 'post' | 'comment';
  target_id: string;
  vote_type: 1 | -1;
  created_at: number;
}

export interface Notification {
  id: number;
  recipient_username: string;
  post_id: string;
  message: string;
  is_read: number;
  created_at: number;
}

export interface MediaRecord {
  id: string;
  uploader_username: string;
  filename: string;
  mime_type: string;
  data: ArrayBuffer;
  size_bytes: number;
  created_at: number;
}
