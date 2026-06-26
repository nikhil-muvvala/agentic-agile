import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { db } from '../db/index.js';
import { usersTable, notificationsTable } from '../models/index.js';
import { eq } from 'drizzle-orm';
import { webToken } from '../utils/accesstoken.js';

describe('Notifications API', () => {
  let adminToken = '';
  let adminUser = null;
  let testNotificationId = null;

  beforeAll(async () => {
    await db.delete(usersTable).where(eq(usersTable.email, 'notify_admin@test.com'));

    // Create Admin
    const [admin] = await db.insert(usersTable).values({
      name: 'Notify Admin',
      email: 'notify_admin@test.com',
      password: 'password'
    }).returning();
    adminUser = admin;
    adminToken = webToken({ id: admin.id, name: admin.name, email: admin.email });

    // Manually insert a notification
    const [notif] = await db.insert(notificationsTable).values({
      userId: admin.id,
      senderId: admin.id,
      message: 'You have a new test!',
      isRead: false
    }).returning();
    testNotificationId = notif.id;
  });

  afterAll(async () => {
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, adminUser.id));
    await db.delete(usersTable).where(eq(usersTable.id, adminUser.id));
  });

  it('should list all notifications for the user', async () => {
    const res = await request(app)
      .get(`/api/v1/notifications`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(res.body.notifications.length).toBeGreaterThan(0);
    expect(res.body.notifications[0].message).toBe('You have a new test!');
  });

  it('should mark a specific notification as read', async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${testNotificationId}/read`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(res.body.notification.isRead).toBe(true);
  });

  it('should mark all notifications as read', async () => {
    // Insert another unread
    await db.insert(notificationsTable).values({
      userId: adminUser.id,
      senderId: adminUser.id,
      message: 'unread',
      isRead: false
    });

    const res = await request(app)
      .patch(`/api/v1/notifications/read-all`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/All notifications marked as read/);
  });
});
