import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Validation & Error Handling', () => {
  it('POST /api/v1/auth/login with empty body fails with 422', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('GET non-existent endpoint returns 404', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('RESOURCE_NOT_FOUND');
  });

  it('GET protected endpoint without token returns 401', async () => {
    const res = await request(app).get('/api/v1/departments');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('UNAUTHORIZED');
  });
});
