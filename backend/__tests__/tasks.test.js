import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../server.js';
import { db } from '../db/index.js';
import { usersTable, projectsTable, tasksTable, projectMembers } from '../models/index.js';
import { eq } from 'drizzle-orm';
import { webToken } from '../utils/accesstoken.js';

describe('Task Management Endpoints', () => {
  let testToken = '';
  let memberToken = '';
  let testProjectId = null;
  let createdTaskId = null;

  beforeAll(async () => {
    // 1. Clean up old test data to ensure a fresh state
    await db.delete(usersTable).where(eq(usersTable.email, 'testuser@agenticagile.com'));
    await db.delete(usersTable).where(eq(usersTable.email, 'member@agenticagile.com'));
    // 2. Hit the dev-login to automatically generate our user and token
    const loginRes = await request(app).post('/api/v1/auth/dev-login').send();
    testToken = loginRes.body.accessToken;
    // 3. Create a Project so we have somewhere to put our Tasks
    const projectRes = await request(app)
      .post('/api/v1/projects/project-creation')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        name: "Task Testing Project",
        description: "Project specifically created to test tasks"
      });
    testProjectId = projectRes.body.projectId;

    // 4. Create a secondary "Member" user and add them to the project
    const [member] = await db.insert(usersTable).values({
      name: 'Task Member',
      email: 'member@agenticagile.com',
      password: 'testpassword'
    }).returning();
    memberToken = webToken({ id: member.id, name: member.name, email: member.email });

    await db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: member.id,
      role: 'member'
    });
  });

  afterAll(async () => {
    // Cascades down automatically due to our brilliant new schema
    await db.delete(usersTable).where(eq(usersTable.email, 'testuser@agenticagile.com'));
    await db.delete(usersTable).where(eq(usersTable.email, 'member@agenticagile.com'));
  });

  describe('POST /api/v1/tasks/:projectId', () => {
    it('should reject task creation if token is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${testProjectId}`)
        .send({ title: "Hacker Task" });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Please enter token');
    });

    it('should reject task creation if title is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ description: "Missing title" });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('should reject task creation if a regular member tries to do it (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${testProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: "Member Task",
          description: "Members cannot create tasks"
        });

      expect(res.statusCode).toBe(403);
    });

    it('should successfully create a new task', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: "Write Integration Tests",
          description: "Ensure test coverage hits 100%"
        });

      expect(201).toBe(res.statusCode);
      expect(res.body).toHaveProperty('task');
      expect(res.body.task).toHaveProperty('id');
      
      createdTaskId = res.body.task.id;
    });
  });

  describe('GET /api/v1/tasks/:projectId', () => {
    it('should reject if token is missing (400)', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${testProjectId}`)
        .send();
      expect(res.statusCode).toBe(400);
    });

    it('should retrieve a list of tasks for the project', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send();

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.tasks)).toBe(true);
      expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/tasks/:projectId/t/:taskId', () => {
    it('should retrieve specific task details', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('task');
      expect(res.body.task.id).toBe(createdTaskId);
    });
  });

  describe('PATCH /api/v1/tasks/:projectId/t/:taskId', () => {
    it('should reject if token is missing (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}`)
        .send({ title: "Hack" });
      expect(res.statusCode).toBe(400);
    });

    it('should reject if a regular member tries to update details (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Hack" });
      expect(res.statusCode).toBe(403);
    });

    it('should successfully update task details', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: "Updated Task Title" });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /api/v1/tasks/:projectId/t/:taskId/status', () => {
    it('should reject if token is missing (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}/status`)
        .send({ status: "in_progress" });
      expect(res.statusCode).toBe(400);
    });

    it('should update the status of the task', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}/status`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          status: "in_progress"
        });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/v1/tasks/:projectId/t/:taskId', () => {
    it('should reject if token is missing (400)', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}`)
        .send();
      expect(res.statusCode).toBe(400);
    });

    it('should reject a regular member trying to delete the task (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send();

      expect(res.statusCode).toBe(403);
    });

    it('should successfully delete the task', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${testProjectId}/t/${createdTaskId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send();

      expect(res.statusCode).toBe(200);
    });
  });

});
