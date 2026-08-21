import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const [label, ...files] = process.argv.slice(2);
for (const file of files) await access(resolve(process.cwd(), file));
console.log(`${label}: skeleton validated`);
