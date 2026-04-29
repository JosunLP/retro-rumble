import { formatJoinCode, isValidJoinCode, JOIN_CODE_LENGTH } from '../types';

export type JoinCodeErrorKey = 'errors.joinCodeLength' | 'errors.invalidJoinCode';

export function getJoinCodeErrorKey(code: string): JoinCodeErrorKey | null {
  const normalizedCode = formatJoinCode(code);

  if (normalizedCode.length !== JOIN_CODE_LENGTH) {
    return 'errors.joinCodeLength';
  }

  return isValidJoinCode(normalizedCode) ? null : 'errors.invalidJoinCode';
}

export function normalizeValidJoinCode(code: string): string | null {
  const normalizedCode = formatJoinCode(code);
  return getJoinCodeErrorKey(normalizedCode) ? null : normalizedCode;
}
