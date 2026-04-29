import { formatJoinCode, isValidJoinCode, JOIN_CODE_LENGTH } from '../types';

export type JoinCodeErrorKey = 'errors.joinCodeLength' | 'errors.invalidJoinCode';

export function getNormalizedJoinCodeErrorKey(
  code: string
): JoinCodeErrorKey | null {
  if (code.length !== JOIN_CODE_LENGTH) {
    return 'errors.joinCodeLength';
  }

  return isValidJoinCode(code) ? null : 'errors.invalidJoinCode';
}

export function getJoinCodeErrorKey(code: string): JoinCodeErrorKey | null {
  const normalizedCode = formatJoinCode(code);
  return getNormalizedJoinCodeErrorKey(normalizedCode);
}

export function normalizeValidJoinCode(code: string): string | null {
  const normalizedCode = formatJoinCode(code);
  return getNormalizedJoinCodeErrorKey(normalizedCode) ? null : normalizedCode;
}
