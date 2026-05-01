import nodemailer from "nodemailer";
import getEnv from "../config/env";

export type EmailTemplate =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_expired"
  | "queue_promoted"
  | "queue_joined"
  | "queue_confirmation_expired"
  | "email_verification_otp"
  | "password_reset_otp";

interface EmailData {
  [key: string]: unknown;
}

function buildEmailContent(
  type: EmailTemplate,
  data: EmailData,
): { subject: string; html: string } {
  switch (type) {
    case "booking_confirmed":
      return {
        subject: "Booking Confirmed",
        html: `<h1>Your booking has been confirmed!</h1><p>Booking ID: ${data.bookingId}</p><p>Slot: ${data.slotTime}</p>`,
      };

    case "booking_cancelled":
      return {
        subject: "Booking Cancelled",
        html: `<h1>Your booking has been cancelled.</h1><p>Booking ID: ${data.bookingId}</p>`,
      };

    case "booking_expired":
      return {
        subject: "Booking Expired — Slot Freed",
        html: `<h1>Your booking has expired.</h1><p>Your reservation was not confirmed in time and the slot has been released.</p>`,
      };

    case "queue_promoted":
      return {
        subject: "It's Your Turn — Confirm Your Slot",
        html: `<h1>It's your turn!</h1><p>You have ${data.confirmMinutes} minutes to confirm your booking for slot ${data.slotId}.</p><p>Confirmation deadline: ${data.deadline}</p>`,
      };

    case "queue_joined":
      return {
        subject: "You've Joined the Queue",
        html: `<h1>You're in the queue!</h1><p>Your position: ${data.position}</p><p>Estimated wait: ${data.estimatedWait} minutes</p>`,
      };

    case "queue_confirmation_expired":
      return {
        subject: "Your Queue Slot Expired",
        html: `<h1>Queue slot expired</h1><p>You did not confirm your queue slot in time. Your position has been passed to the next person.</p>`,
      };

    case "email_verification_otp":
      return {
        subject: "Verify Your Email",
        html: `
          <h1>Verify your email</h1>
          <p>Your verification code is:</p>
          <h2 style="letter-spacing:8px;font-size:36px;">${data.otp}</h2>
          <p>This code expires in <strong>${data.expiresInMinutes} minutes</strong>.</p>
          <p>If you did not request this, ignore this email.</p>
        `,
      };

    case "password_reset_otp":
      return {
        subject: "Reset Your Password",
        html: `
          <h1>Reset your password</h1>
          <p>Your password reset code is:</p>
          <h2 style="letter-spacing:8px;font-size:36px;">${data.otp}</h2>
          <p>This code expires in <strong>${data.expiresInMinutes} minutes</strong>.</p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
        `,
      };

    default:
      return {
        subject: "Notification",
        html: "<p>You have a new notification.</p>",
      };
  }
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const env = getEnv();
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  async send(
    to: string,
    template: EmailTemplate,
    data: EmailData,
  ): Promise<void> {
    const env = getEnv();
    const { subject, html } = buildEmailContent(template, data);

    await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });
  }
}

export const emailService = new EmailService();
