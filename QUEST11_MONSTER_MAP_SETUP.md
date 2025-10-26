# Quest 11 - Monster Battle Map Setup Guide

## Overview

Quest 11 (Async JavaScript) now directs players to a new map where they must defeat a monster. This guide explains how to set up the monster battle map.

## What's Already Implemented

### ✅ Quest 11 Completion Message
- When players complete Quest 11, they receive a special notification:
  - **"🗡️ New Challenge Unlocked! Head to the portal to battle a monster!"**
- Console logs indicate the map location: `/images/map3/try22.tmj`

### ✅ Quest 11 Quiz
- Quest 11 already has a complete quiz about Async JavaScript
- 3 questions covering async/await, promises, and Promise.all()

## What Needs to Be Created

### 1. Map File: `try22.tmj`

**Location:** `public/images/map3/try22.tmj`

**Requirements:**
- Create a Tiled map file (.tmj format - JSON)
- Recommended size: 20x20 tiles or similar
- Should include:
  - Ground layer
  - Collision layers (walls, obstacles)
  - Monster spawn point (object layer)
  - Player spawn point (object layer)
  - Portal/exit back to main map

**Example Structure:**
```json
{
  "compressionlevel": -1,
  "height": 20,
  "width": 20,
  "infinite": false,
  "layers": [
    {
      "name": "ground",
      "type": "tilelayer",
      "data": [...]
    },
    {
      "name": "walls",
      "type": "tilelayer",
      "data": [...]
    },
    {
      "name": "objects",
      "type": "objectgroup",
      "objects": [
        {
          "name": "player_spawn",
          "type": "spawn",
          "x": 160,
          "y": 160
        },
        {
          "name": "monster",
          "type": "enemy",
          "x": 320,
          "y": 320,
          "properties": {
            "enemyType": "async_beast",
            "health": 100,
            "damage": 10
          }
        }
      ]
    }
  ],
  "tilesets": [...]
}
```

### 2. Portal/Transition Object

Add a portal object in the main map (map1.tmj) that:
- Appears after Quest 11 completion
- Teleports player to `try22.tmj` when interacted with
- Visual indicator (glowing portal, door, etc.)

**Example Portal Object:**
```json
{
  "name": "portal_to_monster_map",
  "type": "portal",
  "x": 500,
  "y": 300,
  "width": 32,
  "height": 32,
  "properties": {
    "targetMap": "/images/map3/try22.tmj",
    "requiresQuest": 338,
    "message": "Enter the portal to face the Async Beast!"
  }
}
```

### 3. Monster Battle System

You'll need to implement a basic combat system:

**Required Components:**
- Monster entity class
- Combat UI (health bars, attack buttons)
- Turn-based or real-time combat logic
- Victory/defeat conditions

**Suggested Implementation:**

```javascript
// Add to game.js

class Monster {
  constructor(type, health, damage, x, y) {
    this.type = type;
    this.health = health;
    this.maxHealth = health;
    this.damage = damage;
    this.x = x;
    this.y = y;
    this.isAlive = true;
  }
  
  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
    }
  }
  
  attack(player) {
    return this.damage;
  }
}

// Combat system
const combatSystem = {
  active: false,
  monster: null,
  playerHealth: 100,
  
  startBattle(monster) {
    this.active = true;
    this.monster = monster;
    this.playerHealth = 100;
    console.log('⚔️ Battle started with', monster.type);
  },
  
  playerAttack() {
    const damage = Math.floor(Math.random() * 20) + 10; // 10-30 damage
    this.monster.takeDamage(damage);
    
    if (!this.monster.isAlive) {
      this.endBattle(true);
    } else {
      // Monster counter-attacks
      this.monsterAttack();
    }
  },
  
  monsterAttack() {
    const damage = this.monster.attack();
    this.playerHealth -= damage;
    
    if (this.playerHealth <= 0) {
      this.endBattle(false);
    }
  },
  
  endBattle(victory) {
    this.active = false;
    
    if (victory) {
      // Award rewards
      playerProfile.awardExperience(150, 'Defeated monster!');
      playerProfile.awardPixelCoins(100, 'Monster loot!');
      playerProfile.gameStats.monstersDefeated++;
      
      // Show victory message
      playerController.showQuestNotification('🎉 Victory! Monster defeated!', '#FFD700');
      
      // Unlock return portal
      console.log('🚪 Return portal unlocked');
    } else {
      // Respawn player at entrance
      playerController.showQuestNotification('💀 Defeated! Try again!', '#FF4444');
    }
  }
};
```

### 4. Map Transition System

Implement map loading/switching:

```javascript
async function loadMap(mapPath) {
  try {
    console.log('🗺️ Loading map:', mapPath);
    
    const response = await fetch(mapPath);
    const mapData = await response.json();
    
    // Clear current map
    MapRenderer.clearMap();
    
    // Load new map
    await MapRenderer.loadMap(mapData);
    
    // Find player spawn point
    const spawn = MapRenderer.findPlayerStart();
    player.x = spawn.x;
    player.y = spawn.y;
    
    console.log('✅ Map loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load map:', error);
  }
}
```

## Implementation Steps

### Step 1: Create the Map File
1. Open Tiled Map Editor
2. Create a new map (20x20 tiles, 16x16 tile size)
3. Design the battle arena
4. Add player spawn point
5. Add monster spawn point
6. Add collision layers
7. Export as JSON (.tmj)
8. Save to `public/images/map3/try22.tmj`

### Step 2: Add Portal to Main Map
1. Open `public/images/map/map1.tmj` in Tiled
2. Add an object layer if not exists
3. Add portal object with properties:
   - `type`: "portal"
   - `targetMap`: "/images/map3/try22.tmj"
   - `requiresQuest`: 338 (Quest 11 ID)
4. Save the map

### Step 3: Implement Combat System
1. Add Monster class to `game.js`
2. Add combat UI rendering
3. Add combat controls (attack, defend, flee)
4. Test combat mechanics

### Step 4: Implement Map Transitions
1. Add portal interaction detection
2. Add map loading function
3. Add transition animations
4. Test map switching

### Step 5: Test Complete Flow
1. Complete Quest 11
2. See notification about monster challenge
3. Find and interact with portal
4. Load into battle map
5. Defeat monster
6. Return to main map

## Current Quest 11 ID

The Quest 11 object ID in the map is likely **338** (based on the code check).

You can verify this by searching the map file for Quest 11 or checking the quest objects in Tiled.

## Rewards for Monster Battle

Suggested rewards:
- **XP:** 150
- **Gold:** 100
- **Badge:** "Monster Slayer" - Defeated your first monster
- **Stat:** Increment `monstersDefeated` counter

## Notes

- The map3 folder already exists at `public/images/map3/`
- Quest 11 quiz is already implemented
- The notification system is already in place
- You'll need to create the actual map file and combat system
- Consider adding a "Return Portal" in the monster map to get back to the main map

## Testing

To test without completing Quest 11:
1. Manually add quest 338 to `gameState.completedQuests`
2. Or modify the portal to not require the quest temporarily
3. Test map loading and combat independently

## Future Enhancements

- Multiple monster types
- Boss battles
- Loot drops
- Monster animations
- Combat sound effects
- Special abilities/skills
- Party system for multiplayer
