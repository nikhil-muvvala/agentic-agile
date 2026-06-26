import { vi } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { db } from '../db/index.js';
import { usersTable, projectsTable, projectMembers, tasksTable } from '../models/index.js';
import { eq } from 'drizzle-orm';
import { webToken } from '../utils/accesstoken.js';

describe('Project Management Endpoints', () => {
  let testToken = '';
  let memberToken = '';
  let memberId = null;
  let createdProjectId = null;

  beforeAll(async () => {
    await db.delete(usersTable).where(eq(usersTable.email, 'testuser@agenticagile.com'));
    await db.delete(usersTable).where(eq(usersTable.email, 'member@agenticagile.com'));
    
    // 2. We need a token to test projects. Hit the dev-login to automatically generate our user and token!
    const loginRes = await request(app).post('/api/v1/auth/dev-login').send();
    testToken = loginRes.body.accessToken;

    // 3. Create a secondary "Member" user and generate their token
    const [member] = await db.insert(usersTable).values({
      name: 'Test Member',
      email: 'member@agenticagile.com',
      password: 'testpassword'
    }).returning();
    memberId = member.id;
    memberToken = webToken({ id: member.id, name: member.name, email: member.email });
  });

  afterAll(async () => {
    await db.delete(usersTable).where(eq(usersTable.email, 'testuser@agenticagile.com'));
    await db.delete(usersTable).where(eq(usersTable.email, 'member@agenticagile.com'));
  });

  describe('POST /api/v1/projects/project-creation', () => {
    
    it('should reject requests that have no token with a 400', async () => {
      const res = await request(app)
        .post('/api/v1/projects/project-creation')
        .send({ name: "Hacker Project" }); // Notice: No .set('Authorization')!

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Please enter token');
    });

    it('should reject a project if the name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/projects/project-creation')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          description: "Missing the name field!"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('should successfully create a new project', async () => {
      const res = await request(app)
        .post('/api/v1/projects/project-creation')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: "Test Agile Project",
          description: "This is a test project created by Jest"
        });

      expect(201).toBe(res.statusCode);
      expect(res.body).toHaveProperty('projectId');
      
      // Save the ID so we can test the view/delete routes later!
      createdProjectId = res.body.projectId;

      // Add the secondary user to this project as a "member" so we can test RBAC!
      await db.insert(projectMembers).values({
        projectId: createdProjectId,
        userId: memberId,
        role: 'member'
      });
    });

    it('should prevent creating a project with the exact same name', async () => {
      const res = await request(app)
        .post('/api/v1/projects/project-creation')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: "Test Agile Project",
          description: "Duplicate name"
        });

      // We expect the duplicate name logic to block it
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/projects/viewProjects', () => {

    it('should reject requests that have no token with a 400', async () => {
      const res = await request(app)
        .get('/api/v1/projects/viewProjects')
        .send(); // Notice: No .set('Authorization')!

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Please enter token');
    });

    it('should return a list of projects the user is a part of', async () => {
      const res = await request(app)
        .get('/api/v1/projects/viewProjects')
        .set('Authorization', `Bearer ${testToken}`)
        .send();

      expect(res.statusCode).toBe(200);
      // It should return an array since the user has 1 project now
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/projects/project-details/:projectId', () => {

    
    it('should reject requests that have no token with a 400', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/project-details/${createdProjectId}`)
        .send(); // Notice: No .set('Authorization')!

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Please enter token');
    });

    it('should return project details for a valid project', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/project-details/${createdProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.project).toHaveProperty('id', createdProjectId);
      expect(res.body.project).toHaveProperty('name', 'Test Agile Project');
    });

    it('should reject invalid project IDs', async () => {
      const res = await request(app)
        .get('/api/v1/projects/project-details/invalid_id')
        .set('Authorization', `Bearer ${testToken}`)
        .send();

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/v1/projects/project-update/:projectId', () => {

    it('should reject requests that have no token with a 400', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/project-update/${createdProjectId}`)
        .send(); // Notice: No .set('Authorization')!

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Please enter token');
    });

    it('should reject a regular member trying to update the project with a 403', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/project-update/${createdProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: "Hacker Update",
          description: "Hacker Description"
        });

      expect(res.statusCode).toBe(403);
    });

    it('should successfully update the project details', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/project-update/${createdProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: "Updated Agile Project",
          description: "Updated description"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Project successfully updated');
    });

    it('should reject updates with missing fields', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/project-update/${createdProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: "Only Name Provided"
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/projects/project-delete/:projectId', () => {

    it('should reject requests that have no token with a 400', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/project-delete/${createdProjectId}`)
        .send(); // Notice: No .set('Authorization')!

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Please enter token');
    });

    it('should reject a regular member trying to delete the project with a 403', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/project-delete/${createdProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send();

      expect(res.statusCode).toBe(403);
    });

    it('should successfully delete the project', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/project-delete/${createdProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Project successfully deleted');
      
      // Nullify the ID so the afterAll block doesn't try to delete a non-existent project
      createdProjectId = null;
    });
  });
});
