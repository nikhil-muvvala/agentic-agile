import { vi } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { db } from '../db/index.js';
import { usersTable, projectsTable, tasksTable, projectMembers, subtasksTable } from '../models/index.js';
import { eq } from 'drizzle-orm';
import { webToken } from '../utils/accesstoken.js';

describe('Subtask Management Endpoints', () => {
  let testToken = '';
  let memberToken = '';
  let testProjectId = null;
  let testTaskId = null;
  let createdSubtaskId = null;

  beforeAll(async () => {
    // 1. Clean up old test data
    await db.delete(usersTable).where(eq(usersTable.email, 'testuser@agenticagile.com'));
    await db.delete(usersTable).where(eq(usersTable.email, 'member@agenticagile.com'));

    // 2. Hit the dev-login to automatically generate our Admin user and token
    const loginRes = await request(app).post('/api/v1/auth/dev-login').send();
    testToken = loginRes.body.accessToken;

    // 3. Create a Project
    const projectRes = await request(app)
      .post('/api/v1/projects/project-creation')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        name: "Subtask Testing Project",
        description: "Project specifically created to test subtasks"
      });
    testProjectId = projectRes.body.projectId;

    // 4. Create a secondary "Member" user and add them to the project
    const [member] = await db.insert(usersTable).values({
      name: 'Subtask Member',
      email: 'member@agenticagile.com',
      password: 'testpassword'
    }).returning();
    memberToken = webToken({ id: member.id, name: member.name, email: member.email });

    await db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: member.id,
      role: 'member'
    });

    // 5. Create a Task inside the Project to hold the Subtasks
    const taskRes = await request(app)
      .post(`/api/v1/tasks/${testProjectId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        title: "Parent Task for Subtasks",
        description: "This task holds subtasks"
      });
    testTaskId = taskRes.body.task.id;
  });

  afterAll(async () => {
    await db.delete(usersTable).where(eq(usersTable.email, 'testuser@agenticagile.com'));
    await db.delete(usersTable).where(eq(usersTable.email, 'member@agenticagile.com'));
  });

  describe('POST /api/v1/projects/:projectId/t/:taskId/subtasks', () => {
    it('should reject if token is missing (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks`)
        .send({ title: "Hack Subtask" });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Please enter token');
    });

    it('should reject if title is missing (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Subtask title is required');
    });

    it('should reject subtask creation if a regular member tries to do it (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Member Subtask" });

      expect(res.statusCode).toBe(403);
    });

    it('should successfully create a new subtask (Admin)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: "Write subtask tests" });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('subtask');
      expect(res.body.subtask).toHaveProperty('id');
      
      createdSubtaskId = res.body.subtask.id;
    });
  });

  describe('PATCH /api/v1/projects/:projectId/t/:taskId/subtasks/:subtaskId', () => {
    it('should reject if token is missing (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks/${createdSubtaskId}`)
        .send({ title: "Hack Update" });

      expect(res.statusCode).toBe(400);
    });

    it('should reject if a regular member tries to update the title (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks/${createdSubtaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: "Hack Update" });

      expect(res.statusCode).toBe(403);
    });

    it('should successfully update the subtask title (Admin)', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks/${createdSubtaskId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: "Updated Subtask Title" });

      expect(res.statusCode).toBe(200);
      expect(res.body.subtask.title).toBe("Updated Subtask Title");
    });
  });

  describe('PATCH /api/v1/projects/:projectId/t/:taskId/subtasks/:subtaskId/status', () => {
    it('should reject if token is missing (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks/${createdSubtaskId}/status`)
        .send({ isCompleted: true });

      expect(res.statusCode).toBe(400);
    });

    it('should allow a regular member to toggle the status (200)', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks/${createdSubtaskId}/status`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ isCompleted: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.subtask.isCompleted).toBe(true);
    });
  });

  describe('DELETE /api/v1/projects/:projectId/t/:taskId/subtasks/:subtaskId', () => {
    it('should reject if token is missing (400)', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks/${createdSubtaskId}`)
        .send();

      expect(res.statusCode).toBe(400);
    });

    it('should reject a regular member trying to delete the subtask (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks/${createdSubtaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send();

      expect(res.statusCode).toBe(403);
    });

    it('should successfully delete the subtask (Admin)', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${testProjectId}/t/${testTaskId}/subtasks/${createdSubtaskId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send();

      expect(res.statusCode).toBe(200);
    });
  });

});
