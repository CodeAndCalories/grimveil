// Removes orange grid-line artifacts from ghoul.png.
// Artifact signature: B === 0, R > G, R > 15, G > 5
// Ghoul artwork is ~86% grey (R ≈ G ≈ B), so zero-blue warm pixels are safe to clear.
const sharp = require('../node_modules/sharp');
const path  = require('path');

const FILE = path.join(__dirname, '../public/assets/sprites/ghoul.png');

sharp(FILE)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    const { width, height, channels } = info;
    let removed = 0;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a === 0) continue;
      // Orange-amber artifact: no blue, warm hue, non-trivial brightness
      if (b === 0 && r > 15 && g > 5 && r > g) {
        data[i+3] = 0; // make transparent
        removed++;
      }
    }

    console.log(`Removed ${removed} orange artifact pixels`);

    return sharp(Buffer.from(data), {
      raw: { width, height, channels },
    })
      .png()
      .toFile(FILE);
  })
  .then(out => {
    console.log(`Saved: ${FILE}`);
    console.log(`Output: ${out.width}x${out.height} (${out.size} bytes)`);

    // Verify dimensions
    return sharp(FILE).metadata();
  })
  .then(meta => {
    console.log(`Verify: ${meta.width}x${meta.height} ${meta.hasAlpha ? 'RGBA' : 'RGB'}`);
    if (meta.width === 960 && meta.height === 384) {
      console.log('DIMENSIONS OK: 960x384');
    } else {
      console.error('DIMENSION MISMATCH!');
      process.exit(1);
    }
  })
  .catch(err => { console.error(err); process.exit(1); });
