import "dotenv/config";
import { sendEmail } from "../services/email.js";

const info = await sendEmail({
  to: "student@example.com",
  subject: "ScholarHub test email",
  html: "<h1>Hello</h1><p>Agar ye Mailtrap me dikh raha hai to email service kaam kar rahi hai.</p>",
});

console.log("Email sent, id:", info.messageId);