// Simulating what happens in the browser decoder
import { fromArrayBuffer } from 'geotiff';
import fs from 'fs';

async function testDecoder() {
  try {
    const buffer = fs.readFileSync('./test.tif');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    console.log('1. Parsing GeoTIFF from ArrayBuffer...');
    const tiff = await fromArrayBuffer(arrayBuffer);
    console.log('   ✓ Parsed');
    
    console.log('2. Getting image...');
    const image = await tiff.getImage();
    console.log('   ✓ Got image');
    
    console.log('3. Reading image properties...');
    const width = image.getWidth();
    const height = image.getHeight();
    console.log('   ✓ Image size:', width, 'x', height);
    
    console.log('4. Creating ImageData...');
    const imageData = new ImageData(width, height);
    console.log('   ✓ Created ImageData');
    
    console.log('5. Reading RGB bands...');
    const redBand = await image.readRasters({ samples: [0] });
    const greenBand = await image.readRasters({ samples: [1] });
    const blueBand = await image.readRasters({ samples: [2] });
    console.log('   ✓ Read all RGB bands');
    
    console.log('6. Checking band data types...');
    console.log('   - Red:', redBand[0]?.constructor?.name, 'length:', redBand[0]?.length);
    console.log('   - Green:', greenBand[0]?.constructor?.name, 'length:', greenBand[0]?.length);
    console.log('   - Blue:', blueBand[0]?.constructor?.name, 'length:', blueBand[0]?.length);
    
    console.log('7. Filling ImageData with pixel values...');
    const data = imageData.data;
    const red = redBand[0];
    const green = greenBand[0];
    const blue = blueBand[0];
    const isUint16 = red instanceof Uint16Array;
    const maxValue = isUint16 ? 65535 : 255;
    
    for (let i = 0; i < Math.min(10, width * height); i++) {
      const r = isUint16 ? Math.round((red[i] / maxValue) * 255) : red[i];
      const g = isUint16 ? Math.round((green[i] / maxValue) * 255) : green[i];
      const b = isUint16 ? Math.round((blue[i] / maxValue) * 255) : blue[i];
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    console.log('   ✓ Filled ImageData with pixels');
    
    console.log('8. Extracting georeferencing metadata...');
    const geoTiff = image.geoTiffData || {};
    console.log('   - geoTiffData exists:', !!image.geoTiffData);
    console.log('   - geoTiffData keys:', Object.keys(geoTiff));
    console.log('   - Has ModelPixelScale:', !!geoTiff?.ModelPixelScale);
    console.log('   - Has ModelTiepoint:', !!geoTiff?.ModelTiepoint);
    
    if (geoTiff?.ModelPixelScale) {
      console.log('   - ModelPixelScale:', geoTiff.ModelPixelScale);
    }
    if (geoTiff?.ModelTiepoint) {
      console.log('   - ModelTiepoint:', geoTiff.ModelTiepoint);
    }
    
    console.log('9. Checking tags...');
    const tags = image.getTags?.() || {};
    console.log('   - getTags() returned:', Object.keys(tags).slice(0, 10));
    if (tags.BOUNDS_WGS84) {
      console.log('   - BOUNDS_WGS84:', tags.BOUNDS_WGS84);
    }
    
    console.log('\n✓ All steps completed successfully!');
    
  } catch (error) {
    console.error('\n✗ Error at step:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDecoder();
