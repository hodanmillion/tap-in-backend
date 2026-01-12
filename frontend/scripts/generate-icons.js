const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PRIMARY_COLOR = '#4f46e5';
const PRIMARY_DARK = '#312e81';
const BG_LIGHT = '#ffffff';
const BG_DARK = '#0a0a0f';

async function generateIcon(size, outputPath, isAdaptive = false) {
  const padding = Math.round(size * 0.1);
  const iconSize = size - padding * 2;
  const cornerRadius = Math.round(size * 0.22);
  
  // Zap path (M13 2L3 14h9l-1 8 10-12h-9l1-8z) scaled to fit
  const zapScale = size / 24 * 0.7;
  const zapTranslateX = (size - 24 * zapScale) / 2;
  const zapTranslateY = (size - 24 * zapScale) / 2;

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${PRIMARY_DARK};stop-opacity:1" />
        </linearGradient>
        <linearGradient id="zapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="${Math.round(size * 0.02)}" stdDeviation="${Math.round(size * 0.03)}" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      ${isAdaptive ? '' : `<rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bgGrad)"/>`}
      ${isAdaptive ? `<rect width="${size}" height="${size}" fill="url(#bgGrad)"/>` : ''}
      
      <g filter="url(#shadow)" transform="translate(${zapTranslateX}, ${zapTranslateY}) scale(${zapScale})">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#zapGrad)"/>
      </g>

      <g transform="translate(${size / 2}, ${size * 0.82})">
        <rect x="-${size * 0.18}" y="-${size * 0.05}" width="${size * 0.36}" height="${size * 0.1}" rx="${size * 0.02}" fill="white" opacity="0.2" />
        <text 
          x="0" 
          y="${size * 0.025}" 
          fill="white" 
          font-size="${size * 0.06}" 
          font-weight="900" 
          text-anchor="middle" 
          font-family="system-ui, sans-serif"
          letter-spacing="${size * 0.005}"
        >PRO</text>
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function generateSplash(width, height, outputPath, isDark = false) {
  const logoSize = Math.min(width, height) * 0.3;
  const zapScale = logoSize / 24;
  const zapX = (width - 24 * zapScale) / 2;
  const zapY = (height - 24 * zapScale) / 2 - height * 0.05;

  const bgColor = isDark ? '#1e1b4b' : '#6366f1';
  const textColor = '#ffffff';

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${bgColor}"/>
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e2e8f0;stop-opacity:1" />
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
        <circle cx="${width / 2}" cy="${height / 2 - height * 0.05}" r="${logoSize * 0.5}" fill="#ffffff" opacity="0.1"/>
      </g>
      <g transform="translate(${zapX}, ${zapY}) scale(${zapScale})">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#logoGrad)"/>
      </g>
      <text x="${width / 2}" y="${height / 2 + logoSize * 0.8}" 
            font-family="system-ui, sans-serif" 
            font-size="${logoSize * 0.35}" 
            font-weight="900" 
            fill="${textColor}" 
            text-anchor="middle" 
            letter-spacing="2">TAP IN PRO</text>
      <text x="${width / 2}" y="${height / 2 + logoSize * 1.05}" 
            font-family="system-ui, sans-serif" 
            font-size="${logoSize * 0.12}" 
            font-weight="600" 
            fill="rgba(255, 255, 255, 0.7)" 
            text-anchor="middle"
            letter-spacing="1">PREMIUM NETWORKING</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function generateFavicon(size, outputPath) {
  const zapScale = size / 24 * 0.8;
  const zapX = (size - 24 * zapScale) / 2;
  const zapY = (size - 24 * zapScale) / 2;

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#4f46e5"/>
      <g transform="translate(${zapX}, ${zapY}) scale(${zapScale})">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white"/>
      </g>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets', 'images');

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  await generateIcon(1024, path.join(assetsDir, 'icon.png'));
  await generateIcon(1024, path.join(assetsDir, 'adaptive-icon.png'), true);
  await generateFavicon(48, path.join(assetsDir, 'favicon.png'));
  await generateSplash(1284, 2778, path.join(assetsDir, 'splash.png'), false);

  console.log('\nAll icons generated successfully!');
}

main().catch(console.error);
