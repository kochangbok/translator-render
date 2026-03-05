export function parseJsonWithRepair<T>(raw: string): T {
  const cleaned = raw.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('JSON 파싱 실패');
    }
    const sliced = cleaned.slice(start, end + 1);
    return JSON.parse(sliced) as T;
  }
}
