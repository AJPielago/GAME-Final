(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Tiled map configuration
  let tiledMap = null;
  const TILED_MAP_SRC = '/images/maps2/map.tmj';
  const mapImage = new Image();

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
    
    // Reset movement state
    const wasMoving = player.moving;
    player.moving = false;
    
    // Handle movement
    const moveSpeed = player.speed * (deltaTime / 16);
    
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
    
    // Update camera to follow player
    if (camera) {
      camera.x = player.x - (camera.width / 2) + (player.width / 2);
      camera.y = player.y - (camera.height / 2) + (player.height / 2);
      
      // Clamp camera to world bounds
      camera.x = Math.max(0, Math.min(camera.x, world.width - camera.width));
      camera.y = Math.max(0, Math.min(camera.y, world.height - camera.height));
    }
  }

  function render() {
    if (!ctx || !player || !camera) return;
  
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    // Draw all map layers
    if (tiledMap && mapImage.complete) {
      const tilewidth = tiledMap.tilewidth;
      const tileheight = tiledMap.tileheight;
      const tilesPerRow = Math.floor(mapImage.width / tilewidth);

      // Draw each layer in order
      tiledMap.layers.forEach(layer => {
        // Skip invisible layers
        if (!layer.visible) return;

        // Process each chunk in the layer
        layer.chunks.forEach(chunk => {
          const chunkOffsetX = chunk.x * chunk.width * tilewidth;
          const chunkOffsetY = chunk.y * chunk.height * tileheight;

          // Draw each tile in the chunk
          for (let y = 0; y < chunk.height; y++) {
            for (let x = 0; x < chunk.width; x++) {
              const tileId = chunk.data[y * chunk.width + x];
              if (tileId === 0) continue; // Skip empty tiles

              // Calculate source position in tileset
              const sx = ((tileId - 1) % tilesPerRow) * tilewidth;
              const sy = Math.floor((tileId - 1) / tilesPerRow) * tileheight;

              // Calculate destination position on canvas
              const dx = chunkOffsetX + (x * tilewidth) - camera.x;
              const dy = chunkOffsetY + (y * tileheight) - camera.y;

              // Only draw visible tiles
              if (dx + tilewidth >= 0 && dx <= canvas.width &&
                  dy + tileheight >= 0 && dy <= canvas.height) {
                ctx.drawImage(
                  mapImage,
                  sx, sy, tilewidth, tileheight,
                  dx, dy, tilewidth, tileheight
                );
              }
            }
          }
        });
      });
    }
    
    // Draw the player
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
      // Set up initial canvas size
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
      loadingDiv.textContent = 'Loading game...';
      document.body.appendChild(loadingDiv);

      try {
        // Load map data and tileset
        const [mapResponse] = await Promise.all([
          fetch(TILED_MAP_SRC),
          new Promise((resolve, reject) => {
            mapImage.onload = resolve;
            mapImage.onerror = reject;
            mapImage.src = '/images/maps2/tiles.png';
          })
        ]);

        tiledMap = await mapResponse.json();
        console.log('Map loaded:', tiledMap);

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

  // Game loop variables
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