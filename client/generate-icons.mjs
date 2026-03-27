import sharp from 'sharp'
import { readFileSync } from 'fs'

const icon = readFileSync('./public/icon.svg')
const maskable = readFileSync('./public/maskable-icon.svg')

await sharp(icon).resize(192).png().toFile('./public/icon-192.png')
await sharp(icon).resize(512).png().toFile('./public/icon-512.png')
await sharp(maskable).resize(512).png().toFile('./public/maskable-icon-512.png')
await sharp(icon).resize(180).png().toFile('./public/apple-touch-icon.png')

console.log('Icônes générées ✓')