import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { OtpPurpose } from '../common/enums';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    // If SMTP credentials are provided, initialize Nodemailer transporter
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for port 465, false for other ports
        auth: { user, pass },
      });
      this.logger.log(`Nodemailer connected to SMTP host: ${host}`);
    } else {
      this.logger.warn(
        'SMTP credentials not set in .env. Emails will be logged to the console for development.',
      );
    }
  }

  /**
   * Send a 6-digit OTP email for registration verification or password reset.
   */
  async sendOtpEmail(
    email: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const isRegistration = purpose === OtpPurpose.REGISTRATION;
    const subject = isRegistration
      ? 'DevFlow - Verify Your Email Address'
      : 'DevFlow - Password Reset Code';

    const title = isRegistration
      ? 'Welcome to DevFlow!'
      : 'Password Reset Request';

    const message = isRegistration
      ? 'Thank you for registering. Use the verification code below to activate your account:'
      : 'You requested to reset your password. Use the verification code below to set a new password:';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">${title}</h2>
        <p style="color: #475569; font-size: 15px;">${message}</p>
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">DevFlow Project Management</p>
      </div>
    `;

    // In local development or if SMTP is not configured, log to console
    this.logger.log(`📧 [Nodemailer] OTP for ${email} (${purpose}): ${otp}`);

    if (this.transporter) {
      try {
        const from =
          this.configService.get<string>('SMTP_FROM') ||
          '"DevFlow" <no-reply@devflow.com>';

        await this.transporter.sendMail({
          from,
          to: email,
          subject,
          html,
          text: `${message}\n\nYour code: ${otp}\n\nValid for 10 minutes.`,
        });
        this.logger.log(`Email successfully sent to ${email}`);
      } catch (error) {
        this.logger.error(
          `Failed to send email to ${email}: ${(error as Error).message}`,
        );
      }
    }
  }
}
