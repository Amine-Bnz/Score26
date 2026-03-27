import sharp from 'sharp'
import { readFileSync } from 'fs'

const icon = readFileSync('./client/public/icon.svg')
const maskable = readFileSync('./client/public/maskable-icon.svg')

await sharp(icon).resize(192).png().toFile('./client/public/icon-192.png')
await sharp(icon).resize(512).png().toFile('./client/public/icon-512.png')
await sharp(maskable).resize(512).png().toFile('./client/public/maskable-icon-512.png')
await sharp(icon).resize(180).png().toFile('./client/public/apple-touch-icon.png')

console.log('Icônes générées ✓')