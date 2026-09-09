import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../db/client.js';

const transporterCache = new Map<string, Transporter>();

export interface SendMailOptions {
  senderId: string;
  to: string;
  subject: string;
  body: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
}

/**
 * Get or create a Nodemailer transporter for a given Sender record
 */
export async function getTransporterForSender(senderId: string): Promise<Transporter> {
  if (transporterCache.has(senderId)) {
    return transporterCache.get(senderId)!;
  }

  const sender = await prisma.sender.findUnique({
    where: { id: senderId },
  });

  if (!sender) {
    throw new Error(`Sender not found with ID: ${senderId}`);
  }

  const transporter = nodemailer.createTransport({
    host: sender.host,
    port: sender.port,
    secure: sender.port === 465,
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 25000,
    dnsTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  transporterCache.set(senderId, transporter);
  return transporter;
}

/**
 * Sends an email and logs the preview URL
 */
export async function sendEmail({
  senderId,
  to,
  subject,
  body,
}: SendMailOptions): Promise<SendMailResult> {
  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new Error(`Sender with ID ${senderId} does not exist`);
  }

  let transporter = await getTransporterForSender(senderId);

  const mailOptions = {
    from: `"ReachInbox Outreach" <${sender.email}>`,
    to,
    subject,
    text: body.replace(/<[^>]+>/g, ''),
    html: body.includes('<')
      ? `<div style="font-family: sans-serif; line-height: 1.6;">${body}</div>`
      : `<div style="font-family: sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`,
  };

  let info;
  try {
    info = await transporter.sendMail(mailOptions);
  } catch (err: any) {
    console.warn(`[Mailer] Initial sendMail failed (${err.message}), clearing cache & retrying...`);
    transporterCache.delete(senderId);
    transporter = await getTransporterForSender(senderId);
    info = await transporter.sendMail(mailOptions);
  }

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[Mailer] Sent email to ${to} (MessageID: ${info.messageId})`);
  if (previewUrl) {
    console.log(`[Mailer] Ethereal Preview URL: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
}

export async function sendEmailViaNodemailer(
  senderId: string,
  to: string,
  subject: string,
  body: string
): Promise<SendMailResult> {
  return sendEmail({ senderId, to, subject, body });
}

/**
 * Auto-seeds Ethereal senders on startup if none exist in the database
 */
export async function ensureDefaultSenders(): Promise<string> {
  const count = await prisma.sender.count();
  if (count > 0) {
    const existing = await prisma.sender.findFirst();
    return existing!.id;
  }

  console.log('[Mailer] No senders found in DB. Creating Ethereal test account...');
  const testAccount = await nodemailer.createTestAccount();

  const sender = await prisma.sender.create({
    data: {
      email: testAccount.user,
      smtpUser: testAccount.user,
      smtpPass: testAccount.pass,
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
    },
  });

  console.log(`[Mailer] Created Ethereal Sender: ${sender.email} (${sender.id})`);
  return sender.id;
}
