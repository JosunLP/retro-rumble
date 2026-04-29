import { formatJoinCode, isValidJoinCode } from '../types';

export function normalizeValidJoinCode(code: string): string | null {
  const normalizedCode = formatJoinCode(code);
  return isValidJoinCode(normalizedCode) ? normalizedCode : null;
}
