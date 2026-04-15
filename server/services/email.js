const nodemailer = require('nodemailer');
const logger = require('../logger');

// Configuration SMTP via variables d'environnement
// Si non configuré, les emails ne sont pas envoyés (dégradation gracieuse)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'Score26 <noreply@score26.app>';

const isConfigured = SMTP_HOST && SMTP_USER && SMTP_PASS;

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  logger.info({ host: SMTP_HOST }, '[email] Service email configuré');
} else {
  logger.warn('[email] SMTP non configuré — les emails de vérification ne seront pas envoyés');
}

// Envoie un email de vérification
// Retourne true si envoyé, false si SMTP non configuré ou erreur
async function sendVerificationEmail({ to, pseudo, token, lang = 'fr' }) {
  if (!transporter) {
    logger.warn({ to }, '[email] Email non envoyé (SMTP non configuré)');
    return false;
  }

  const baseUrl = process.env.APP_URL || 'https://score26.app';
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const subject = lang === 'fr'
    ? 'Score26 — Confirme ton adresse email'
    : 'Score26 — Confirm your email address';

  const html = lang === 'fr'
    ? `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a1a2e">Salut ${pseudo} !</h2>
        <p>Clique sur le bouton ci-dessous pour confirmer ton adresse email sur Score26.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#4cc9f0;color:#1a1a2e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Confirmer mon email</a>
        <p style="color:#888;font-size:13px">Ce lien expire dans 24 heures. Si tu n'as pas fait cette demande, ignore cet email.</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a1a2e">Hey ${pseudo}!</h2>
        <p>Click the button below to confirm your email address on Score26.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#4cc9f0;color:#1a1a2e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Confirm my email</a>
        <p style="color:#888;font-size:13px">This link expires in 24 hours. If you didn't request this, just ignore this email.</p>
      </div>`;

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    logger.info({ to }, '[email] Email de vérification envoyé');
    return true;
  } catch (err) {
    logger.error({ err, to }, '[email] Erreur envoi email de vérification');
    return false;
  }
}

module.exports = { sendVerificationEmail, isConfigured };
