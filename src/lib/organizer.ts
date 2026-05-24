import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gocheck_organizer_id';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedId: string | null = null;

export async function getOrganizerId(): Promise<string> {
  if (cachedId) return cachedId;
  const stored = await AsyncStorage.getItem(KEY);
  if (stored) {
    cachedId = stored;
    return stored;
  }
  const newId = generateId();
  await AsyncStorage.setItem(KEY, newId);
  cachedId = newId;
  return newId;
}
