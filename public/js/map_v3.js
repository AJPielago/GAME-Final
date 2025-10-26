// Update game.ejs to point to this new file
// Add to game.ejs:
// <script src="/js/map_v3.js?v=<%- Date.now() %>"></script>

(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Tiled map configuration
  let tiledMap = null;
  const TILED_MAP_SRC = '/images/maps2/map.tmj';
  
  // Tileset configuration
  const TILESETS = {
    tiles: {
      firstgid: 1,
      columns: 13,
      tilecount: 156
    },
    assets: {
      firstgid: 157,
      columns: 16,
      tilecount: 432
    }
  };

  // Map resources
  const mapImage = new Image();
  const assetsImage = new Image();
  
  // Load tilesets
  mapImage.src = '/images/maps2/tiles.png';
  assetsImage.src = '/images/maps2/assets.png';

  function getTilesetForTile(tileId) {
    if (tileId >= TILESETS.assets.firstgid) {
      return {
        image: assetsImage,
        columns: TILESETS.assets.columns,
        firstgid: TILESETS.assets.firstgid
      };
    }
    return {
      image: mapImage,
      columns: TILESETS.tiles.columns,
      firstgid: TILESETS.tiles.firstgid
    };
  }

  function drawTile(tileId, dx, dy, layerName = '') {
    if (tileId === 0) return; // Skip empty tiles

    const tileset = getTilesetForTile(tileId);
    const localId = tileId - tileset.firstgid;
    
    const sx = (localId % tileset.columns) * tiledMap.tilewidth;
    const sy = Math.floor(localId / tileset.columns) * tiledMap.tileheight;

    if (layerName === 'Bridges' || layerName === 'Logs') {
      console.log(`${layerName} tile ${tileId}:`, {
        sourceX: sx,
        sourceY: sy,
        destX: dx,
        destY: dy,
        tileset: tileset.image === assetsImage ? 'assets' : 'tiles',
        localId
      });
    }

    ctx.drawImage(
      tileset.image,
      sx, sy,
      tiledMap.tilewidth, tiledMap.tileheight,
      dx, dy,
      tiledMap.tilewidth, tiledMap.tileheight
    );
  }

  const world = {
    width: 0,
    height: 0
  };

  const camera = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    updateDimensions: function() {
      this.width = canvas.width;
      this.height = canvas.height;
    }
  };

  function drawLayer(layer) {
    if (!layer.visible || layer.type !== 'tilelayer') return;
    if (!layer.chunks) return; // Skip layers without chunks

    console.log(`Drawing layer: ${layer.name}`);
    let tilesDrawn = 0;

    layer.chunks.forEach(chunk => {
      // chunk.x and chunk.y are already in tile coordinates, not chunk coordinates
      const chunkOffsetX = chunk.x * tiledMap.tilewidth;
      const chunkOffsetY = chunk.y * tiledMap.tileheight;

      for (let y = 0; y < chunk.height; y++) {
        for (let x = 0; x < chunk.width; x++) {
          const tileId = chunk.data[y * chunk.width + x];
          if (tileId === 0) continue;

          const dx = chunkOffsetX + (x * tiledMap.tilewidth) - camera.x;
          const dy = chunkOffsetY + (y * tiledMap.tileheight) - camera.y;

          // Only draw if within viewport
          if (dx + tiledMap.tilewidth >= 0 && dx <= canvas.width &&
              dy + tiledMap.tileheight >= 0 && dy <= canvas.height) {
            drawTile(tileId, dx, dy, layer.name);
            tilesDrawn++;
          }
        }
      }
    });

    console.log(`${layer.name}: drew ${tilesDrawn} tiles`);
  }

  function render() {
    if (!ctx || !tiledMap || !mapImage.complete || !assetsImage.complete) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all visible layers in order
    const visibleLayers = tiledMap.layers.filter(layer => layer.visible);
    console.log('Rendering layers:', visibleLayers.map(l => l.name));

    visibleLayers.forEach(layer => {
      drawLayer(layer);
    });
  }

  async function init() {
    try {
      console.log('Loading map...');
      const response = await fetch(TILED_MAP_SRC);
      tiledMap = await response.json();

      // Wait for images to load
      await Promise.all([
        new Promise(resolve => { mapImage.onload = resolve; }),
        new Promise(resolve => { assetsImage.onload = resolve; })
      ]);

      console.log('Map loaded with layers:', tiledMap.layers.map(l => l.name));
      
      // Set world dimensions
      world.width = tiledMap.width * tiledMap.tilewidth;
      world.height = tiledMap.height * tiledMap.tileheight;

      // Initial render
      camera.updateDimensions();
      render();

    } catch (error) {
      console.error('Failed to initialize map:', error);
    }
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.updateDimensions();
    render();
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();