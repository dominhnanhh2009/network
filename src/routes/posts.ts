import { Hono } from 'hono';
import { Bindings, User } from '../types';
import {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  incrementPostViews,
  getCommentsByPostId,
  buildCommentTree,
  addComment,
  deleteComment,
  getUserGainedVotes,
} from '../db/queries';
import { htmlLayout, renderNewPostForm, renderEditPostForm, renderPostDetail } from '../ui/templates';
import { formatLLMPostDetail, isJsonMode, isLLMMode } from '../llm/formatter';

export const postsRouter = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

// New post form
postsRouter.get('/posts/new', async (c) => {
  const currentUser = c.get('currentUser');
  if (!currentUser) return c.redirect('/login');
  const gainedVotes = await getUserGainedVotes(c.env.DB, currentUser.username);
  return c.html(htmlLayout('Create Post', renderNewPostForm(currentUser), currentUser, gainedVotes));
});

// Create post endpoint
postsRouter.post('/posts', async (c) => {
  const currentUser = c.get('currentUser');
  if (!currentUser) {
    if (isJsonMode(c) || isLLMMode(c)) {
      return c.json({ error: 'Unauthorized. Login required to create a post.' }, 401);
    }
    return c.redirect('/login');
  }

  let title = '';
  let slug = '';
  let content = '';
  let media_url = '';

  const contentType = c.req.header('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const body = await c.req.json<any>().catch(() => ({}));
    title = body.title?.trim() || '';
    slug = body.slug?.trim() || '';
    content = body.content?.trim() || '';
    media_url = body.media_url?.trim() || '';
  } else {
    const body = await c.req.parseBody();
    title = (body.title as string)?.trim() || '';
    slug = (body.slug as string)?.trim() || '';
    content = (body.content as string)?.trim() || '';
    media_url = (body.media_url as string)?.trim() || '';
  }

  if (!content) {
    return c.json({ error: 'Post content is required' }, 400);
  }

  const post = await createPost(c.env.DB, currentUser.username, slug, title, content, media_url);

  if (isJsonMode(c)) {
    return c.json({ status: 'success', post }, 201);
  }
  if (isLLMMode(c)) {
    return c.text(`# Post Created Successfully\nID: ${post.id}\nURL: ${post.id}?mode=llm\n`, 201);
  }

  return c.redirect(post.id);
});

// View post: /:username/:slug
postsRouter.get('/:username/:slug', async (c) => {
  const username = c.req.param('username');
  const slug = c.req.param('slug');
  const postId = `/${username}/${slug}`;

  const post = await getPostById(c.env.DB, postId);
  if (!post) {
    if (isJsonMode(c) || isLLMMode(c)) {
      return c.json({ error: 'Post not found', id: postId }, 404);
    }
    return c.text('Post not found', 404);
  }

  // Increment views
  await incrementPostViews(c.env.DB, postId);
  post.views += 1;

  // Fetch comments and build tree (max 100 comments)
  const rawComments = await getCommentsByPostId(c.env.DB, postId);
  const commentTree = buildCommentTree(rawComments);

  const currentUser = c.get('currentUser');

  if (isJsonMode(c)) {
    return c.json({
      post,
      comment_count: rawComments.length,
      comments: commentTree,
    });
  }

  if (isLLMMode(c)) {
    return c.text(formatLLMPostDetail(post, commentTree, currentUser));
  }

  let gainedVotes = 0;
  if (currentUser) {
    gainedVotes = await getUserGainedVotes(c.env.DB, currentUser.username);
  }

  return c.html(
    htmlLayout(
      post.title || post.slug,
      renderPostDetail(post, commentTree, currentUser),
      currentUser,
      gainedVotes
    )
  );
});

// Edit post form
postsRouter.get('/:username/:slug/edit', async (c) => {
  const username = c.req.param('username');
  const slug = c.req.param('slug');
  const postId = `/${username}/${slug}`;
  const currentUser = c.get('currentUser');

  if (!currentUser || currentUser.username !== username) {
    return c.text('Forbidden: Only the author can edit this post', 403);
  }

  const post = await getPostById(c.env.DB, postId);
  if (!post) return c.text('Post not found', 404);

  const gainedVotes = await getUserGainedVotes(c.env.DB, currentUser.username);
  return c.html(htmlLayout(`Edit: ${post.title}`, renderEditPostForm(post), currentUser, gainedVotes));
});

