import { Request, Response } from 'express';
import { prisma } from '../db/client.js';
import nodemailer from 'nodemailer';

export async function getSendersHandler(req: Request, res: Response) {
  try {
    const senders = await prisma.sender.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        host: true,
        port: true,
        createdAt: true,
      },
    });

    return res.json({ senders });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function createEtherealSenderHandler(req: Request, res: Response) {
  try {
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

    return res.status(201).json({
      success: true,
      sender: {
        id: sender.id,
        email: sender.email,
        host: sender.host,
        port: sender.port,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
