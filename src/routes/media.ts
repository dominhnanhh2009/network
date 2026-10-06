import { Hono } from 'hono';
import { Bindings, User } from '../types';
import { getMediaById, saveMedia } from '../db/queries';

export const mediaRouter = new Hono<{ Bindings: Bindings; Variables: { currentUser: User | null } }>();

mediaRouter.post('/upload', async (c) => {
  const currentUser = c.get('currentUser');
  if (!currentUser) {
    return c.json({ error: 'Unauthorized. Please login to upload media.' }, 401);
  }

  try {
    const contentType = c.req.header('Content-Type') || '';
    let filename = `media_${Date.now()}`;
    let mimeType = 'application/octet-stream';
    let buffer: ArrayBuffer;

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.parseBody();
      const file = formData['file'] as File;
      if (!file || typeof file === 'string') {
        return c.json({ error: 'No file provided in form field "file"' }, 400);
      }
      filename = file.name || filename;
      mimeType = file.type || mimeType;
      buffer = await file.arrayBuffer();
    } else {
      mimeType = contentType || mimeType;
      buffer = await c.req.arrayBuffer();
    }

    if (buffer.byteLength === 0) {
      return c.json({ error: 'Empty file payload' }, 400);
    }

    // Check size limit: D1 row max ~2MB
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 2MB limit for native storage' }, 413);
    }

    const id = `m_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await saveMedia(c.env.DB, id, currentUser.username, filename, mimeType, buffer, buffer.byteLength);

    const mediaUrl = `/media/${id}`;
    return c.json({
      status: 'success',
      id,
      url: mediaUrl,
      filename,
      mime_type: mimeType,
      size_bytes: buffer.byteLength,
    }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to upload media' }, 500);
  }
});

mediaRouter.get('/media/:id', async (c) => {
  const id = c.req.param('id');
  const media = await getMediaById(c.env.DB, id);
  if (!media) {
    return c.text('Media not found', 404);
  }

  let bodyData: BodyInit;
  if (Array.isArray(media.data)) {
    bodyData = new Uint8Array(media.data);
  } else if (media.data instanceof ArrayBuffer || (media.data as any) instanceof Uint8Array) {
    bodyData = media.data;
  } else {
    bodyData = new Uint8Array(media.data as any);
  }

  return new Response(bodyData, {
    status: 200,
    headers: {
      'Content-Type': media.mime_type,
      'Content-Length': media.size_bytes.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename="${encodeURIComponent(media.filename)}"`,
    },
  });
});
