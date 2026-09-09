import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { host, port, secure, user, pass, from, to, subject, html, text } = body;

    if (!user || !pass || !to || !subject) {
      return NextResponse.json(
        { error: 'Missing required mail relay parameters' },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: host || 'smtp.ethereal.email',
      port: port || 587,
      secure: secure || false,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: from || `"ReachInbox Outreach" <${user}>`,
      to,
      subject,
      text: text || '',
      html: html || '',
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || false,
    });
  } catch (error: any) {
    console.error('[Relay Mail Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to dispatch email via relay' },
      { status: 500 }
    );
  }
}
