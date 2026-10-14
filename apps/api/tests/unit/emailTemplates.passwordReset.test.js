/**
 * Unit tests for the password-reset OTP email (forgot-password spec, task 1.2):
 * - otpPasswordReset template exists in es/en/fr with the {{code}} placeholder
 * - its subject is DISTINCT from the registration OTP subject (same {{code}})
 * - emailService.sendPasswordResetOtp renders that template and sends to the
 *   requested recipient/language without touching the registration template
 */
const { emailTemplates, interpolate } = require('../../src/services/notifications/emailTemplates');
const emailService = require('../../src/services/notifications/email.service');

describe('emailTemplates.otpPasswordReset', () => {
  test('exists in all three locales with the {{code}} placeholder', () => {
    for (const lang of ['es', 'en', 'fr']) {
      const template = emailTemplates[lang].otpPasswordReset;
      expect(template).toBeDefined();
      expect(template.subject).toBeTruthy();
      expect(template.body).toContain('{{code}}');
    }
  });

  test('subject differs from the registration OTP subject in every locale', () => {
    for (const lang of ['es', 'en', 'fr']) {
      const reset = emailTemplates[lang].otpPasswordReset;
      const register = emailTemplates[lang].otp;
      expect(reset.subject).not.toBe(register.subject);
      expect(reset.body).not.toBe(register.body);
    }
  });

  test('renders the real code into the body', () => {
    for (const lang of ['es', 'en', 'fr']) {
      const rendered = interpolate(emailTemplates[lang].otpPasswordReset.body, { code: '654321' });
      expect(rendered).toContain('654321');
      expect(rendered).not.toContain('{{code}}');
    }
  });
});

describe('emailService.sendPasswordResetOtp', () => {
  let sendNotification;

  beforeEach(() => {
    sendNotification = jest.spyOn(emailService, 'sendNotification').mockResolvedValue({ messageId: 'test-1' });
  });

  afterEach(() => {
    sendNotification.mockRestore();
  });

  test('sends the reset template subject/body to the recipient (en)', async () => {
    await emailService.sendPasswordResetOtp('cliente@correo.com', '123456', 'en');

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const payload = sendNotification.mock.calls[0][0];
    expect(payload.to).toBe('cliente@correo.com');
    expect(payload.subject).toBe(emailTemplates.en.otpPasswordReset.subject);
    expect(payload.subject).not.toBe(emailTemplates.en.otp.subject);
    expect(payload.text).toContain('123456');
    expect(payload.text).not.toContain('{{code}}');
  });

  test('falls back to es when no language is given and keeps the reset subject', async () => {
    await emailService.sendPasswordResetOtp('cliente@correo.com', '123456');

    const payload = sendNotification.mock.calls[0][0];
    expect(payload.subject).toBe(emailTemplates.es.otpPasswordReset.subject);
    expect(payload.text).toContain('123456');
  });
});
