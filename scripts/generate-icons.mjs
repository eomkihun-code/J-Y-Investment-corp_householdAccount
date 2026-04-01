// Run: node scripts/generate-icons.mjs
// Requires: npm install sharp -D

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public/icons');

const svg192 = readFileSync(resolve(publicDir, 'icon-192x192.svg'));
const svg512 = readFileSync(resolve(publicDir, 'icon-512x512.svg'));

await sharp(svg192).resize(192, 192).png().toFile(resolve(publicDir, 'icon-192x192.png'));
console.log('icon-192x192.png generated');

await sharp(svg512).resize(512, 512).png().toFile(resolve(publicDir, 'icon-512x512.png'));
console.log('icon-512x512.png generated');
