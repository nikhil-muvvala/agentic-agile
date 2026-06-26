import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { db } from '../db/index.js';
import { usersTable, projectsTable, tasksTable, notesTable, projectMembers } from '../models/index.js';
import { eq, inArray } from 'drizzle-orm';
import { webToken } from '../utils/accesstoken.js';

describe('Notes API', () => {
  let adminToken = '';
  let testProjectId = null;
  let testTaskId = null;
  let testNoteId = null;
  let adminUser = null;

  beforeAll(async () => {
    await db.delete(usersTable).where(eq(usersTable.email, 'notes_admin@test.com'));

    // Create Admin
    const [admin] = await db.insert(usersTable).values({
      name: 'Notes Admin',
      email: 'notes_admin@test.com',
      password: 'password'
    }).returning();
    adminUser = admin;
    adminToken = webToken({ id: admin.id, name: admin.name, email: admin.email });

    // Create Project
    const [project] = await db.insert(projectsTable).values({
      name: 'Notes Test Project',
      description: 'Testing notes',
      createdBy: admin.id
    }).returning();
    testProjectId = project.id;

    await db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: admin.id,
      role: 'admin'
    });

    // Create Task
    const [task] = await db.insert(tasksTable).values({
      projectId: testProjectId,
      title: 'Note Task',
      description: 'Testing notes on this task',
      priority: 'low',
      status: 'todo',
      reporterId: admin.id
    }).returning();
    testTaskId = task.id;
  });

  afterAll(async () => {
    if (testNoteId) {
      await db.delete(notesTable).where(eq(notesTable.id, testNoteId));
    }
    await db.delete(tasksTable).where(eq(tasksTable.id, testTaskId));
    await db.delete(projectsTable).where(eq(projectsTable.id, testProjectId));
    await db.delete(usersTable).where(eq(usersTable.id, adminUser.id));
  });

  it('should add a note to a project', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${testProjectId}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test Note Title', content: 'This is a test note' });

    expect(res.statusCode).toBe(201);
    expect(res.body.note).toHaveProperty('id');
    expect(res.body.note.title).toBe('Test Note Title');
    
    testNoteId = res.body.note.id; // Save for later tests
  });

  it('should list all notes for a project', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${testProjectId}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.notes)).toBe(true);
    expect(res.body.notes.length).toBeGreaterThan(0);
  });

  it('should update a note', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${testProjectId}/notes/${testNoteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title', content: 'Updated test note content' });

    expect(res.statusCode).toBe(200);
    expect(res.body.note.content).toBe('Updated test note content');
  });

  it('should delete a note', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${testProjectId}/notes/${testNoteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/deleted successfully/);
    
    testNoteId = null; // Cleaned up
  });
});