// Update post (support PUT and POST form)
const handlePostUpdate = async (c: any) => {
  const username = c.req.param('username');
  const slug = c.req.param('slug');
  const postId = `/${username}/${slug}`;
  const currentUser = c.get('currentUser');

  if (!currentUser || currentUser.username !== username) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  let title = '';
  let content = '';
  let media_url = '';

  const contentType = c.req.header('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => ({}))) as any;
    title = body?.title?.trim() || '';
    content = body?.content?.trim() || '';
    media_url = body?.media_url?.trim() || '';
  } else {
    const body = await c.req.parseBody();
    title = (body.title as string)?.trim() || '';
    content = (body.content as string)?.trim() || '';
    media_url = (body.media_url as string)?.trim() || '';
  }

  if (!content) {
    return c.json({ error: 'Content cannot be empty' }, 400);
  }

  const ok = await updatePost(c.env.DB, postId, currentUser.username, title, content, media_url);
  if (!ok) return c.json({ error: 'Failed to update post' }, 400);

  if (isJsonMode(c)) return c.json({ status: 'success', id: postId });
  if (isLLMMode(c)) return c.text(`# Post Updated: ${postId}\n`);
  return c.redirect(postId);
};

postsRouter.put('/:username/:slug', handlePostUpdate);
postsRouter.post('/:username/:slug/edit', handlePostUpdate);

// Delete post (support DELETE and POST form)
const handlePostDelete = async (c: any) => {
  const username = c.req.param('username');
  const slug = c.req.param('slug');
  const postId = `/${username}/${slug}`;
  const currentUser = c.get('currentUser');

  if (!currentUser || currentUser.username !== username) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const ok = await deletePost(c.env.DB, postId, currentUser.username);
  if (!ok) return c.json({ error: 'Failed to delete post' }, 400);

  if (isJsonMode(c)) return c.json({ status: 'success', message: 'Post deleted' });
  if (isLLMMode(c)) return c.text(`# Post Deleted: ${postId}\n`);
  return c.redirect('/');
};

postsRouter.delete('/:username/:slug', handlePostDelete);
postsRouter.post('/:username/:slug/delete', handlePostDelete);

// Add comment to post
postsRouter.post('/:username/:slug/comments', async (c) => {
  const username = c.req.param('username');
  const slug = c.req.param('slug');
  const postId = `/${username}/${slug}`;
  const currentUser = c.get('currentUser');

  if (!currentUser) {
    if (isJsonMode(c) || isLLMMode(c)) {
      return c.json({ error: 'Unauthorized. Login required to comment.' }, 401);
    }
    return c.redirect('/login');
  }

  let content = '';
  let parent_id: string | null = null;
  let media_url: string | null = null;

  const contentType = c.req.header('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const body = await c.req.json<any>().catch(() => ({}));
    content = body.content?.trim() || '';
    parent_id = body.parent_id || null;
    media_url = body.media_url || null;
  } else {
    const body = await c.req.parseBody();
    content = (body.content as string)?.trim() || '';
    parent_id = (body.parent_id as string) || null;
    media_url = (body.media_url as string) || null;
  }

  if (!content) {
    return c.json({ error: 'Comment content cannot be empty' }, 400);
  }

  const res = await addComment(c.env.DB, postId, parent_id, currentUser.username, content, media_url);
  if (!res.success) {
    return c.json({ error: res.error }, 400);
  }

  if (isJsonMode(c)) {
    return c.json({ status: 'success', comment: res.comment }, 201);
  }
  if (isLLMMode(c)) {
    return c.text(`# Comment Created: ${res.comment?.id} on ${postId}\n`, 201);
  }

  return c.redirect(`${postId}#${res.comment?.id}`);
});

// Delete comment
const handleCommentDelete = async (c: any) => {
  const commentId = c.req.param('id');
  const currentUser = c.get('currentUser');

  if (!currentUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const ok = await deleteComment(c.env.DB, commentId, currentUser.username);
  if (!ok) {
    return c.json({ error: 'Failed to delete comment. Either not found or not author.' }, 403);
  }

  if (isJsonMode(c)) return c.json({ status: 'success', message: 'Comment deleted' });
  if (isLLMMode(c)) return c.text(`# Comment Deleted: ${commentId}\n`);

  const referer = c.req.header('Referer');
  return c.redirect(referer || '/');
};

postsRouter.delete('/comments/:id', handleCommentDelete);
postsRouter.post('/comments/:id/delete', handleCommentDelete);
