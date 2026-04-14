import { fromArrayBuffer } from 'geotiff';
import fs from 'fs';

async function test() {
  try {
    const buffer = fs.readFileSync('./test.tif');
    console.log('Buffer size:', buffer.length, 'bytes');
    
    const tiff = await fromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    console.log('✓ GeoTIFF parsed successfully');
    
    const image = await tiff.getImage();
    console.log('✓ Image extracted');
    console.log('  - Width:', image.getWidth());
    console.log('  - Height:', image.getHeight());
    console.log('  - SampleFormat:', image.getSampleFormat?.());
    
    // Try to read a raster
    const raster = await image.readRasters({ samples: [0] });
    console.log('✓ Rasters read successfully');
    console.log('  - Raster type:', raster[0]?.constructor?.name);
    console.log('  - Raster length:', raster[0]?.length);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();
