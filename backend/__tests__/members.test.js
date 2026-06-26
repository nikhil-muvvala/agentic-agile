import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { db } from '../db/index.js';
import { usersTable, projectsTable, projectMembers } from '../models/index.js';
import { eq, inArray } from 'drizzle-orm';
import { webToken } from '../utils/accesstoken.js';

describe('Member & Role Management API', () => {
  let adminToken = '';
  let memberToken = '';
  let testProjectId = null;
  let adminUser = null;
  let normalUser = null;

  beforeAll(async () => {
    await db.delete(usersTable).where(inArray(usersTable.email, ['admin_mem@test.com', 'user_mem@test.com']));

    // Create Admin
    const [admin] = await db.insert(usersTable).values({
      name: 'Admin Mem',
      email: 'admin_mem@test.com',
      password: 'password',
      role: 'admin'
    }).returning();
    adminUser = admin;
    adminToken = webToken({ id: admin.id, name: admin.name, email: admin.email });

    // Create Normal User
    const [user] = await db.insert(usersTable).values({
      name: 'User Mem',
      email: 'user_mem@test.com',
      password: 'password'
    }).returning();
    normalUser = user;
    memberToken = webToken({ id: user.id, name: user.name, email: user.email });

    // Create Project
    const [project] = await db.insert(projectsTable).values({
      name: 'Member Test Project',
      description: 'Testing members',
      createdBy: admin.id
    }).returning();
    testProjectId = project.id;

    // Admin joins project automatically
    await db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: admin.id,
      role: 'admin'
    });
  });

  afterAll(async () => {
    await db.delete(projectsTable).where(eq(projectsTable.id, testProjectId));
    await db.delete(usersTable).where(inArray(usersTable.id, [adminUser.id, normalUser.id]));
  });

  it('should add a user to the project as an admin', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${testProjectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: normalUser.email });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/successfully added/);
  });

  it('should not allow a regular member to change roles', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${testProjectId}/members/${adminUser.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: 'member' });

    // Assuming 403 Forbidden because they aren't admin
    expect(res.statusCode).toBe(403);
  });

  it('should allow an admin to change a members role', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${testProjectId}/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'project_admin' });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/Role successfully updated/);
  });

  it('should list all project members', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${testProjectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should allow admin to remove a member', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${testProjectId}/members/${normalUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/removed/);
  });
});
