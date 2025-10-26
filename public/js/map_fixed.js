(function() {
  'use strict';

  // Declare all variables at the top
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Game state variables
  const mapImage = new Image();
  let tilesDrawn = 0;
  const layerName = 'default';
  let tiledMap = null;
  const TILED_MAP_SRC = '/images/maps2/map.tmj';

  let world = {
    width: 0,
    height: 0
  };

  // Resolve character type
  function resolveCharacterType() {
    const wrapper = document.getElementById('game-wrapper');
    if (wrapper) {
      const attrType = (wrapper.getAttribute('data-character-type') || '').toLowerCase();
      if (attrType) return attrType;
      const attrAvatar = (wrapper.getAttribute('data-character-avatar') || '').toLowerCase();
      if (attrAvatar.includes('paladin')) return 'paladin';
      if (attrAvatar.includes('mage')) return 'mage';
      if (attrAvatar.includes('druid')) return 'druid';
      if (attrAvatar.includes('knight')) return 'knight';
    }
    const game = window.GAME || {};
    let t = (game.character && game.character.type) ? String(game.character.type).toLowerCase() : '';
    if (!t && game.character && game.character.avatar) {
      const a = game.character.avatar.toLowerCase();
      if (a.includes('paladin')) t = 'paladin';
      else if (a.includes('mage')) t = 'mage';
      else if (a.includes('druid')) t = 'druid';
      else if (a.includes('knight')) t = 'knight';
    }
    return t || 'knight';
  }

  const characterType = resolveCharacterType();
  console.log('Selected characterType:', characterType, window.GAME && window.GAME.character);

  const sheetFileMap = {
    knight: 'tinyKnight .png',
    mage: 'tinyMage.png',
    druid: 'tinyDruid.png',
    paladin: 'tinyPaladin .png'
  };
  
  const spriteSheetSrc = '/images/characters/' + (sheetFileMap[characterType] || sheetFileMap.knight) + '?v=' + Date.now();

  const player = {
    sheet: new Image(),
    x: 960,
    y: 540,
    width: 64,
    height: 64,
    speed: 0.8,
    cols: 3,
    rows: 3,
    frameIndex: 0,
    frameTimeMs: 220,
    _accum: 0,
    moving: false,
    totalFrames: 7
  };
  
  player.sheet.src = spriteSheetSrc;
  player.sheet.onerror = function() { 
    console.error('Failed to load sprite sheet:', spriteSheetSrc); 
  };

  const camera = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    updateDimensions: function() {
      this.width = canvas.width;
      this.height = canvas.height;
      console.log('Camera dimensions updated:', { width: this.width, height: this.height });
    }
  };
  
  // Initialize camera dimensions
  camera.updateDimensions();

  const keys = Object.create(null);
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  const walkableRects = [ { x: 0, y: 0, w: world.width, h: world.height } ];

  // Offscreen canvas for pixel-perfect collision against map transparency
  const mapBuffer = document.createElement('canvas');
  const mapCtx = mapBuffer.getContext('2d');

  function mapReady() {
    const sw = mapImage.naturalWidth || mapImage.width;
    const sh = mapImage.naturalHeight || mapImage.height;
    // Implementation of mapReady function
  }

  function isOpaque(px, py) {
    // Implementation of isOpaque function
    return true;
  }

  function canMoveTo(nx, ny, w, h) {
    // Implementation of canMoveTo function
    return true;
  }

  function update(dt) {
    // Implementation of update function
  }

  function render() {
    // Implementation of render function
  }

  function drawLayer(layerName) {
    try {
      // Implementation of drawLayer function
      console.log(`Drew ${tilesDrawn} tiles for layer '${layerName}'`);
    } catch (error) {
      console.error(`Error in drawLayer('${layerName}'):`, error);
    }
  }

  // Handle canvas resizing
  function resizeCanvas() {
    if (!canvas) return;
    
    const container = document.getElementById('game-wrapper') || document.body;
    if (container) {
      const prevWidth = canvas.width;
      const prevHeight = canvas.height;
      
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      if (camera && camera.updateDimensions) {
        camera.updateDimensions();
      }
      
      console.log('Canvas resized:', { 
        from: { width: prevWidth, height: prevHeight },
        to: { width: canvas.width, height: canvas.height }
      });
      
      if (camera) {
        camera.width = canvas.width;
        camera.height = canvas.height;
      }
    }
  }

  // Initialize the game
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
      loadingDiv.textContent = 'Loading game...';
      document.body.appendChild(loadingDiv);
      
      // Load the map
      console.log('Loading map...');
      loadingDiv.textContent = 'Loading map...';
      
      // Remove loading indicator when done
      loadingDiv.remove();
      
      // Start game loop
      let lastTime = 0;
      function gameLoop(timestamp) {
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        
        update(deltaTime);
        render();
        
        requestAnimationFrame(gameLoop);
      }
      
      requestAnimationFrame(gameLoop);
      
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  }

  // Create settings UI
  function createSettingsUI() {
    const wrapper = document.getElementById('game-wrapper');
    if (!wrapper) return;
    
    const btn = document.createElement('button');
    btn.textContent = '⚙️';
    btn.style.position = 'fixed';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = '10000';
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.fontSize = '24px';
    btn.style.cursor = 'pointer';
    
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.top = '50px';
    panel.style.right = '10px';
    panel.style.zIndex = '10001';
    panel.style.padding = '12px';
    panel.style.border = '2px solid var(--gold)';
    panel.style.background = 'rgba(0,0,0,0.8)';
    panel.style.color = 'white';
    panel.style.display = 'none';
    panel.style.minWidth = '180px';
    
    const leaveBtn = document.createElement('button');
    leaveBtn.textContent = 'Save & Leave';
    leaveBtn.style.width = '100%';
    leaveBtn.style.padding = '8px';
    leaveBtn.style.cursor = 'pointer';
    
    leaveBtn.addEventListener('click', async () => {
      try {
        await fetch('/game/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            x: player.x, 
            y: player.y, 
            savedAt: new Date().toISOString() 
          })
        });
      } catch (e) { 
        console.error('Error saving game:', e);
      }
      window.location.href = '/dashboard';
    });
    
    panel.appendChild(leaveBtn);
    wrapper.style.position = 'relative';
    wrapper.appendChild(btn);
    wrapper.appendChild(panel);
    
    btn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Initialize the game when the window loads
  function initializeGame() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
      
      // Create settings UI
      createSettingsUI();
      
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  }

  // Initialize the game
  initializeGame();

  // Error handling for uncaught exceptions
  window.addEventListener('error', function(event) {
    console.error('Unhandled error:', event.error);
    return false;
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    resizeCanvas();
  });
})();
