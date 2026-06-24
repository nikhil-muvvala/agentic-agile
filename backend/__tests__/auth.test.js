import { describe, expect, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../server.js';
import { db } from '../db/index.js';
import { usersTable } from '../models/User.js';
import { eq } from 'drizzle-orm';

describe('Auth Endpoints', () => {
  let testToken = '';

  // Clean up any test users before we start
  beforeAll(async () => {
    await db.delete(usersTable).where(eq(usersTable.email, 'testuser@agenticagile.com'));
  });

  // Clean up after we finish
  afterAll(async () => {
    await db.delete(usersTable).where(eq(usersTable.email, 'testuser@agenticagile.com'));
  });

  describe('POST /api/v1/auth/dev-login', () => {
    it('should generate a valid JWT token for the test user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/dev-login')
        .send(); // No body needed

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Dev Login Successful');
      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
      
      // Save token for future tests in this suite
      testToken = res.body.accessToken; 
    });

    it('should return 403 Forbidden if running in production mode', async () => {
      // 1. Temporarily trick the server into thinking it is in Production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // 2. Fire the request
      const res = await request(app).post('/api/v1/auth/dev-login').send();

      // 3. Assert it blocks the hacker
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('message', 'Forbidden');

      // 4. CHANGE IT BACK! (Crucial so we don't break the other tests)
      process.env.NODE_ENV = originalEnv;
    });

  });

  describe('GET /api/v1/auth/current-user', () => {
    it('should reject requests that have no token with a 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/api/v1/auth/current-user');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('should return user details when provided a valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/current-user')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('email', 'testuser@agenticagile.com');
      expect(res.body).toHaveProperty('name', 'Test User');
    });
  });

  describe('POST /api/v1/auth/logout',() => {
    test('it should reject if the request dont have a accesstoken', async ()=>{
      const res=await request(app).post('/api/v1/auth/logout');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message');
    });
    
    test('POST /api/v1/auth/logout',async () => {
      const res=await request(app).post('/api/v1/auth/logout')
                                  .set('Authorization', `Bearer ${testToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  })

});
