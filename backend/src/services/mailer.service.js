const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

const isMailConfigured = () => Boolean(env.smtp.host && env.smtp.from);

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
      tls: { rejectUnauthorized: env.smtp.rejectUnauthorized },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
  }
  return transporter;
};

/** Estado público del correo: nunca expone credenciales. */
const mailStatus = () => ({
  configurado: isMailConfigured(),
  servidor: env.smtp.host ? `${env.smtp.host}:${env.smtp.port}` : null,
  remitente: env.smtp.from || null,
});

const sendMail = async ({ to, subject, html, text }) => {
  if (!isMailConfigured()) {
    const error = new Error('El correo no está configurado en el servidor. Define SMTP_HOST y SMTP_FROM en backend/.env.');
    error.statusCode = 503;
    throw error;
  }
  return getTransporter().sendMail({ from: env.smtp.from, to, subject, html, text });
};

module.exports = { isMailConfigured, mailStatus, sendMail };
