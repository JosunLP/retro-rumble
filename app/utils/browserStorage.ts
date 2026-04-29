export function getBrowserStorage(): Storage | null {
  if (!import.meta.client) {
    return null;
  }

  try {
    return window.localStorage;
  }
  catch {
    return null;
  }
}
