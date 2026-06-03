describe('participantUrl', () => {
  const ORIGINAL_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL;

  afterEach(() => {
    if (ORIGINAL_BASE !== undefined) {
      process.env.EXPO_PUBLIC_WEB_BASE_URL = ORIGINAL_BASE;
    } else {
      delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
    }
    jest.resetModules();
  });

  it('falls through to the hardcoded production default when no env var and no expoConfig', () => {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
    const { participantUrl } = require('./urls');
    expect(participantUrl('abc-123')).toBe('https://go-check.vercel.app/p/abc-123');
  });

  it('uses configured base URL when env var is set', () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://my-project.vercel.app';
    const { participantUrl } = require('./urls');
    expect(participantUrl('xyz-789')).toBe('https://my-project.vercel.app/p/xyz-789');
  });

  it('handles trailing slash in base URL', () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://gocheck.app/';
    const { participantUrl } = require('./urls');
    expect(participantUrl('token-1')).toBe('https://gocheck.app/p/token-1');
  });
});
