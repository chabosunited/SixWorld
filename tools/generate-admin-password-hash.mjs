import { createHash } from 'node:crypto';
const password = process.argv[2];
if(!password){
  console.log('Usage: node tools/generate-admin-password-hash.mjs "your-password"');
  process.exit(1);
}
console.log(createHash('sha256').update(password).digest('hex'));
