(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Tiled map configuration
  let tiledMap = null;
  const TILED_MAP_SRC = '/images/maps2/map.tmj';
  
  // Map resources and tileset configuration
  const mapImage = new Image();
  const assetsImage = new Image();

  // Tileset configuration
  const TILESETS = {
    tiles: {
      firstgid: 1,
      image: mapImage,
      columns: 13,
      tilecount: 156
    },
    assets: {
      firstgid: 157,
      image: assetsImage,
      columns: 16,
      tilecount: 432
    }
  };
  
  // Layer types
  const LAYER_TYPES = {
    tilelayer: 'tilelayer',
    objectgroup: 'objectgroup'
  };
  
  // Load tilesets
  mapImage.onload = () => {
    console.log('Map tiles image loaded successfully', mapImage.width, mapImage.height);
  };
  mapImage.onerror = (e) => console.error('Error loading map tiles image:', e);
    // --- ENEMY HANDLING ---
    // Store enemy positions from the map
    let enemies = [];
    const enemySprite = new Image();
    enemySprite.src = '/images/characters/knight.jpg'; // Use any image you want for enemy
  
  assetsImage.onload = () => {
    console.log('Assets image loaded successfully', assetsImage.width, assetsImage.height);
  };
  assetsImage.onerror = (e) => console.error('Error loading assets image:', e);

  mapImage.src = '/images/maps2/tiles.png';
  assetsImage.src = '/images/maps2/assets.png';

  let world = {
    width: 0,
    height: 0
  };

  const player = {
    animations: {
      idle: { sheet: new Image(), frameCount: 4, row: 0, currentFrame: 0 },
      run: { sheet: new Image(), frameCount: 6, row: 0, currentFrame: 0 },
      attack: { sheet: new Image(), frameCount: 6, row: 0, currentFrame: 0 },
      hurt: { sheet: new Image(), frameCount: 2, row: 0, currentFrame: 0 }
    },
    currentState: 'idle',
    x: 0,
    y: 0,
    width: 48,
    height: 48,
    speed: 2,
    frameTime: 100,
    frameIndex: 0,
    frameTimeMs: 220,
    _accum: 0,
    moving: false,
    totalFrames: 7
  };

  async function loadPlayerSprites() {
    const sprites = [
      { name: 'idle', path: '/images/characters/player/idle.png' },
      { name: 'run', path: '/images/characters/player/run.png' },
      { name: 'attack', path: '/images/characters/player/attack.png' },
      { name: 'hurt', path: '/images/characters/player/hurt.png' }
    ];
    
    const loadPromises = sprites.map(sprite => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          console.log(`Loaded sprite: ${sprite.name}`);
          resolve();
        };
        img.onerror = () => {
          console.error(`Failed to load sprite: ${sprite.path}`);
          resolve();
        };
        img.src = sprite.path;
        player.animations[sprite.name].sheet = img;
      });
    });

    await Promise.all(loadPromises);
    console.log('All player sprites loaded');
  }

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

  const keys = Object.create(null);
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  const walkableRects = [{ x: 0, y: 0, w: world.width, h: world.height }];

  function update(timestamp) {
    if (!player || !camera) return;
    
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    const moveSpeed = player.speed * (deltaTime / 16);
    
    // Reset movement state
    player.moving = false;
    
    if (keys['ArrowUp'] || keys['w']) {
      player.y -= moveSpeed;
      player.moving = true;
    }
    if (keys['ArrowDown'] || keys['s']) {
      player.y += moveSpeed;
      player.moving = true;
    }
    if (keys['ArrowLeft'] || keys['a']) {
      player.x -= moveSpeed;
      player.moving = true;
    }
    if (keys['ArrowRight'] || keys['d']) {
      player.x += moveSpeed;
      player.moving = true;
    }
    
    // Update animation state
    const prevState = player.currentState;
    player.currentState = player.moving ? 'run' : 'idle';
    
    if (prevState !== player.currentState) {
      player.animations[player.currentState].currentFrame = 0;
    }
    
    // Keep player within bounds
    player.x = Math.max(0, Math.min(player.x, world.width - player.width));
    player.y = Math.max(0, Math.min(player.y, world.height - player.height));
    
    // Update camera
    if (camera) {
      camera.x = player.x - (camera.width / 2) + (player.width / 2);
      camera.y = player.y - (camera.height / 2) + (player.height / 2);
      
      camera.x = Math.max(0, Math.min(camera.x, world.width - camera.width));
      camera.y = Math.max(0, Math.min(camera.y, world.height - camera.height));
    }
  }

  function render() {
    if (!ctx || !player || !camera) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all visible tile layers in order
    if (tiledMap && mapImage.complete && assetsImage.complete) {
      for (const layer of tiledMap.layers) {
        if (layer.type !== 'tilelayer' || !layer.visible) continue;
        for (const chunk of layer.chunks) {
          // Only use chunk.x and chunk.y for infinite maps, ignore layer.x/layer.y
          const baseX = chunk.x * tiledMap.tilewidth;
          const baseY = chunk.y * tiledMap.tileheight;
          for (let y = 0; y < chunk.height; y++) {
            for (let x = 0; x < chunk.width; x++) {
              const tileId = chunk.data[y * chunk.width + x];
              if (!tileId) continue;
              let tileset = TILESETS.tiles;
              if (tileId >= TILESETS.assets.firstgid) tileset = TILESETS.assets;
              const tilesetImg = tileset.image;
              const localId = tileId - tileset.firstgid;
              const sx = (localId % tileset.columns) * tiledMap.tilewidth;
              const sy = Math.floor(localId / tileset.columns) * tiledMap.tileheight;
              const dx = baseX + x * tiledMap.tilewidth - camera.x;
              const dy = baseY + y * tiledMap.tileheight - camera.y;
              if (layer.name === 'Logs' || layer.name === 'Bridges') {
                console.log(`[${layer.name}] chunk (${chunk.x},${chunk.y}) tile (${x},${y}) tileId: ${tileId} localId: ${localId} draw at (${dx},${dy}) img: ${tilesetImg.src} loaded: ${tilesetImg.complete}`);
              }
              if (dx + tiledMap.tilewidth < 0 || dx > canvas.width || dy + tiledMap.tileheight < 0 || dy > canvas.height) continue;
              ctx.drawImage(
                tilesetImg,
                sx, sy,
                tiledMap.tilewidth, tiledMap.tileheight,
                dx, dy,
                tiledMap.tilewidth, tiledMap.tileheight
              );
            }
          }
        }
      }
    }
      if (enemies.length && enemySprite.complete) {
        for (const enemy of enemies) {
          const dx = enemy.x - camera.x;
          const dy = enemy.y - camera.y;
          ctx.drawImage(enemySprite, dx, dy, tiledMap.tilewidth, tiledMap.tileheight);
        }
      }

    // Draw the player (unchanged)
    const anim = player.animations[player.currentState];
    const sprite = anim.sheet;
    if (sprite.complete && sprite.width > 0) {
      const frameWidth = sprite.width / anim.frameCount;
      const frameHeight = sprite.height;
      ctx.save();
      ctx.translate(
        canvas.width / 2 - player.width / 2,
        canvas.height / 2 - player.height / 2
      );
      ctx.drawImage(
        sprite,
        anim.currentFrame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        0,
        0,
        player.width,
        player.height
      );
      ctx.restore();
    }
  }

  async function init() {
    try {
      console.log('Initializing game...');
      resizeCanvas();
      
      // Create loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.style.position = 'fixed';
      loadingDiv.style.top = '10px';
      loadingDiv.style.left = '10px';
      loadingDiv.style.color = 'white';
      loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
      loadingDiv.style.padding = '10px';
      loadingDiv.style.borderRadius = '5px';
      loadingDiv.style.zIndex = '1000';
      loadingDiv.textContent = 'Loading game resources...';
      document.body.appendChild(loadingDiv);

      try {
        // Load map data and tilesets
        const [mapResponse] = await Promise.all([
          fetch(TILED_MAP_SRC),
          new Promise((resolve, reject) => {
            let loaded = 0;
            function checkLoaded() {
              loaded++;
              if (loaded === 2) resolve();
            }
            mapImage.onload = checkLoaded;
            assetsImage.onload = checkLoaded;
            mapImage.onerror = reject;
            assetsImage.onerror = reject;
          })
        ]);

        tiledMap = await mapResponse.json();
        console.log('Map loaded with layers:', tiledMap.layers.map(l => l.name));
        
        // Log layer details
        tiledMap.layers.forEach(layer => {
          console.log(`Layer ${layer.name}:`);
          console.log('- Type:', layer.type);
          console.log('- Visible:', layer.visible);
          if (layer.chunks) {
            const nonEmptyTiles = layer.chunks.reduce((count, chunk) => 
              count + chunk.data.filter(id => id !== 0).length, 0);
            console.log(`- Contains ${nonEmptyTiles} non-empty tiles`);
          }
        });

        // Set world dimensions
        world.width = tiledMap.width * tiledMap.tilewidth;
        world.height = tiledMap.height * tiledMap.tileheight;

        // Center player
        player.x = world.width / 2;
        player.y = world.height / 2;

        // Remove loading indicator
        if (loadingDiv.parentNode) {
          loadingDiv.parentNode.removeChild(loadingDiv);
        }

        // Start game loop
        console.log('Starting game loop...');
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);

      } catch (error) {
        console.error('Error loading game resources:', error);
        if (loadingDiv.parentNode) {
          loadingDiv.parentNode.removeChild(loadingDiv);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error initializing game:', error);
      
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'fixed';
      errorDiv.style.top = '50px';
      errorDiv.style.left = '10px';
      errorDiv.style.color = 'red';
      errorDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
      errorDiv.style.padding = '10px';
      errorDiv.style.borderRadius = '5px';
      errorDiv.style.zIndex = '1000';
      errorDiv.innerHTML = `Game initialization error: ${error.message}`;
      document.body.appendChild(errorDiv);
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const container = document.getElementById('game-wrapper') || document.body;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    if (camera) {
      camera.updateDimensions();
    }
  }

  let lastTime = 0;

  function gameLoop(timestamp) {
    update(timestamp);
    render();
    requestAnimationFrame(gameLoop);
  }

  // Initialize game
  window.addEventListener('load', async () => {
    try {
      await loadPlayerSprites();
      await init();
    } catch (error) {
      console.error('Failed to initialize game:', error);
    }
  });

  // Handle window resize
  window.addEventListener('resize', resizeCanvas);

  // Error handling
  window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    return false;
  });
})();