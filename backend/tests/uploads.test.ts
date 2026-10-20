import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, signup } from './helpers';

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('image uploads', () => {
  it('requires authentication', async () => {
    const res = await request(getApp())
      .post('/api/uploads/image?kind=logo')
      .set('X-Requested-With', 'XMLHttpRequest')
      .attach('file', PNG, 'a.png');
    expect(res.status).toBe(401);
  });

  it('accepts a real image and returns a URL on our storage', async () => {
    const { agent: a } = await signup();
    const res = await a.raw
      .post('/api/uploads/image?kind=logo')
      .set('X-Requested-With', 'XMLHttpRequest')
      .attach('file', PNG, 'logo.png');
    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/\/uploads\/logo\/[a-f0-9]+\.png$/);
  });

  it('rejects a non-image disguised with an image name/mimetype', async () => {
    const { agent: a } = await signup();
    const res = await a.raw
      .post('/api/uploads/image?kind=logo')
      .set('X-Requested-With', 'XMLHttpRequest')
      .attach('file', Buffer.from('<script>alert(1)</script> not an image at all'), {
        filename: 'x.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE');
  });

  it('rejects files over the size limit', async () => {
    const { agent: a } = await signup();
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 10)]);
    const res = await a.raw
      .post('/api/uploads/image?kind=banner')
      .set('X-Requested-With', 'XMLHttpRequest')
      .attach('file', big, 'big.png');
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects unknown upload kinds', async () => {
    const { agent: a } = await signup();
    const res = await a.raw
      .post('/api/uploads/image?kind=../../etc')
      .set('X-Requested-With', 'XMLHttpRequest')
      .attach('file', PNG, 'a.png');
    expect(res.status).toBe(400);
  });
});
