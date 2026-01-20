import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

const CONTACT_EMAIL = "jerome0laval@gmail.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = contactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, subject, message } = result.data;

    // Email to admin
    const adminEmailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Form Submission</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0a0a0a;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #141414; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background: linear-gradient(135deg, #c084fc 0%, #f472b6 100%);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: white;">New Contact Form Submission</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                ${subject}
              </h2>

              <div style="margin-bottom: 24px; padding: 16px; background-color: #0d0d0d; border-radius: 8px; border: 1px solid #2a2a2a;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
                  <strong style="color: #c084fc;">From:</strong>
                </p>
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #ffffff;">
                  ${name} &lt;<a href="mailto:${email}" style="color: #c084fc; text-decoration: none;">${email}</a>&gt;
                </p>

                <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
                  <strong style="color: #c084fc;">Message:</strong>
                </p>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #a0a0a0; white-space: pre-wrap;">
                  ${message}
                </p>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 14px; color: #666;">
                Reply directly to this email to respond to ${name}.
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

    const adminEmailText = `
New Contact Form Submission

Subject: ${subject}

From: ${name} <${email}>

Message:
${message}

---
Reply directly to this email to respond to ${name}.
`;

    // Send email to admin
    await sendEmail({
      to: CONTACT_EMAIL,
      subject: `[Queen Mama Contact] ${subject}`,
      html: adminEmailHtml,
      text: adminEmailText,
    });

    return NextResponse.json(
      { message: "Message sent successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}
