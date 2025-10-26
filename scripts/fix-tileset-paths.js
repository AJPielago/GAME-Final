const fs = require('fs');
const path = require('path');

// Paths to map files
const mapFiles = [
  'c:/Users/kylie/GAMEE/public/images/map/map1.tmj',
  'c:/Users/kylie/GAMEE/public/images/maps2/map.tmj'
];

// Function to extract filename from a path
function getFileName(filePath) {
  return path.basename(filePath);
}

// Function to fix tileset paths in a map file
function fixTilesetPaths(mapFilePath) {
  console.log(`🔧 Fixing tileset paths in: ${mapFilePath}`);
  
  try {
    // Read the map file
    const mapContent = fs.readFileSync(mapFilePath, 'utf8');
    
    // Parse JSON
    const mapData = JSON.parse(mapContent);
    
    if (!mapData.tilesets) {
      console.log('No tilesets found in map file');
      return;
    }
    
    let changesCount = 0;
    
    // Fix each tileset image path
    mapData.tilesets.forEach((tileset, index) => {
      if (tileset.image && tileset.image.includes('Users/Alex Joyous')) {
        const originalPath = tileset.image;
        const fileName = getFileName(originalPath);
        
        console.log(`  Fixing tileset ${index}: ${fileName}`);
        
        // Set to just the filename (relative to the map file's directory)
        tileset.image = fileName;
        changesCount++;
      } else if (tileset.image && tileset.image.includes('../')) {
        const originalPath = tileset.image;
        const fileName = getFileName(originalPath);
        
        console.log(`  Fixing relative path ${index}: ${fileName}`);
        
        // Set to just the filename
        tileset.image = fileName;
        changesCount++;
      }
    });
    
    if (changesCount > 0) {
      // Write the fixed map file
      fs.writeFileSync(mapFilePath, JSON.stringify(mapData, null, 1));
      console.log(`✅ Fixed ${changesCount} tileset paths in ${path.basename(mapFilePath)}`);
    } else {
      console.log(`ℹ️ No tileset paths needed fixing in ${path.basename(mapFilePath)}`);
    }
    
  } catch (error) {
    console.error(`❌ Error fixing ${mapFilePath}:`, error.message);
  }
}

// Main function
function fixAllTilesetPaths() {
  console.log('🚀 Starting tileset path fixes...\n');
  
  mapFiles.forEach(mapFile => {
    if (fs.existsSync(mapFile)) {
      fixTilesetPaths(mapFile);
    } else {
      console.log(`⚠️ Map file not found: ${mapFile}`);
    }
    console.log('');
  });
  
  console.log('🎉 Tileset path fixing completed!');
}

// Run the fix
fixAllTilesetPaths();
