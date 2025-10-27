# Map3 - Monster Battle Arena Setup

## Overview
Map3 is a dedicated monster battle arena for Quest 11. It has been separated into its own JavaScript file and HTML page for better code organization.

## Files Created

### 1. `/public/js/map3.js`
- **Purpose**: Dedicated JavaScript file for the monster battle arena
- **Features**:
  - Complete game loop for battle mechanics
  - Player class with movement and attack system
  - Monster class with AI and health system
  - Map rendering with tile animations
  - HUD showing health, score, and monsters defeated
  - Victory/Game Over screens
  - Camera system that follows the player

### 2. `/public/map3.html`
- **Purpose**: HTML page for the monster battle arena
- **Features**:
  - Battle-themed UI with red accents
  - Loading screen with battle icon
  - Canvas for game rendering
  - Links to map3.js

## How It Works

### Quest 11 Flow
1. Player interacts with Quest 11 NPC
2. Custom prompt appears asking if they want to battle monsters
3. If player clicks "YES, I'M READY!":
   - Quest is marked as completed
   - Player receives 100 XP and 50 gold
   - Redirects to `/map3.html` after 1.5 seconds
4. If player clicks "NOT YET":
   - Prompt closes, player can come back later

### Game Mechanics

#### Player Controls
- **WASD** or **Arrow Keys**: Move character
- **SPACE**: Attack nearby monsters
- Attack has a 500ms cooldown
- Attack range: 30 pixels

#### Monsters
- **Type**: Wraith enemies (5 total)
- **Health**: 50 HP each
- **Damage**: 10 HP per attack
- **AI**: Moves towards player, attacks when close
- **Sprites**: Uses `/images/map3/Wraith1.png`, `Wraith2.png`, `Wraith3.png`

#### Victory Conditions
- **Victory**: Defeat all 5 monsters
- **Game Over**: Player health reaches 0
- **Return**: Press R to return to main map

#### Scoring
- +100 points per monster defeated
- Final score displayed on victory/game over screen

## Map Assets Used
- **Map File**: `/images/map3/try22.tmj`
- **Tilesets**: Automatically loaded from map file
- **Monster Sprites**: Wraith1.png, Wraith2.png, Wraith3.png, boss.png
- **Animations**: Fire, water, traps (from tileset)

## Code Structure

### map3.js Organization
```
1. Configuration (MAP3_CONFIG)
2. Game State
3. Player Class
4. Monster Class
5. Map Loading & Rendering
6. Camera System
7. HUD & UI
8. Game Loop
9. Input Handlers
10. Initialization
```

### Key Functions
- `loadMap()`: Loads map3 TMJ file and tilesets
- `initGame()`: Creates player and spawns monsters
- `spawnMonsters()`: Creates 5 wraith monsters at predefined positions
- `gameLoop()`: Main game loop (update & render)
- `updateCamera()`: Follows player with camera
- `drawHUD()`: Displays health, score, controls

## Integration with Main Game

### In game.js
- Line 1672-1676: Special handler for Quest 11
- Line 1712-1829: `showQuest11MonsterPrompt()` function
- Line 1820: Redirects to `/map3.html`

### Removed from game.js
- Quest 11 lesson content (was async JavaScript lesson)
- Quest 11 quiz content (was async JavaScript quiz)

## Future Enhancements
- Add boss monster after defeating all wraiths
- Power-ups and health pickups
- Different attack types
- Multiplayer support
- Leaderboard for high scores
- More monster types
- Special abilities/skills

## Testing
1. Complete Quest 1-10
2. Interact with Quest 11 NPC
3. Click "YES, I'M READY!"
4. Battle arena should load
5. Test controls and combat
6. Defeat all monsters for victory
7. Press R to return to main map
