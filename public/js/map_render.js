/**
 * Map Rendering Module
 * Handles all map-related operations: loading, rendering, and collision detection
 * Extracted from game.js to improve maintainability
 */

(function(window) {
  'use strict';

  // Map configuration
  const MAP_SRC = '/images/map/Map1.tmj';
  
  // Map data storage
  let mapData = null;
  const tilesetImages = {};

  /**
   * Load map data and tilesets from TMJ file
   */
  async function loadMap() {
    try {
      // Add cache-busting to ensure fresh TMJ file is loaded
      const cacheBuster = '?t=' + Date.now();
      const mapUrl = MAP_SRC + cacheBuster;
      console.log('🔄 Loading map from:', mapUrl);
      const response = await fetch(mapUrl, { 
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load map: ${response.status}`);
      }
      
      mapData = await response.json();
      console.log('📦 Map data loaded:', {
        infinite: mapData.infinite,
        tilewidth: mapData.tilewidth,
        tileheight: mapData.tileheight,
        layers: mapData.layers?.map(l => ({
          name: l.name,
          type: l.type,
          visible: l.visible,
          opacity: l.opacity,
          chunks: l.chunks?.length || 0,
          objects: l.objects?.length || 0
        })) || [],
        tilesets: mapData.tilesets?.map(t => ({
          name: t.name,
          firstgid: t.firstgid,
          image: t.image,
          tilecount: t.tilecount
        })) || []
      });
      
      // Load tilesets
      const tilesetPromises = (mapData.tilesets || []).map(async (tileset) => {
        // Safety check for tileset.image
        if (!tileset || !tileset.image) {
          console.warn('Tileset missing image property:', tileset);
          return Promise.resolve();
        }
        
        const img = new Image();
        return new Promise((resolve, reject) => {
          img.onload = () => {
            console.log(`✅ Loaded tileset:`, tileset.name);
            tilesetImages[tileset.firstgid] = {
              ...tileset,
              image: img,
              columns: tileset.columns || Math.floor(img.width / (tileset.tilewidth || 16))
            };
            resolve();
          };
          img.onerror = () => {
            console.error(`Failed to load tileset:`, tileset.image);
            reject(new Error(`Failed to load tileset image: ${tileset.image}`));
          };

          img.src = `/images/map/${tileset.image.split('/').pop()}`;
        });
      });

      // Wait for all tilesets to load
      await Promise.all(tilesetPromises);
      
      console.log('✅ Map loading complete:', {
        tilesets: Object.keys(tilesetImages).length,
        layers: mapData.layers?.length || 0,
        mapDataExists: !!mapData
      });
      
      return true;
    } catch (error) {
      console.error('❌ Map loading failed:', error);
      throw error;
    }
  }

  /**
   * Iterate over each tile in a layer (handles both chunked and non-chunked maps)
   */
  function forEachTileInLayer(layer, callback) {
    if (!layer) return;
    if (layer.chunks) {
      for (const chunk of layer.chunks) {
        for (let y = 0; y < chunk.height; y++) {
          for (let x = 0; x < chunk.width; x++) {
            callback(chunk.data[y * chunk.width + x], chunk.x + x, chunk.y + y);
          }
        }
      }
    } else if (layer.data) {
      const w = layer.width || 0;
      for (let i = 0; i < layer.data.length; i++) {
        callback(layer.data[i], i % w, Math.floor(i / w));
      }
    }
  }

  /**
   * Draw the map with tile culling optimization
   */
  function drawMap(ctx, camera, canvas) {
    if (!mapData) {
      console.warn('⚠️ drawMap called but mapData is null');
      return;
    }
    if (Object.keys(tilesetImages).length === 0) {
      console.warn('⚠️ drawMap called but no tilesets loaded');
      return;
    }
    const tileW = mapData.tilewidth || 16;
    const tileH = mapData.tileheight || tileW;
    
    // Calculate visible tile range for culling
    const startTileX = Math.floor(camera.x / tileW) - 1;
    const startTileY = Math.floor(camera.y / tileH) - 1;
    const endTileX = Math.ceil((camera.x + canvas.width) / tileW) + 1;
    const endTileY = Math.ceil((camera.y + canvas.height) / tileH) + 1;
    
    for (const layer of mapData.layers || []) {
      if (layer.type !== 'tilelayer') continue;
      
      forEachTileInLayer(layer, (tileId, tx, ty) => {
        if (!tileId) return;
        
        // Skip tiles outside visible range (culling)
        if (tx < startTileX || tx > endTileX || ty < startTileY || ty > endTileY) return;
        
        const ts = Object.values(tilesetImages).slice().sort((a, b) => b.firstgid - a.firstgid).find(t => tileId >= t.firstgid);
        if (!ts || !ts.image) return;
        
        const local = tileId - ts.firstgid;
        const sx = (local % ts.columns) * ts.tilewidth;
        const sy = Math.floor(local / ts.columns) * ts.tileheight;
        const wx = tx * tileW;
        const wy = ty * tileH;
        
        const screenX = Math.round(wx - camera.x);
        const screenY = Math.round(wy - camera.y);
        
        ctx.drawImage(ts.image, sx, sy, ts.tilewidth, ts.tileheight, screenX, screenY, tileW, tileH);
      });
    }
  }

  /**
   * Draw collision debug overlay
   */
  function drawCollisionDebug(ctx, camera, canvas, gameState) {
    if (!gameState.collisionDebug || !mapData) return;
    
    const tileW = mapData.tilewidth || 16;
    const tileH = mapData.tileheight || tileW;
    
    // Draw collision tiles in red
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    
    for (const layer of mapData.layers || []) {
      if (layer.type !== 'tilelayer') continue;
      
      forEachTileInLayer(layer, (tileId, tx, ty) => {
        if (!tileId) return; // Skip empty tiles
        
        const wx = tx * tileW;
        const wy = ty * tileH;
        
        // No offset needed - TMJ coordinates are used directly
        const screenX = Math.round(wx - camera.x);
        const screenY = Math.round(wy - camera.y);
        
        // Only draw if on screen
        if (screenX > -tileW && screenX < canvas.width + tileW && 
            screenY > -tileH && screenY < canvas.height + tileH) {
          ctx.fillRect(screenX, screenY, tileW, tileH);
        }
      });
    }
  }

  /**
   * Get tile ID at specific tile coordinates
   */
  function tileAt(tx, ty) {
    if (!mapData) return 0;
    
    // Define collision layers - these layers should block movement
    const collisionLayers = ['fences', 'trees', 'houses', 'collision', 'walls', 'obstacles'];
    
    for (const layer of mapData.layers || []) {
      if (layer.type !== 'tilelayer') continue;
      
      // Only check collision for specific layers
      if (!collisionLayers.includes(layer.name)) continue;
      
      if (layer.chunks) {
        for (const c of layer.chunks) {
          if (tx >= c.x && tx < c.x + c.width && ty >= c.y && ty < c.y + c.height) {
            const id = c.data[(ty - c.y) * c.width + (tx - c.x)];
            if (id) {
              return id;
            }
          }
        }
      } else if (layer.data) {
        if (tx < 0 || ty < 0 || tx >= layer.width) continue;
        const id = layer.data[ty * layer.width + tx];
        if (id) {
          return id;
        }
      }
    }
    return 0;
  }

  /**
   * Draw a tile from tileset using GID
   */
  function drawTileFromGid(ctx, gid, screenX, screenY, width, height) {
    if (!gid || !mapData) return false;
    
    // Find the correct tileset for this GID
    const tileset = Object.values(tilesetImages)
      .slice()
      .sort((a, b) => b.firstgid - a.firstgid)
      .find(ts => gid >= ts.firstgid);
    
    if (!tileset || !tileset.image) return false;
    
    // Calculate source position in tileset
    const localId = gid - tileset.firstgid;
    const tileWidth = tileset.tilewidth || 16;
    const tileHeight = tileset.tileheight || 16;
    const columns = tileset.columns || Math.floor(tileset.image.width / tileWidth);
    
    const sourceX = (localId % columns) * tileWidth;
    const sourceY = Math.floor(localId / columns) * tileHeight;
    
    try {
      ctx.drawImage(
        tileset.image,
        sourceX, sourceY, tileWidth, tileHeight,
        screenX, screenY, width, height
      );
      return true;
    } catch (error) {
      console.warn('Failed to draw tile from GID:', gid, error);
      return false;
    }
  }

  /**
   * Draw NPCs, quests, and rewards
   */
  function drawMapObjects(ctx, camera, canvas, gameState, player) {
    if (!window.gameMapData) return;
    
    const { npcs, quests, rewards } = window.gameMapData;
    
    // Pre-calculate screen bounds for culling
    const screenLeft = -50;
    const screenRight = canvas.width + 50;
    const screenTop = -50;
    const screenBottom = canvas.height + 50;
    
    // Draw NPCs using tileset sprites
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      const screenX = Math.round(npc.x - camera.x);
      const screenY = Math.round(npc.y - camera.y);
      
      // Only draw if on screen (optimized bounds check)
      if (screenX > screenLeft && screenX < screenRight && 
          screenY > screenTop && screenY < screenBottom) {
        
        // Try to draw NPC sprite from tileset if gid exists
        if (npc.gid && drawTileFromGid(ctx, npc.gid, screenX, screenY, npc.width, npc.height)) {
          // Successfully drew sprite
        }
        // No fallback - NPCs without sprites are invisible
        
        // Add NPC label
        if (gameState.debugMode && npc.name) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Arial';
          ctx.fillText(npc.name, screenX, screenY - 2);
        }
      }
    }
    
    // Draw quests using sprites or fallback to stars
    for (let i = 0; i < quests.length; i++) {
      const quest = quests[i];
      
      const screenX = Math.round(quest.x - camera.x);
      const screenY = Math.round(quest.y - camera.y);
      
      if (screenX > screenLeft && screenX < screenRight && 
          screenY > screenTop && screenY < screenBottom) {
        
        // Try to draw quest sprite from tileset if gid exists
        if (quest.gid && drawTileFromGid(ctx, quest.gid, screenX, screenY, quest.width, quest.height)) {
          // Successfully drew sprite
        } else {
          // Fallback to yellow star
          ctx.fillStyle = '#ffdd00';
          const centerX = screenX + quest.width / 2;
          const centerY = screenY + quest.height / 2;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY - 8);
          ctx.lineTo(centerX + 2, centerY - 2);
          ctx.lineTo(centerX + 8, centerY - 2);
          ctx.lineTo(centerX + 3, centerY + 2);
          ctx.lineTo(centerX + 5, centerY + 8);
          ctx.lineTo(centerX, centerY + 4);
          ctx.lineTo(centerX - 5, centerY + 8);
          ctx.lineTo(centerX - 3, centerY + 2);
          ctx.lineTo(centerX - 8, centerY - 2);
          ctx.lineTo(centerX - 2, centerY - 2);
          ctx.closePath();
          ctx.fill();
        }
        
        if (gameState.debugMode && quest.name) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Arial';
          ctx.fillText(quest.name, screenX, screenY - 2);
        }
      }
    }
    
    // Draw rewards using sprites or fallback to diamonds (only uncollected ones)
    for (let i = 0; i < rewards.length; i++) {
      const reward = rewards[i];
      // Skip collected rewards
      if (gameState.collectedRewards.has(reward.id)) continue;
      
      const screenX = Math.round(reward.x - camera.x);
      const screenY = Math.round(reward.y - camera.y);
      
      if (screenX > screenLeft && screenX < screenRight && 
          screenY > screenTop && screenY < screenBottom) {
        
        // Try to draw reward sprite from tileset if gid exists
        if (reward.gid && drawTileFromGid(ctx, reward.gid, screenX, screenY, reward.width, reward.height)) {
          // Successfully drew sprite - add sparkle effect
          const time = Date.now() / 1000;
          const sparkleAlpha = (Math.sin(time * 3) + 1) / 2 * 0.5 + 0.3;
          ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha})`;
          ctx.beginPath();
          ctx.arc(screenX + reward.width / 2, screenY + reward.height / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Fallback to green diamond
          ctx.fillStyle = '#00ff66';
          const centerX = screenX + reward.width / 2;
          const centerY = screenY + reward.height / 2;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY - 8);
          ctx.lineTo(centerX + 6, centerY);
          ctx.lineTo(centerX, centerY + 8);
          ctx.lineTo(centerX - 6, centerY);
          ctx.closePath();
          ctx.fill();
          
          // Add sparkle effect for rewards
          const time = Date.now() / 1000;
          const sparkleAlpha = (Math.sin(time * 3) + 1) / 2 * 0.5 + 0.3;
          ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha})`;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Show 'F' indicator only when player is nearby
        if (player) {
          const playerCenterX = player.x + player.width / 2;
          const playerCenterY = player.y + player.height / 2;
          const rewardCenterX = reward.x + reward.width / 2;
          const rewardCenterY = reward.y + reward.height / 2;
          const distance = Math.sqrt(
            Math.pow(playerCenterX - rewardCenterX, 2) + 
            Math.pow(playerCenterY - rewardCenterY, 2)
          );
          
          if (distance <= 30) { // Show F when within 30 pixels
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 12px Arial';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText('F', screenX + reward.width / 2 - 4, screenY - 5);
            ctx.fillText('F', screenX + reward.width / 2 - 4, screenY - 5);
          }
        }
        
        if (gameState.debugMode && reward.name) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Arial';
          ctx.fillText(reward.name, screenX, screenY - 15);
        }
      }
    }
  }

  /**
   * Find player spawn point from map
   * @param {Function} boxIsFree - Optional collision check function
   */
  function findPlayerStart(boxIsFree) {
    if (!mapData) {
      console.warn('⚠️ No map data, using default spawn');
      return { x: 32, y: 32 };
    }

    const tw = mapData.tilewidth || 16;
    const th = mapData.tileheight || tw;

    // Look specifically for "spawn" layer with spawn point (ID 284)
    for (const layer of mapData.layers || []) {
      const layerName = layer.name.toLowerCase();
      if (layer.type === 'objectgroup' && layerName === 'spawn') {
        console.log('🎯 Found spawn layer with', layer.objects?.length || 0, 'objects');
        for (const obj of layer.objects || []) {
          // Look specifically for object with name "spawn point" and ID 284
          const objName = (obj.name || '').toLowerCase();
          
          if (obj.id === 284 && objName === 'spawn point') {
            const spawnPos = { x: obj.x, y: obj.y };
            console.log('✅ Found spawn point (ID 284, name "spawn point") in spawn layer:', {
              id: obj.id,
              name: obj.name,
              type: obj.type,
              position: spawnPos,
              objectSize: { width: obj.width || 0, height: obj.height || 0 }
            });
            
            // Use raw TMJ coordinates
            console.log('🎯 Returning spawn position:', spawnPos);
            return spawnPos;
          }
        }
        
        // Fallback: use any object in spawn layer
        if (layer.objects && layer.objects.length > 0) {
          const firstObj = layer.objects[0];
          console.log('🔍 Using first object in spawn layer:', {
            id: firstObj.id,
            name: firstObj.name,
            position: { x: firstObj.x, y: firstObj.y }
          });
          return { x: firstObj.x, y: firstObj.y };
        }
        
        console.warn('⚠️ Spawn layer found but no spawn point object detected');
      }
    }

    // Fallback: check other object layers for spawn points
    for (const layer of mapData.layers || []) {
      if (layer.type === 'objectgroup') {
        for (const obj of layer.objects || []) {
          if (obj.type === 'spawn' || obj.name === 'spawn' || obj.class === 'spawn') {
            console.log('✅ Found spawn point in map:', { x: obj.x, y: obj.y });
            return { x: obj.x, y: obj.y };
          }
        }
      }
    }

    // Fallback: Find first empty 2x2 space if boxIsFree is provided
    if (boxIsFree && typeof boxIsFree === 'function') {
      console.log('🔍 No spawn point found, searching for safe area...');
      
      // Start from center of map for better spawn position
      const centerX = Math.floor((mapData.width || 100) / 2);
      const centerY = Math.floor((mapData.height || 100) / 2);
      
      // Search in expanding spiral from center
      for (let radius = 0; radius < 50; radius++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
          for (let x = centerX - radius; x <= centerX + radius; x++) {
            if (x < 0 || y < 0) continue;
            const worldX = x * tw;
            const worldY = y * th;
            
            if (boxIsFree(worldX, worldY, tw * 2, th * 2)) {
              console.log('✅ Found safe spawn area at:', { x: worldX, y: worldY });
              return { x: worldX, y: worldY };
            }
          }
        }
      }
    }

    // Last resort: Use default position
    console.warn('⚠️ No safe spawn found, using default position');
    return { x: tw * 2, y: th * 2 }; // A bit offset from origin
  }

  /**
   * Process NPCs and quests from map object layers
   */
  function processMapObjects() {
    if (!mapData) return;
    
    const npcs = [];
    const quests = [];
    const rewards = [];
    const questIds = new Set(); // Track quest IDs to prevent duplicates
    
    for (const layer of mapData.layers || []) {
      if (layer.type !== 'objectgroup') continue;
      
      console.log(`🔍 Processing object layer: ${layer.name} with ${layer.objects?.length || 0} objects`);
      
      for (const obj of layer.objects || []) {
        // Check if this object is a quest (based on name containing 'quest')
        const isQuest = (obj.name || '').toLowerCase().includes('quest');
        
        if (layer.name === 'npc') {
          if (isQuest) {
            // Treat as quest
            const quest = {
              id: obj.id,
              name: obj.name || 'Quest',
              x: obj.x,
              y: obj.y,
              width: obj.width || 16,
              height: obj.height || 16,
              gid: obj.gid,
              dialogue: null
            };
            
            // Extract dialogue from properties
            if (obj.properties) {
              for (const prop of obj.properties) {
                if (prop.name === 'dialogue' || prop.name === 'd2' || prop.name === '1st Quest') {
                  quest.dialogue = prop.value;
                  break;
                }
              }
            }
            
            // Only add if not already added
            if (!questIds.has(quest.id)) {
              questIds.add(quest.id);
              quests.push(quest);
              console.log(`📋 Found Quest (from NPC layer): ${quest.name} at (${quest.x}, ${quest.y}) with dialogue: "${quest.dialogue}"`);
            } else {
              console.log(`⚠️ Skipping duplicate quest: ${quest.name} (ID: ${quest.id})`);
            }
          } else {
            // Process as regular NPC
            const npc = {
              id: obj.id,
              name: obj.name || 'NPC',
              x: obj.x,
              y: obj.y,
              width: obj.width || 16,
              height: obj.height || 16,
              gid: obj.gid,
              dialogue: null
            };
            
            // Extract dialogue from properties
            if (obj.properties) {
              for (const prop of obj.properties) {
                if (prop.name === 'dialogue' || prop.name === 'd2') {
                  npc.dialogue = prop.value;
                  break;
                }
              }
            }
            
            npcs.push(npc);
            console.log(`👤 Found NPC: ${npc.name} at (${npc.x}, ${npc.y}) with GID: ${npc.gid} and dialogue: "${npc.dialogue}"`);
          }
          
        } else if (layer.name === 'quest') {
          // Process quests
          const quest = {
            id: obj.id,
            name: obj.name || 'Quest',
            x: obj.x,
            y: obj.y,
            width: obj.width || 16,
            height: obj.height || 16,
            gid: obj.gid,
            dialogue: null
          };
          
          // Extract dialogue from properties
          if (obj.properties) {
            for (const prop of obj.properties) {
              if (prop.name === 'dialogue' || prop.name === 'd2' || prop.name === '1st Quest') {
                quest.dialogue = prop.value;
                break;
              }
            }
          }
          
          // Only add if not already added
          if (!questIds.has(quest.id)) {
            questIds.add(quest.id);
            quests.push(quest);
            console.log(`📋 Found Quest: ${quest.name} at (${quest.x}, ${quest.y}) with GID: ${quest.gid} and dialogue: "${quest.dialogue}"`);
          } else {
            console.log(`⚠️ Skipping duplicate quest: ${quest.name} (ID: ${quest.id})`);
          }
          
        } else if (layer.name === 'rewards') {
          // Process rewards
          const reward = {
            id: obj.id,
            name: obj.name || 'Reward',
            x: obj.x,
            y: obj.y,
            width: obj.width || 16,
            height: obj.height || 16,
            gid: obj.gid
          };
          
          rewards.push(reward);
          console.log(`🎁 Found Reward: ${reward.name} at (${reward.x}, ${reward.y}) with GID: ${reward.gid}`);
        }
      }
    }
    
    // Add quest7 if it doesn't exist (for Arrays in JavaScript quest)
    const quest7Exists = quests.some(q => q.name && q.name.toLowerCase().includes('arrays in javascript'));
    if (!quest7Exists) {
      quests.push({
        id: 700, // Use unique ID that won't conflict
        name: 'Arrays in JavaScript',
        x: 550,
        y: 350,
        width: 32,
        height: 32,
        gid: null,
        dialogue: null
      });
      console.log('✅ Added Quest 7 (Arrays in JavaScript) to map data');
    }
    
    // Store in global variables for game use
    window.gameMapData = {
      npcs,
      quests,
      rewards
    };
    
    console.log(`✅ Processed map objects: ${npcs.length} NPCs, ${quests.length} quests, ${rewards.length} rewards`);
  }

  /**
   * Get map data (read-only access)
   */
  function getMapData() {
    return mapData;
  }

  /**
   * Get tileset images (read-only access)
   */
  function getTilesetImages() {
    return tilesetImages;
  }

  // Export public API
  window.MapRenderer = {
    loadMap,
    drawMap,
    drawCollisionDebug,
    drawMapObjects,
    tileAt,
    findPlayerStart,
    processMapObjects,
    getMapData,
    getTilesetImages,
    forEachTileInLayer
  };

  console.log('✅ MapRenderer module loaded');

})(window);
