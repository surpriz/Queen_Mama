import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Initialize SES client
const ses = new SESClient({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const FROM_EMAIL = process.env.EMAIL_FROM || "Queen Mama <noreply@queenmama.co>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://queenmama.app";
const APP_NAME = "Queen Mama";

// ===========================================
// EMAIL SENDING
// ===========================================

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        ...(text && { Text: { Data: text, Charset: "UTF-8" } }),
      },
    },
  });

  await ses.send(command);
}

// ===========================================
// EMAIL TEMPLATES
// ===========================================

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0a0a0a;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #141414; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background: linear-gradient(135deg, #c084fc 0%, #f472b6 100%);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: white;">${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0d0d0d; text-align: center; border-top: 1px solid #2a2a2a;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
                <a href="${APP_URL}/privacy" style="color: #c084fc; text-decoration: none;">Privacy Policy</a>
                &nbsp;|&nbsp;
                <a href="${APP_URL}/terms" style="color: #c084fc; text-decoration: none;">Terms of Service</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function buttonTemplate(href: string, text: string): string {
  return `
<table role="presentation" style="margin: 24px 0; width: 100%;">
  <tr>
    <td style="text-align: center;">
      <a href="${href}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #c084fc 0%, #f472b6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        ${text}
      </a>
    </td>
  </tr>
</table>
`;
}

// ===========================================
// EMAIL TEMPLATES - SPECIFIC EMAILS
// ===========================================

export function welcomeEmailTemplate(name: string): { subject: string; html: string; text: string } {
  const subject = `Welcome to ${APP_NAME}!`;

  const html = baseTemplate(`
    <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #ffffff;">
      Welcome aboard, ${name}!
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
      We're thrilled to have you join ${APP_NAME}. Your AI-powered meeting assistant is ready to help you nail every conversation.
    </p>
    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
      Here's what you can do next:
    </p>
    <ul style="margin: 0 0 24px 0; padding-left: 24px; font-size: 16px; line-height: 1.8; color: #a0a0a0;">
      <li>Download the macOS app from your dashboard</li>
      <li>Set up your first meeting session</li>
      <li>Explore the different AI assist modes</li>
    </ul>
    ${buttonTemplate(`${APP_URL}/dashboard`, "Go to Dashboard")}
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #666;">
      Questions? Reply to this email or check our <a href="${APP_URL}/changelog" style="color: #c084fc; text-decoration: none;">changelog</a>.
    </p>
  `);

  const text = `
Welcome aboard, ${name}!

We're thrilled to have you join ${APP_NAME}. Your AI-powered meeting assistant is ready to help you nail every conversation.

Here's what you can do next:
- Download the macOS app from your dashboard
- Set up your first meeting session
- Explore the different AI assist modes

Go to Dashboard: ${APP_URL}/dashboard

Questions? Reply to this email or check our changelog at ${APP_URL}/changelog.
`;

  return { subject, html, text };
}

export function verificationEmailTemplate(name: string, verificationUrl: string): { subject: string; html: string; text: string } {
  const subject = `Verify your email for ${APP_NAME}`;

  const html = baseTemplate(`
    <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #ffffff;">
      Verify your email address
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
      Hi ${name}, thanks for signing up for ${APP_NAME}! Please verify your email address to complete your registration.
    </p>
    ${buttonTemplate(verificationUrl, "Verify Email")}
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #666;">
      This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
    </p>
    <p style="margin: 16px 0 0 0; font-size: 12px; color: #555;">
      Can't click the button? Copy and paste this link into your browser:<br>
      <a href="${verificationUrl}" style="color: #c084fc; word-break: break-all;">${verificationUrl}</a>
    </p>
  `);

  const text = `
Verify your email address

Hi ${name}, thanks for signing up for ${APP_NAME}! Please verify your email address to complete your registration.

Click here to verify: ${verificationUrl}

This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
`;

  return { subject, html, text };
}

export function passwordResetEmailTemplate(name: string, resetUrl: string): { subject: string; html: string; text: string } {
  const subject = `Reset your ${APP_NAME} password`;

  const html = baseTemplate(`
    <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #ffffff;">
      Reset your password
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
      Hi ${name}, we received a request to reset your password. Click the button below to choose a new password.
    </p>
    ${buttonTemplate(resetUrl, "Reset Password")}
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #666;">
      This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
    <p style="margin: 16px 0 0 0; font-size: 12px; color: #555;">
      Can't click the button? Copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #c084fc; word-break: break-all;">${resetUrl}</a>
    </p>
  `);

  const text = `
Reset your password

Hi ${name}, we received a request to reset your password. Click the link below to choose a new password.

Reset Password: ${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
`;

  return { subject, html, text };
}

export function passwordChangedEmailTemplate(name: string): { subject: string; html: string; text: string } {
  const subject = `Your ${APP_NAME} password was changed`;

  const html = baseTemplate(`
    <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #ffffff;">
      Password changed successfully
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
      Hi ${name}, your ${APP_NAME} password was just changed. If you made this change, you can ignore this email.
    </p>
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
      If you didn't change your password, please <a href="${APP_URL}/reset-password" style="color: #c084fc; text-decoration: none;">reset your password immediately</a> and contact our support team.
    </p>
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #666;">
      For your security, we recommend using a strong, unique password that you don't use on other sites.
    </p>
  `);

  const text = `
Password changed successfully

Hi ${name}, your ${APP_NAME} password was just changed. If you made this change, you can ignore this email.

If you didn't change your password, please reset your password immediately at ${APP_URL}/reset-password and contact our support team.

For your security, we recommend using a strong, unique password that you don't use on other sites.
`;

  return { subject, html, text };
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const { subject, html, text } = welcomeEmailTemplate(name);
  await sendEmail({ to, subject, html, text });
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
  const { subject, html, text } = verificationEmailTemplate(name, verificationUrl);
  await sendEmail({ to, subject, html, text });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const { subject, html, text } = passwordResetEmailTemplate(name, resetUrl);
  await sendEmail({ to, subject, html, text });
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  const { subject, html, text } = passwordChangedEmailTemplate(name);
  await sendEmail({ to, subject, html, text });
}
