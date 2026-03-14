const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const folders = [
  'images/ServiceImages/Staging',
  'images/ServiceImages/CrewProvision',
  'images/ServiceImages/Fabrication',
  'images/ServiceImages/Projections',
  'images/ServiceImages/Equipment',
  'images/ServiceImages/FullEventDelivery',
  'images/PortfolioImages',
  'images/WebsiteHeroImages',
  'images/QueensHotelChristmasProjectionTowers'
];

folders.forEach(folder => {
  if (!fs.existsSync(folder)) { console.log('Skipping (not found):', folder); return; }
  fs.readdirSync(folder).forEach(file => {
    if (!/\.(jpg|jpeg|png|JPG|JPEG|PNG)$/i.test(file)) return;
    const input = path.join(folder, file);
    const baseName = file.replace(/\.[^.]+$/, '');
    const output = path.join(folder, baseName + '.webp');
    sharp(input)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(output, (err) => {
        if (err) console.error('Error:', file, err.message);
        else console.log('✓', output);
      });
  });
});