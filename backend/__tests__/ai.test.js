import { vi } from 'vitest';

// 1. Mock the GoogleGenAI client completely before importing our app
vi.mock('../config/ai.js', () => {
    return {
        aiClient: {
            models: {
                generateContent: vi.fn().mockImplementation(async (req) => {
                    const prompt = req.contents;
                    
                    if (prompt.includes('predict how many days')) {
                        // predictDeadline mock
                        return { text: () => "5" };
                    } 
                    
                    if (prompt.includes('actionable subtasks')) {
                        // aiBreakdown mock
                        if (prompt.includes('Title: "gibberish"')) {
                            return { text: () => '["I_DONT_KNOW"]' };
                        }
                        return { text: () => '["Mock Subtask 1", "Mock Subtask 2"]' };
                    }
                    
                    if (prompt.includes('Daily Standup')) {
                        // aiStandUp mock
                        return { text: () => "Mocked Standup Report: Everything is going great!" };
                    }

                    return { text: () => "{}" };
                })
            }
        }
    };
});

import request from 'supertest';
import { app } from '../server.js';
import { db } from '../db/index.js';
import { usersTable, projectsTable, tasksTable, projectMembers } from '../models/index.js';
import { eq } from 'drizzle-orm';
import { webToken } from '../utils/accesstoken.js';

describe('AI Features Endpoints', () => {
  let adminToken = '';
  let memberToken = '';
  let testProjectId = null;
  let testTaskId = null;

  beforeAll(async () => {
    // Clean up
    await db.delete(usersTable).where(eq(usersTable.email, 'aiadmin@agenticagile.com'));
    await db.delete(usersTable).where(eq(usersTable.email, 'aimember@agenticagile.com'));

    // Create Admin
    const [admin] = await db.insert(usersTable).values({
      name: 'AI Admin',
      email: 'aiadmin@agenticagile.com',
      password: 'testpassword'
    }).returning();
    adminToken = webToken({ id: admin.id, name: admin.name, email: admin.email });

    // Create Member
    const [member] = await db.insert(usersTable).values({
      name: 'AI Member',
      email: 'aimember@agenticagile.com',
      password: 'testpassword'
    }).returning();
    memberToken = webToken({ id: member.id, name: member.name, email: member.email });

    // Create Project
    const [project] = await db.insert(projectsTable).values({
      name: "AI Test Project",
      description: "Project for AI features",
      createdBy: admin.id
    }).returning();
    testProjectId = project.id;

    await db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: member.id,
      role: 'member'
    });

    await db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: admin.id,
      role: 'admin'
    });

    // Create Task (Assigned to Admin, so Member cannot breakdown)
    const [task] = await db.insert(tasksTable).values({
      projectId: testProjectId,
      title: "Fix the AI bug",
      description: "The AI is hallucinating",
      createdBy: admin.id,
      assigneeId: admin.id
    }).returning();
    testTaskId = task.id;
  });

  afterAll(async () => {
    // Cascades will delete project and tasks since we fixed the schema
    await db.delete(usersTable).where(eq(usersTable.email, 'aiadmin@agenticagile.com'));
    await db.delete(usersTable).where(eq(usersTable.email, 'aimember@agenticagile.com'));
  });

  describe('POST /api/v1/tasks/:projectId/predict-deadline', () => {
    it('should successfully predict deadline (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${testProjectId}/predict-deadline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: "Build the auth system",
          description: "Use JWTs"
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.predictedDays).toBe(5);
    });
  });

  describe('POST /api/v1/tasks/:projectId/t/:taskId/ai-breakdown/generate', () => {
    it('should reject a regular member trying to break down someone else\'s task (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${testProjectId}/t/${testTaskId}/ai-breakdown/generate`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});

      expect(res.statusCode).toBe(403);
    });

    it('should return 400 if the AI determines the task is gibberish', async () => {
      // Temporarily update the task to gibberish to trigger our mock logic
      await db.update(tasksTable).set({ title: "gibberish" }).where(eq(tasksTable.id, testTaskId));

      const res = await request(app)
        .post(`/api/v1/tasks/${testProjectId}/t/${testTaskId}/ai-breakdown/generate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/could not understand/i);

      // Revert title for next tests
      await db.update(tasksTable).set({ title: "Fix the AI bug" }).where(eq(tasksTable.id, testTaskId));
    });

    it('should successfully return AI subtasks (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${testProjectId}/t/${testTaskId}/ai-breakdown/generate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.subtasks)).toBe(true);
      expect(res.body.subtasks[0]).toBe("Mock Subtask 1");
    });
  });

  describe('GET /api/v1/tasks/:projectId/ai-standup', () => {
    it('should successfully generate an AI Standup report (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${testProjectId}/ai-standup`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.summary).toBe("Mocked Standup Report: Everything is going great!");
    });
  });

});
