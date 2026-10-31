// Primeira utilização: cria o .env com senha e segredos aleatórios. Nunca altera um .env existente.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env');

if (existsSync(target)) {
  console.log('Configuração existente mantida (.env).');
} else {
  const random = (n) => randomBytes(n).toString('base64url');
  const password = random(15);
  const text = readFileSync(join(root, '.env.example'), 'utf8')
    .replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${password}`)
    .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${random(32)}`)
    .replace(/^BACKUP_TOKEN=.*$/m, `BACKUP_TOKEN=${random(32)}`);
  writeFileSync(target, text);
  console.log('');
  console.log(`  A SUA SENHA INICIAL DO PAINEL: ${password}`);
  console.log('  Anote-a. Pode mudá-la no painel, em "Senha". Também fica no ficheiro .env.');
  console.log('');
}
