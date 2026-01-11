const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PRIMARY_COLOR = '#6366f1';
const PRIMARY_DARK = '#4f46e5';
const BG_LIGHT = '#ffffff';
const BG_DARK = '#0a0a0f';

async function generateIcon(size, outputPath, isAdaptive = false) {
  const padding = Math.round(size * 0.15);
  const iconSize = size - padding * 2;
  const cornerRadius = Math.round(size * 0.22);
  const pinSize = Math.round(iconSize * 0.5);
  const pinX = Math.round((size - pinSize) / 2);
  const pinY = Math.round((size - pinSize) / 2) - Math.round(size * 0.05);

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${PRIMARY_DARK};stop-opacity:1" />
        </linearGradient>
        <linearGradient id="pinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="${Math.round(size * 0.02)}" stdDeviation="${Math.round(size * 0.03)}" flood-color="#000" flood-opacity="0.25"/>
        </filter>
      </defs>
      ${isAdaptive ? '' : `<rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bgGrad)"/>`}
      ${isAdaptive ? `<rect width="${size}" height="${size}" fill="url(#bgGrad)"/>` : ''}
      <g filter="url(#shadow)">
        <path d="M${pinX + pinSize / 2},${pinY + pinSize * 0.15} 
                 C${pinX + pinSize * 0.85},${pinY + pinSize * 0.15} 
                  ${pinX + pinSize},${pinY + pinSize * 0.35} 
                  ${pinX + pinSize},${pinY + pinSize * 0.5}
                 C${pinX + pinSize},${pinY + pinSize * 0.75} 
                  ${pinX + pinSize / 2},${pinY + pinSize} 
                  ${pinX + pinSize / 2},${pinY + pinSize}
                 C${pinX + pinSize / 2},${pinY + pinSize} 
                  ${pinX},${pinY + pinSize * 0.75} 
                  ${pinX},${pinY + pinSize * 0.5}
                 C${pinX},${pinY + pinSize * 0.35} 
                  ${pinX + pinSize * 0.15},${pinY + pinSize * 0.15} 
                  ${pinX + pinSize / 2},${pinY + pinSize * 0.15}Z" 
              fill="url(#pinGrad)"/>
        <circle cx="${pinX + pinSize / 2}" cy="${pinY + pinSize * 0.45}" r="${pinSize * 0.18}" fill="${PRIMARY_COLOR}"/>
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function generateSplash(width, height, outputPath, isDark = false) {
  const logoSize = Math.min(width, height) * 0.25;
  const logoX = (width - logoSize) / 2;
  const logoY = (height - logoSize) / 2 - height * 0.05;
  const pinSize = logoSize * 0.6;
  const pinX = logoX + (logoSize - pinSize) / 2;
  const pinY = logoY + (logoSize - pinSize) / 2;

  const bgColor = isDark ? BG_DARK : PRIMARY_COLOR;
  const textColor = '#ffffff';

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${bgColor}"/>
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="${logoSize * 0.1}" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#glow)">
        <circle cx="${width / 2}" cy="${height / 2 - height * 0.05}" r="${logoSize * 0.45}" fill="#ffffff" opacity="0.15"/>
      </g>
      <g>
        <path d="M${pinX + pinSize / 2},${pinY + pinSize * 0.1} 
                 C${pinX + pinSize * 0.85},${pinY + pinSize * 0.1} 
                  ${pinX + pinSize},${pinY + pinSize * 0.3} 
                  ${pinX + pinSize},${pinY + pinSize * 0.45}
                 C${pinX + pinSize},${pinY + pinSize * 0.7} 
                  ${pinX + pinSize / 2},${pinY + pinSize} 
                  ${pinX + pinSize / 2},${pinY + pinSize}
                 C${pinX + pinSize / 2},${pinY + pinSize} 
                  ${pinX},${pinY + pinSize * 0.7} 
                  ${pinX},${pinY + pinSize * 0.45}
                 C${pinX},${pinY + pinSize * 0.3} 
                  ${pinX + pinSize * 0.15},${pinY + pinSize * 0.1} 
                  ${pinX + pinSize / 2},${pinY + pinSize * 0.1}Z" 
              fill="url(#logoGrad)"/>
        <circle cx="${pinX + pinSize / 2}" cy="${pinY + pinSize * 0.4}" r="${pinSize * 0.15}" fill="${bgColor}"/>
      </g>
      <text x="${width / 2}" y="${height / 2 + logoSize * 0.7}" 
            font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" 
            font-size="${logoSize * 0.28}" 
            font-weight="900" 
            fill="${textColor}" 
            text-anchor="middle" 
            letter-spacing="${logoSize * 0.02}">TAP IN</text>
      <text x="${width / 2}" y="${height / 2 + logoSize * 0.95}" 
            font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" 
            font-size="${logoSize * 0.1}" 
            font-weight="600" 
            fill="rgba(255, 255, 255, 0.7)" 
            text-anchor="middle"
            letter-spacing="${logoSize * 0.015}">DISCOVER NEARBY</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function generateFavicon(size, outputPath) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="favGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${PRIMARY_DARK};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#favGrad)"/>
      <path d="M${size / 2},${size * 0.2} 
               C${size * 0.75},${size * 0.2} 
                ${size * 0.85},${size * 0.35} 
                ${size * 0.85},${size * 0.45}
               C${size * 0.85},${size * 0.65} 
                ${size / 2},${size * 0.85} 
                ${size / 2},${size * 0.85}
               C${size / 2},${size * 0.85} 
                ${size * 0.15},${size * 0.65} 
                ${size * 0.15},${size * 0.45}
               C${size * 0.15},${size * 0.35} 
                ${size * 0.25},${size * 0.2} 
                ${size / 2},${size * 0.2}Z" 
            fill="#ffffff"/>
      <circle cx="${size / 2}" cy="${size * 0.42}" r="${size * 0.1}" fill="${PRIMARY_COLOR}"/>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets', 'images');

  await generateIcon(1024, path.join(assetsDir, 'icon.png'));
  await generateIcon(1024, path.join(assetsDir, 'adaptive-icon.png'), true);
  await generateFavicon(48, path.join(assetsDir, 'favicon.png'));
  await generateSplash(1284, 2778, path.join(assetsDir, 'splash.png'), false);

  console.log('\nAll icons generated successfully!');
}

main().catch(console.error);
