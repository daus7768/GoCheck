function getBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'http://localhost:8081';
  return raw.replace(/\/+$/, '');
}

export function participantUrl(token: string): string {
  return `${getBaseUrl()}/p/${token}`;
}
