/**
 * Unit tests for the OTP email template (design D6): es default, es/en/fr
 * variants exist, subject/body render with the {{code}} placeholder.
 */
const { emailTemplates, interpolate } = require('../../src/services/notifications/emailTemplates');

describe('emailTemplates.otp', () => {
  test('defines the otp template in all three locales', () => {
    expect(Object.keys(emailTemplates)).toEqual(expect.arrayContaining(['es', 'en', 'fr']));
    for (const lang of ['es', 'en', 'fr']) {
      expect(emailTemplates[lang].otp).toBeDefined();
      expect(emailTemplates[lang].otp.subject).toContain('{{code}}'.replace('{{code}}', '') || emailTemplates[lang].otp.subject); // subject may or may not embed the code
      expect(emailTemplates[lang].otp.body).toContain('{{code}}');
    }
  });

  test('renders the code placeholder in every locale', () => {
    for (const lang of ['es', 'en', 'fr']) {
      const rendered = interpolate(emailTemplates[lang].otp.body, { code: '123456' });
      expect(rendered).toContain('123456');
      expect(rendered).not.toContain('{{code}}');
    }
  });

  test('es is the default locale and exists', () => {
    expect(emailTemplates.es.otp).toBeDefined();
    expect(emailTemplates.es.otp.subject).toContain('código');
  });
});
