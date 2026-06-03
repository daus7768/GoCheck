// `process.env.EXPO_PUBLIC_*` is inlined by babel-preset-expo at transform
// time, so mutating it from a test has no effect on the code under test.
// Mock `expo-constants` instead — that's the runtime priority the function
// actually consults after the inlined env reference.
describe('participantUrl', () => {
  afterEach(() => {
    jest.resetModules();
    jest.unmock('expo-constants');
  });

  it('uses Constants.expoConfig.extra.shareBaseUrl when set', () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: { shareBaseUrl: 'https://my-project.vercel.app' } } },
    }));
    const { participantUrl } = require('./urls');
    expect(participantUrl('xyz-789')).toBe('https://my-project.vercel.app/p/xyz-789');
  });

  it('strips trailing slash from the configured base URL', () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: { shareBaseUrl: 'https://gocheck.app/' } } },
    }));
    const { participantUrl } = require('./urls');
    expect(participantUrl('token-1')).toBe('https://gocheck.app/p/token-1');
  });

  it('falls through to the hardcoded production default when nothing is configured', () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } },
    }));
    const { participantUrl } = require('./urls');
    expect(participantUrl('abc-123')).toBe('https://go-check.vercel.app/p/abc-123');
  });
});
