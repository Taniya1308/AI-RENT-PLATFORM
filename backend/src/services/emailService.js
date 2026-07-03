const nodemailer = require('nodemailer');
const { db } = require('../models/database');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  // Support multiple email providers via environment config
  if (process.env.EMAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else if (process.env.SENDGRID_API_KEY) {
    // SendGrid via SMTP relay
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  } else {
    // Fallback: Ethereal (fake SMTP for development/testing)
    console.warn('No email config found. Using Ethereal test account for email preview.');
    transporter = null; // Will be created async in sendEmail
  }

  return transporter;
}

async function sendEmail({ to, subject, html, type, userId }) {
  // Log notification in DB regardless of send success
  const notifId = db.prepare(`
    INSERT INTO notifications (user_id, type, subject, body)
    VALUES (?, ?, ?, ?)
  `).run(userId || 0, type || 'general', subject, html).lastInsertRowid;

  let t = getTransporter();

  // Create Ethereal test account if no transporter configured
  if (!t) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      t = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      transporter = t;
    } catch (err) {
      console.error('Could not create test email account:', err.message);
      db.prepare("UPDATE notifications SET error = ? WHERE id = ?").run('Could not create email transport', notifId);
      return { success: false };
    }
  }

  try {
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || '"Rent Finder" <noreply@rentfinder.com>',
      to,
      subject,
      html
    });

    // For Ethereal: log the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 Email preview (Ethereal): ${previewUrl}`);
    }

    db.prepare("UPDATE notifications SET sent = 1 WHERE id = ?").run(notifId);
    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error('Email send failed:', err.message);
    db.prepare("UPDATE notifications SET error = ? WHERE id = ?").run(err.message, notifId);
    return { success: false, error: err.message };
  }
}

// Email: owner notified when a tenant with high score expresses interest
async function notifyOwnerHighCompatibility({ ownerEmail, ownerName, tenantName, listingTitle, score, explanation, interestId }) {
  return sendEmail({
    to: ownerEmail,
    subject: `High Match Alert: ${tenantName} is interested in "${listingTitle}" (Score: ${score}/100)`,
    type: 'high_compatibility_interest',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🏠 Rent Finder — High Compatibility Match!</h2>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>
          Great news! A tenant with a <strong style="color: #16a34a;">${score}/100 compatibility score</strong>
          has expressed interest in your listing <strong>"${listingTitle}"</strong>.
        </p>
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Tenant:</strong> ${tenantName}</p>
          <p style="margin: 4px 0 0;"><strong>Match Score:</strong> ${score}/100</p>
          <p style="margin: 4px 0 0;"><strong>Why they match:</strong> ${explanation}</p>
        </div>
        <p>Log in to <strong>Rent Finder</strong> to review their profile and accept or decline their interest request.</p>
        <p style="color: #6b7280; font-size: 12px;">You received this email because you have a listing on Rent Finder.</p>
      </div>
    `
  });
}

// Email: owner notified when any tenant expresses interest
async function notifyOwnerInterest({ ownerEmail, ownerName, tenantName, listingTitle, score }) {
  return sendEmail({
    to: ownerEmail,
    subject: `New Interest: ${tenantName} is interested in "${listingTitle}"`,
    type: 'interest_received',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🏠 Rent Finder — New Interest Request</h2>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p>
          <strong>${tenantName}</strong> has expressed interest in your listing
          <strong>"${listingTitle}"</strong>
          ${score !== null ? ` with a compatibility score of <strong>${score}/100</strong>` : ''}.
        </p>
        <p>Log in to review their profile and respond.</p>
        <p style="color: #6b7280; font-size: 12px;">You received this email because you have a listing on Rent Finder.</p>
      </div>
    `
  });
}

// Email: tenant notified when owner accepts their interest
async function notifyTenantAccepted({ tenantEmail, tenantName, ownerName, listingTitle }) {
  return sendEmail({
    to: tenantEmail,
    subject: `Your interest in "${listingTitle}" was accepted!`,
    type: 'interest_accepted',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🏠 Rent Finder — Interest Accepted!</h2>
        <p>Hi <strong>${tenantName}</strong>,</p>
        <p>
          <strong>${ownerName}</strong> has <strong style="color: #16a34a;">accepted</strong>
          your interest request for <strong>"${listingTitle}"</strong>.
        </p>
        <p>You can now chat with the owner directly in Rent Finder. Log in to start the conversation!</p>
        <p style="color: #6b7280; font-size: 12px;">You received this email because you expressed interest in a listing on Rent Finder.</p>
      </div>
    `
  });
}

// Email: tenant notified when owner declines their interest
async function notifyTenantDeclined({ tenantEmail, tenantName, ownerName, listingTitle }) {
  return sendEmail({
    to: tenantEmail,
    subject: `Update on your interest in "${listingTitle}"`,
    type: 'interest_declined',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🏠 Rent Finder — Interest Update</h2>
        <p>Hi <strong>${tenantName}</strong>,</p>
        <p>
          Unfortunately, <strong>${ownerName}</strong> has <strong style="color: #dc2626;">declined</strong>
          your interest request for <strong>"${listingTitle}"</strong>.
        </p>
        <p>Don't be discouraged — browse other listings to find your perfect match!</p>
        <p style="color: #6b7280; font-size: 12px;">You received this email because you expressed interest in a listing on Rent Finder.</p>
      </div>
    `
  });
}

module.exports = {
  sendEmail,
  notifyOwnerHighCompatibility,
  notifyOwnerInterest,
  notifyTenantAccepted,
  notifyTenantDeclined
};
