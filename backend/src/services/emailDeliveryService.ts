import nodemailer, { type Transporter } from 'nodemailer';
import { environmentConfiguration } from '../configuration/environmentConfiguration';

export interface OutgoingEmail {
  recipientEmailAddress: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string;
}

let cachedSmtpTransporter: Transporter | null = null;

function getSmtpTransporter(): Transporter | null {
  const { smtpHostName, smtpPortNumber, isSmtpConnectionSecure, smtpUsername, smtpPassword } = environmentConfiguration.emailDelivery;

  // No SMTP_HOST means e-mail is switched off (handy for local testing): nothing is sent and nothing breaks.
  if (!smtpHostName) return null;

  if (!cachedSmtpTransporter) {
    cachedSmtpTransporter = nodemailer.createTransport({
      host: smtpHostName,
      port: smtpPortNumber,
      secure: isSmtpConnectionSecure, // true for port 465, false for 587 (STARTTLS)
      auth: smtpUsername && smtpPassword ? { user: smtpUsername, pass: smtpPassword } : undefined,
    });
  }
  return cachedSmtpTransporter;
}

/**
 * Sends one e-mail. It NEVER throws: a mail-server problem must not make a registration or a payment fail.
 * Returns true only when the SMTP server accepted the message.
 */
export async function sendEmail(outgoingEmail: OutgoingEmail): Promise<boolean> {
  const smtpTransporter = getSmtpTransporter();

  if (!smtpTransporter) {
    console.info(`[email skipped - SMTP_HOST is not set] "${outgoingEmail.subject}" -> ${outgoingEmail.recipientEmailAddress}`);
    return false;
  }

  try {
    const { senderName, senderEmailAddress } = environmentConfiguration.emailDelivery;
    await smtpTransporter.sendMail({
      from: `"${senderName}" <${senderEmailAddress}>`,
      to: outgoingEmail.recipientEmailAddress,
      subject: outgoingEmail.subject,
      text: outgoingEmail.plainTextBody,
      html: outgoingEmail.htmlBody,
    });
    return true;
  } catch (emailSendingError) {
    console.error(`[email failed] "${outgoingEmail.subject}" -> ${outgoingEmail.recipientEmailAddress}:`, emailSendingError);
    return false;
  }
}
