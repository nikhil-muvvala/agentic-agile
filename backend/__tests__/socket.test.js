import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, server } from '../server.js';
import { db } from '../db/index.js';
import { usersTable, projectsTable, projectMembers } from '../models/index.js';
import { eq } from 'drizzle-orm';
import { webToken } from '../utils/accesstoken.js';
import { io as Client } from 'socket.io-client';

describe('WebSockets / Real-time Events', () => {
  let adminToken = '';
  let testProjectId = null;
  let adminUser = null;
  let clientSocket;
  let port;

  beforeAll(async () => {
    // Clean up
    await db.delete(usersTable).where(eq(usersTable.email, 'socketadmin@agenticagile.com'));

    // Create Admin
    const [admin] = await db.insert(usersTable).values({
      name: 'Socket Admin',
      email: 'socketadmin@agenticagile.com',
      password: 'testpassword'
    }).returning();
    adminUser = admin;
    adminToken = webToken({ id: admin.id, name: admin.name, email: admin.email });

    // Create Project
    const [project] = await db.insert(projectsTable).values({
      name: 'Socket Test Project',
      description: 'Testing real-time events',
      createdBy: admin.id
    }).returning();
    testProjectId = project.id;

    await db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: admin.id,
      role: 'project_admin'
    });

    // Start server on an ephemeral port
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    await new Promise((resolve) => server.close(resolve));
    
    // DB Teardown
    await db.delete(projectsTable).where(eq(projectsTable.id, testProjectId));
    await db.delete(usersTable).where(eq(usersTable.id, adminUser.id));
  });

  it('should reject socket connection without a valid token', () => {
    return new Promise((resolve) => {
      const badSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket']
      });
      
      badSocket.on('connect_error', (err) => {
        expect(err).toBeDefined();
        badSocket.disconnect();
        resolve();
      });
    });
  });

  it('should successfully connect with a valid token and join a project room', () => {
    return new Promise((resolve) => {
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: adminToken },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        // Emit join room with acknowledgement callback
        clientSocket.emit('join_project_room', testProjectId, (response) => {
          expect(response.success).toBe(true);
          resolve();
        });
      });
    });
  });

  it('should receive real-time events when an HTTP action triggers them', () => {
    return new Promise((resolve, reject) => {
      // We expect the 'task_created' event to be fired!
      clientSocket.on('task_created', (data) => {
        expect(data).toHaveProperty('task');
        expect(data.task).toHaveProperty('title', 'Real-time Socket Task');
        expect(data.task).toHaveProperty('projectId', testProjectId);
        resolve(); // Test passes when event is received!
      });

      // Trigger the HTTP endpoint
      request(app)
        .post(`/api/v1/tasks/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Real-time Socket Task',
          description: 'Verifying socket broadcast',
          priority: 'high'
        })
        .end((err) => {
          if (err) return reject(err);
        });
    });
  });

  it('checking when we logout', () => {
    return new Promise((resolve) => {
      clientSocket.emit("leave_project_room", testProjectId, (response) => {
        expect(response.success).toBe(true);
        resolve();
      });
    });
  });

});
