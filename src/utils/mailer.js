import nodemailer from "nodemailer";

export const sendMail = async (to, subject, html, attachments = []) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"Inventory System" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
    attachments
  });
};
