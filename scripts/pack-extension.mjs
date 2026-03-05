import { statSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DIST_DIR = 'dist';
const OUTPUT_FILE = 'translator-render-extension.zip';

try {
  const stats = statSync(DIST_DIR);
  if (!stats.isDirectory()) {
    throw new Error('dist 디렉토리가 없습니다. 먼저 build를 실행하세요.');
  }
} catch {
  throw new Error('dist 디렉토리가 없습니다. 먼저 build를 실행하세요.');
}

execSync(`rm -f ${OUTPUT_FILE}`, { stdio: 'inherit' });
execSync(`cd ${DIST_DIR} && zip -qr ../${OUTPUT_FILE} .`, { stdio: 'inherit' });

console.log(`\n✅ 패키징 완료: ${OUTPUT_FILE}`);
