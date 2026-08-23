import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health API', () => {
  it('GET /health returns health status payload', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBeDefined();
    expect(res.body).toHaveProperty('service', 'SchedulAI API Gateway');
    expect(res.body).toHaveProperty('timestamp');
  });
});
