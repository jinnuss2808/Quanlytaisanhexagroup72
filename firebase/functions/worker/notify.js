import nodemailer from 'nodemailer';
import { db, ServerValue } from './firebase.js';

export async function notifyPeople(userIds, ticketId, title, message) {
  const updates = {};
  for (const uid of new Set(userIds.filter(Boolean))) {
    const id = db.ref(`notifications/${uid}`).push().key;
    updates[`notifications/${uid}/${id}`] = {
      ticketId, title, message, read: false, createdAt: ServerValue.TIMESTAMP,
    };
  }
  if (Object.keys(updates).length) await db.ref().update(updates);
}

export async function notifyNewTicket(ticket) {
  const snapshot = await db.ref('users').get();
  const targets = Object.entries(snapshot.val() || {})
    .filter(([, u]) => u.active === true && u.role === 'manager')
    .map(([uid]) => uid);
  await notifyPeople(targets, ticket.id, 'Yêu cầu mới · ' + ticket.code,
    `${ticket.requesterName} (${ticket.department}) gửi ${ticket.type === 'support' ? 'ticket IT' : 'phiếu thiết bị'}: ${ticket.subject}`);

  const recipients = (process.env.IT_NOTIFICATION_EMAILS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (recipients.length && process.env.SMTP_HOST && process.env.SMTP_FROM) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM, to: recipients.join(','),
      subject: `[HEXA IT] ${ticket.code} – ${ticket.subject}`,
      text: `Yêu cầu mới: ${ticket.code}\nNgười yêu cầu: ${ticket.requesterName}\nPhòng ban: ${ticket.department}\nLoại: ${ticket.type}\nNội dung: ${ticket.description}\n\nĐăng nhập hệ thống IT để xử lý.`,
    });
  }
}

// Periodic reminders are written to RTDB (realtime in-app) and optionally emailed.
export async function notifyReminder(ticket, userIds, users) {
  const intervalLabel = ticket.type === 'support' ? '30 phút' : '12 giờ';
  const subject = `Nhắc xử lý · ${ticket.code}`;
  const message = `${ticket.subject} — ${ticket.assignedTo ? 'Ticket đang chờ hoàn tất' : 'Chưa phân công nhân viên'}. Hệ thống nhắc mỗi ${intervalLabel} cho đến khi xử lý xong.`;
  const updates = {};
  for (const uid of new Set(userIds.filter(Boolean))) {
    const id = db.ref(`notifications/${uid}`).push().key;
    updates[`notifications/${uid}/${id}`] = {
      ticketId: ticket.id, title: subject, message, read: false, type: 'reminder',
      createdAt: ServerValue.TIMESTAMP,
    };
  }
  const activityId = db.ref(`activities/${ticket.id}`).push().key;
  updates[`activities/${ticket.id}/${activityId}`] = {
    action: 'reminder', actorId: null, actorName: 'Hệ thống', detail: message,
    createdAt: ServerValue.TIMESTAMP,
  };
  await db.ref().update(updates);

  // SMTP is optional. In-app notifications work without any mail credentials.
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return;
  const recipients = [...new Set(userIds.map(uid => users[uid]?.email).filter(Boolean))];
  if (!recipients.length) return;
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM, to: recipients.join(','),
      subject: `[HEXA IT] ${subject}`,
      text: `${message}\nNgười yêu cầu: ${ticket.requesterName}\nPhòng ban: ${ticket.department}\nMã phiếu: ${ticket.code}`,
    });
  } catch (err) { console.error('[reminder] SMTP:', err); }
}
