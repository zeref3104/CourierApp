const crypto = require('crypto');
const emailService = require('./notifications/email.service');
const TooManyRequestsException = require('../exceptions/TooManyRequestsException');
const UnprocessableEntityException = require('../exceptions/UnprocessableEntityException');

// Deployment default language when the client does not request one. Set
// DEFAULT_LANGUAGE=fr in the API env for French-first tenants.
const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || 'es';

/**
 * Registration OTP service (client-registration spec + auth-specs delta §2.2,
 * design D5). Codes live on the MASTER DB keyed `${email}:${purpose}`; only the
 * sha256 hash is stored. Contract:
 *   - 6-digit code, 10-minute expiry, 5 failed-verify attempts max
 *   - 60s resend cooldown -> TooManyRequestsException (429)
 *   - single-use: successful verify sets verifiedAt
 *   - verify failures -> UnprocessableEntityException (422)
 */

const OTP_PURPOSE_REGISTER = 'register';
const OTP_PURPOSE_PASSWORD_RESET = 'password_reset';
const OTP_CODE_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_MS = 60 * 1000;

/**
 * Keys are scoped per purpose (design D5) so a `register` code and a
 * `password_reset` code for the same email never collide or share cooldowns.
 */
function buildKey(email, purpose = OTP_PURPOSE_REGISTER) {
  return `${email.trim().toLowerCase()}:${purpose}`;
}

function generateCode() {
  // crypto.randomInt avoids the bias/predictability of Math.random
  return String(crypto.randomInt(0, 10 ** OTP_CODE_LENGTH)).padStart(OTP_CODE_LENGTH, '0');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

class OtpService {
  /**
   * Generate, store and email a fresh OTP for `${email}:${purpose}`.
   * A resend within the 60s cooldown window is rejected with 429.
   *
   * @param {string} [purpose='register'] - scopes the storage key AND the
   *   email template (register -> sendOtpCode, password_reset -> the dedicated
   *   reset template), so the two flows never share a code or a cooldown.
   * @param {boolean} [dispatch=true] - when false the code is staged (TTL'd,
   *   cooldown-enforced) but NO email is sent: the anti-enumeration path for
   *   emails that match no account still returns the identical generic body
   *   and identical cooldown behavior (design D3).
   */
  async sendOtp({ email, lang, masterConnection, purpose = OTP_PURPOSE_REGISTER, dispatch = true }) {
    const OtpCode = masterConnection.model('OtpCode');
    const key = buildKey(email, purpose);
    const now = Date.now();

    const existing = await OtpCode.findOne({ key });
    if (existing && existing.cooldownUntil && existing.cooldownUntil.getTime() > now) {
      const resendAfter = Math.ceil((existing.cooldownUntil.getTime() - now) / 1000);
      throw new TooManyRequestsException('OTP resend blocked by cooldown', { resendAfter });
    }

    const code = generateCode();
    const codeHash = sha256(code);
    const expiresAt = new Date(now + OTP_TTL_MS);
    const cooldownUntil = new Date(now + OTP_COOLDOWN_MS);

    // Upsert resets the code and its attempt counter; a re-sent code starts
    // fresh (spec: "resend MUST be blocked by a 60-second cooldown" only).
    await OtpCode.findOneAndUpdate(
      { key },
      {
        $set: {
          codeHash,
          expiresAt,
          attempts: 0,
          cooldownUntil,
          verifiedAt: null,
          consumedAt: null,
        },
      },
      { upsert: true, new: true }
    );

    // Email is best-effort (sendNotification never throws); the stored code
    // remains valid and the 60s cooldown still applies on failure. dispatch:false
    // skips this step entirely (staged-only record, design D3).
    if (dispatch) {
      const sender = purpose === OTP_PURPOSE_PASSWORD_RESET ? 'sendPasswordResetOtp' : 'sendOtpCode';
      await emailService[sender].call(emailService, email, code, lang || DEFAULT_LANGUAGE);
    }

    return { sent: true, resendAfter: OTP_COOLDOWN_MS / 1000 };
  }

  /**
   * Verify a submitted 6-digit code against `${email}:${purpose}`. Enforces
   * expiry, the 5-attempt lockout, and single-use. On success the code is
   * marked verified (verifiedAt) and cannot be used again.
   */
  async verifyOtp({ email, code, masterConnection, purpose = OTP_PURPOSE_REGISTER }) {
    const OtpCode = masterConnection.model('OtpCode');
    const key = buildKey(email, purpose);

    const doc = await OtpCode.findOne({ key });
    if (!doc) {
      throw new UnprocessableEntityException('OTP not found or expired');
    }
    if (doc.expiresAt.getTime() < Date.now()) {
      throw new UnprocessableEntityException('OTP expired');
    }
    if (doc.verifiedAt) {
      throw new UnprocessableEntityException('OTP already used');
    }
    if (doc.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnprocessableEntityException('OTP invalidated after too many attempts');
    }

    const isMatch = sha256(code) === doc.codeHash;
    if (!isMatch) {
      doc.attempts += 1;
      await doc.save();
      throw new UnprocessableEntityException('Invalid OTP code');
    }

    doc.verifiedAt = new Date();
    await doc.save();
    return { verified: true };
  }
}

const otpService = new OtpService();

// Share the code-identity primitives so auth.service.registerClient validates a
// registration code with identical semantics (key format, hash, attempt limit)
// without duplicating the constants (client-registration spec, design D5).
otpService.buildKey = buildKey;
otpService.sha256 = sha256;
otpService.OTP_MAX_ATTEMPTS = OTP_MAX_ATTEMPTS;
otpService.OTP_PURPOSE_REGISTER = OTP_PURPOSE_REGISTER;
otpService.OTP_PURPOSE_PASSWORD_RESET = OTP_PURPOSE_PASSWORD_RESET;

module.exports = otpService;
