# Map Coordinate System - TMJ Alignment

## ✅ **Coordinates Now Match Perfectly**

The game now uses **TMJ coordinates directly** with no offsets.

---

## 🗺️ **Map Structure**

### **Map1.tmj Properties:**
```json
{
  "infinite": true,
  "tilewidth": 16,
  "tileheight": 16,
  "chunks": [
    {
      "x": -64,  // Chunk starts at tile -64
      "y": -64,  // Chunk starts at tile -64
      "width": 16,
      "height": 16
    }
  ]
}
```

### **Coordinate System:**
- **Tile coordinates:** Can be negative (e.g., -64, -48, -32, 0, 16, 32...)
- **Pixel coordinates:** Tile coordinate × tile size (e.g., -64 × 16 = -1024 pixels)
- **Infinite map:** No boundaries, chunks loaded as needed

---

## 🎮 **Game Rendering**

### **Before Fix:**
```javascript
// ❌ Had inconsistent offsets
const mapYOffset = 64;  // Map rendering
const mapYOffset = 48;  // Object rendering
// This caused misalignment!
```

### **After Fix:**
```javascript
// ✅ No offsets - direct TMJ coordinates
const screenX = Math.round(wx - camera.x);
const screenY = Math.round(wy - camera.y);
// Perfect alignment!
```

---

## 📍 **Coordinate Conversion**

### **Tile to Pixel:**
```javascript
const pixelX = tileX * tileWidth;   // e.g., -64 * 16 = -1024
const pixelY = tileY * tileHeight;  // e.g., -64 * 16 = -1024
```

### **Pixel to Tile:**
```javascript
const tileX = Math.floor(pixelX / tileWidth);   // e.g., -1024 / 16 = -64
const tileY = Math.floor(pixelY / tileHeight);  // e.g., -1024 / 16 = -64
```

### **World to Screen:**
```javascript
const screenX = worldX - camera.x;
const screenY = worldY - camera.y;
```

---

## 🎯 **Object Placement**

### **In Tiled Editor:**
When you place objects in Tiled at position (x, y):
- **NPCs:** Use exact TMJ coordinates
- **Quests:** Use exact TMJ coordinates
- **Rewards:** Use exact TMJ coordinates
- **Spawn points:** Use exact TMJ coordinates

### **In Game:**
Objects render at their TMJ coordinates with no offset:
```javascript
// NPCs
const screenX = npc.x - camera.x;
const screenY = npc.y - camera.y;

// Quests
const screenX = quest.x - camera.x;
const screenY = quest.y - camera.y;

// Rewards
const screenX = reward.x - camera.x;
const screenY = reward.y - camera.y;
```

---

## 🔍 **Verification**

### **Test Alignment:**
1. **Place object in Tiled** at coordinates (100, 200)
2. **Check in game** - object should be at pixel (100, 200)
3. **Player position** matches TMJ coordinates exactly
4. **Collision detection** uses same coordinate system

### **Debug Mode:**
Press `C` to enable debug mode and see:
- Player position (matches TMJ coordinates)
- Camera position
- Tile coordinates
- Collision boxes

---

## 📊 **Coordinate Examples**

### **Map Chunks:**
| Chunk | Tile X | Tile Y | Pixel X | Pixel Y |
|-------|--------|--------|---------|---------|
| 1 | -64 | -64 | -1024 | -1024 |
| 2 | -48 | -64 | -768 | -1024 |
| 3 | -32 | -64 | -512 | -1024 |
| 4 | -16 | -64 | -256 | -1024 |
| 5 | 0 | -64 | 0 | -1024 |

### **Object Positions:**
| Object | TMJ X | TMJ Y | Game X | Game Y |
|--------|-------|-------|--------|--------|
| Spawn | 32 | 32 | 32 | 32 |
| NPC 1 | 100 | 150 | 100 | 150 |
| Quest | 200 | 250 | 200 | 250 |
| Reward | 300 | 350 | 300 | 350 |

**All coordinates match exactly!** ✅

---

## 🛠️ **Implementation Details**

### **Map Rendering:**
```javascript
function drawMap() {
  for (const layer of mapData.layers) {
    forEachTileInLayer(layer, (tileId, tx, ty) => {
      const wx = tx * tileW;  // World X
      const wy = ty * tileH;  // World Y
      
      // Direct conversion - no offset
      const screenX = Math.round(wx - camera.x);
      const screenY = Math.round(wy - camera.y);
      
      ctx.drawImage(tileset, sx, sy, tw, th, screenX, screenY, tw, th);
    });
  }
}
```

### **Object Rendering:**
```javascript
function drawMapObjects() {
  for (const obj of objects) {
    // Direct conversion - no offset
    const screenX = Math.round(obj.x - camera.x);
    const screenY = Math.round(obj.y - camera.y);
    
    // Draw at exact TMJ coordinates
    drawObject(obj, screenX, screenY);
  }
}
```

### **Collision Detection:**
```javascript
function tileAt(tx, ty) {
  // Uses tile coordinates directly from TMJ
  // Negative coordinates work correctly
  for (const layer of mapData.layers) {
    if (layer.chunks) {
      for (const chunk of layer.chunks) {
        // Check if tile is in this chunk
        if (tx >= chunk.x && tx < chunk.x + chunk.width &&
            ty >= chunk.y && ty < chunk.y + chunk.height) {
          // Get tile from chunk data
          const id = chunk.data[(ty - chunk.y) * chunk.width + (tx - chunk.x)];
          return id;
        }
      }
    }
  }
  return 0;
}
```

---

## ✅ **Benefits**

1. **Perfect Alignment:** TMJ coordinates = Game coordinates
2. **No Confusion:** No offsets to remember or adjust
3. **Easy Editing:** Place objects in Tiled, they appear exactly there in-game
4. **Consistent:** All systems use same coordinate space
5. **Predictable:** What you see in Tiled is what you get in-game

---

## 🎯 **Summary**

**Before:**
- ❌ Map offset: 64 pixels
- ❌ Object offset: 48 pixels
- ❌ Misalignment between TMJ and game
- ❌ Confusing coordinate conversions

**After:**
- ✅ No offsets
- ✅ TMJ coordinates used directly
- ✅ Perfect alignment
- ✅ Simple and consistent

**Result:** The game now renders everything at exact TMJ coordinates! 🎉

---

*Fixed: 2025-10-20 23:58 UTC+08:00*
