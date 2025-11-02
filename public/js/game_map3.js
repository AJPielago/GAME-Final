(function() {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Use Map3Renderer
  const MapRenderer = window.Map3Renderer;

  console.log('🎮 Map3 Game System Initializing...');

  // Ensure gameData exists even if not authenticated
  if (!window.gameData) {
    window.gameData = {
      user: {
        id: null,
        username: 'Guest',
        characterType: 'knight',
        level: 1,
        experience: 0,
        pixelCoins: 0,
        badges: []
      }
    };
    console.log('🧩 Created default gameData for guest user');
  }

  // Collision overrides Map (same as game.js)
  const collisionOverrides = new Map();
  
  // Check if current user is admin
  function isUserAdmin() {
    console.log('🔍 Checking admin status...');
    console.log('🔍 gameData:', window.gameData);
    console.log('🔍 user:', window.gameData?.user);

    // Check multiple possible ways the admin status might be stored
    const user = window.gameData?.user;

    if (!user) {
      console.log('❌ No user data available');
      return false;
    }

    // Check various possible admin indicators
    const possibleAdminChecks = [
      user.role === 'admin',
      user.role === 'Admin',
      user.role === 'administrator',
      user.role === 'Administrator',
      user.admin === true,
      user.isAdmin === true,
      user.is_admin === true,
      user.administrator === true,
      user.role === 'superuser',
      user.role === 'Superuser'
    ];

    console.log('🔍 Checking admin indicators:', {
      role: user.role,
      admin: user.admin,
      isAdmin: user.isAdmin,
      is_admin: user.is_admin,
      administrator: user.administrator,
      role_admin: user.role === 'admin',
      role_Admin: user.role === 'Admin'
    });

    const isAdmin = possibleAdminChecks.some(check => check === true);

    console.log('🔍 Admin check result:', isAdmin ? 'ADMIN ✓' : 'NOT ADMIN ✗');

    // If admin check passed, remember this for future sessions
    if (isAdmin) {
      markAdminAccess();
    }

    return isAdmin;
  }

  // Mark that this user has admin access (for cross-game compatibility)
  function markAdminAccess() {
    const userId = window.gameData?.user?.id;
    if (userId) {
      const adminAccessKey = `admin_access_${userId}`;
      localStorage.setItem(adminAccessKey, 'true');
      console.log('✅ Admin access marked for future sessions');
    }
  }
  
  // Global collision override save/load functions
  async function saveCollisionOverridesGlobally() {
    try {
      // Convert Map to plain object
      const overridesObj = {};
      collisionOverrides.forEach((value, key) => {
        overridesObj[key] = value;
      });

      console.log('💾 Saving collision overrides globally:', collisionOverrides.size, 'tiles');

      const response = await fetch('/api/collision-overrides/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ overrides: overridesObj })
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('🔐 Not authenticated - cannot save collision overrides');
          return false; // Not an error, just can't save
        }
        if (response.status === 403) {
          console.log('🚫 Not admin - cannot save collision overrides');
          return false; // Not an error, just can't save
        }
        throw new Error(`Save failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Collision overrides saved globally:', result.count, 'tiles');
      return true;
    } catch (error) {
      console.log('ℹ️ Cannot save collision overrides (not authenticated or not admin):', error.message);
      return false; // Don't treat this as a fatal error
    }
  }
  
  async function loadCollisionOverridesGlobally() {
    try {
      console.log('📥 Loading global collision overrides...');

      const response = await fetch('/api/collision-overrides/load', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('🔐 Not authenticated - skipping collision overrides');
          return true; // Not an error for non-authenticated users
        }
        if (response.status === 403) {
          console.log('🚫 Not admin - skipping collision overrides');
          return true; // Not an error for non-admin users
        }
        throw new Error(`Load failed: ${response.status}`);
      }

      const result = await response.json();

      // Clear existing overrides
      collisionOverrides.clear();

      // Load overrides from database
      if (result.overrides) {
        Object.entries(result.overrides).forEach(([key, value]) => {
          collisionOverrides.set(key, value);
        });
        console.log('✅ Loaded global collision overrides:', collisionOverrides.size, 'tiles');

        // If collision overrides were loaded, mark this user as having admin access
        markAdminAccess();
      }

      return true;
    } catch (error) {
      console.log('ℹ️ Collision overrides not available (not authenticated or not admin):', error.message);
      return true; // Don't treat this as a fatal error
    }
  }

  // Character Avatar Image
  let characterAvatarImage = null;
  
  function loadCharacterAvatar() {
    if (window.gameData?.user?.characterType) {
      const characterType = window.gameData.user.characterType;

      console.log('🔍 Loading avatar for characterType:', characterType);
      console.log('🔍 Available gameData:', window.gameData);

      // Try different variations of the character type
      const variations = [
        characterType.toLowerCase(),
        characterType.charAt(0).toUpperCase() + characterType.slice(1).toLowerCase(),
        characterType.toLowerCase().replace(' ', ''),
        characterType.charAt(0).toUpperCase() + characterType.slice(1)
      ];

      console.log('🔍 Trying avatar paths:', variations.map(v => `/images/characters/${v}.jpg`));

      // Try each variation
      for (const variation of variations) {
        const portraitPath = `/images/characters/${variation}.jpg`;

        const img = new Image();
        img.onload = () => {
          characterAvatarImage = img;
          console.log('✅ Character portrait loaded successfully:', portraitPath);
        };
        img.onerror = () => {
          console.warn('⚠️ Failed to load character portrait:', portraitPath);
        };
        img.src = portraitPath;

        // If this one loads successfully, stop trying others
        if (img.complete && img.naturalWidth !== 0) {
          break;
        }
      }

      // If no avatar loaded, try a fallback
      if (!characterAvatarImage) {
        console.log('🔄 Trying fallback avatar paths...');
        const fallbacks = ['knight', 'mage', 'druid', 'paladin'];
        for (const fallback of fallbacks) {
          const fallbackPath = `/images/characters/${fallback}.jpg`;
          const img = new Image();
          img.onload = () => {
            characterAvatarImage = img;
            console.log('✅ Fallback character portrait loaded:', fallbackPath);
          };
          img.onerror = () => {
            console.warn('⚠️ Failed to load fallback portrait:', fallbackPath);
          };
          img.src = fallbackPath;

          if (img.complete && img.naturalWidth !== 0) {
            break;
          }
        }
      }
    } else {
      console.warn('⚠️ No characterType available in gameData:', window.gameData);
      console.log('🔄 Loading default knight avatar...');
      const defaultPath = '/images/characters/knight.jpg';
      const img = new Image();
      img.onload = () => {
        characterAvatarImage = img;
        console.log('✅ Default character portrait loaded:', defaultPath);
      };
      img.onerror = () => {
        console.warn('⚠️ Failed to load default portrait:', defaultPath);
      };
      img.src = defaultPath;
    }
  }
  
  // Player Profile System (matching game.js)
  class PlayerProfile {
    constructor() {
      this.playerName = 'Unknown Player'; // Default name until player sets it
      this.inGameName = null; // In-game name from server
      this.pixelCoins = 0;
      this.experience = 0;
      this.level = 1;
      this.badges = [];
      this.achievements = [];
      this.gameStats = {
        monstersDefeated: 0,
        questsCompleted: 0,
        codeLinesWritten: 0,
        playTime: 0
      };
      this.sessionStartTime = Date.now();
    }
    
    // Load profile from server
    async loadProfile() {
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          console.log(`🔄 Profile load attempt ${retries + 1}/${maxRetries}...`);
          console.log('🔍 gameData available:', !!window.gameData);
          console.log('🔍 user available:', !!window.gameData?.user);
          console.log('🔍 user ID:', window.gameData?.user?.id);

          if (!window.gameData?.user?.id) {
            console.warn('⚠️ No user ID available for profile loading, will use defaults');
            return;
          }

          const response = await fetch('/api/profile', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });

          console.log('🔍 Profile API response status:', response.status);

          if (response.ok) {
            const userData = await response.json();
            console.log('🔍 Profile data received:', userData);

            this.updateFromServerData(userData);
            console.log('✅ Profile loaded successfully:', {
              level: this.level,
              experience: this.experience,
              pixelCoins: this.pixelCoins,
              badges: this.badges.length,
              characterType: window.gameData?.user?.characterType
            });
            return; // Success, exit retry loop
          } else {
            console.warn('⚠️ Profile API returned status:', response.status);
            const errorText = await response.text();
            console.warn('⚠️ Error response:', errorText);

            if (response.status === 404) {
              console.log('ℹ️ No profile found, using defaults');
              return; // No profile exists yet, this is OK
            }
          }
        } catch (error) {
          console.error(`❌ Profile load attempt ${retries + 1} failed:`, error);
          console.error('❌ Error details:', error.message);

          retries++;
          if (retries < maxRetries) {
            console.log(`⏳ Retrying in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      console.error('❌ Profile loading failed after all retries, using defaults');
    }

    // Update profile from server data
    updateFromServerData(userData) {
      this.playerName = userData.playerName || this.playerName;
      this.inGameName = userData.inGameName || this.inGameName;
      this.pixelCoins = userData.pixelCoins || 0;
      this.experience = userData.experience || 0;
      this.level = userData.level || 1;
      this.badges = userData.badges || [];
      this.achievements = userData.achievements || [];
      this.gameStats = userData.gameStats || this.gameStats;
    }

    // Award pixelCoins
    async awardPixelCoins(amount, reason = 'Reward collected') {
      this.pixelCoins += amount;
      console.log(`💰 Awarded ${amount} pixelCoins: ${reason}`);
      
      // Note: Save happens after quest completion, not on every coin award
    }
    
    // Award experience
    async awardExperience(amount, reason = 'Quest completed') {
      const oldLevel = this.level;
      this.experience += amount;
      
      // Check for level up with cumulative XP requirements
      // Level 2 = 150 XP, Level 3 = 300 XP (150+150), Level 4 = 450 XP (150+150+150), etc.
      let newLevel = this.level;
      let xpNeeded = this.getXPForNextLevel();
      
      while (this.experience >= xpNeeded) {
        newLevel++;
        xpNeeded = this.getXPForLevel(newLevel + 1);
      }
      
      if (newLevel > oldLevel) {
        this.level = newLevel;
        console.log(`🎉 LEVEL UP! Now level ${this.level}`);
      }
      
      console.log(`⭐ Awarded ${amount} experience: ${reason}`);
      
      // Note: Save happens after quest completion, not on every XP award
    }
    
    // Get total XP needed to reach a specific level
    getXPForLevel(level) {
      // Cumulative XP: Level 2 = 150, Level 3 = 300, Level 4 = 450, etc.
      // Formula: (level - 1) * 150 * level / 2
      // Simplified: 75 * (level - 1) * level
      return 75 * (level - 1) * level;
    }
    
    // Get XP needed for current level
    getXPForCurrentLevel() {
      return this.getXPForLevel(this.level);
    }
    
    // Get XP needed for next level
    getXPForNextLevel() {
      return this.getXPForLevel(this.level + 1);
    }
    
    // Get XP progress to next level (0-1)
    getXPProgress() {
      const currentLevelXP = this.getXPForCurrentLevel();
      const nextLevelXP = this.getXPForNextLevel();
      const xpInCurrentLevel = this.experience - currentLevelXP;
      const xpNeededForLevel = nextLevelXP - currentLevelXP;
      return Math.min(1, Math.max(0, xpInCurrentLevel / xpNeededForLevel));
    }

    // Award badge
    async awardBadge(badgeName, reason = 'Achievement unlocked') {
      if (!this.badges.includes(badgeName)) {
        this.badges.push(badgeName);
        console.log(`🏆 Badge earned: ${badgeName}`);
        
        // Note: Save happens after quest completion, not on every badge award
      }
    }

    // Save profile data to server with enhanced error handling
    async saveToServer(data) {
      try {
        // Build complete save payload with all current profile data
        const savePayload = {
          playerName: this.playerName || 'Unknown Player',
          inGameName: data?.inGameName || this.inGameName || null, // Prioritize passed data
          pixelCoins: Number(this.pixelCoins) || 0,
          experience: Number(this.experience) || 0,
          level: Number(this.level) || 1,
          badges: Array.isArray(this.badges) ? this.badges : [],
          achievements: Array.isArray(this.achievements) ? this.achievements : [],
          gameStats: {
            monstersDefeated: Number(this.gameStats?.monstersDefeated) || 0,
            questsCompleted: Number(this.gameStats?.questsCompleted) || 0,
            codeLinesWritten: Number(this.gameStats?.codeLinesWritten) || 0,
            playTime: Number(this.gameStats?.playTime) || 0
          },
          playerPosition: {
            x: Number(player?.x) || 0,
            y: Number(player?.y) || 0
          },
          collectedRewards: Array.from(gameState?.collectedRewards || []),
          activeQuests: Array.from(gameState?.activeQuests || []),
          completedQuests: Array.from(gameState?.completedQuests || []),
          interactedNPCs: Array.from(gameState?.interactedNPCs || []),
          questProgress: gameState?.questProgress || {},
          playerDirection: gameState?.playerDirection || 'right',
          currentAnimation: gameState?.currentAnimation || 'idle',
          savedAt: new Date().toISOString()
        };
        
        const response = await fetch('/game/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(savePayload)
        });
        
        if (!response.ok) {
          // Check if it's an authentication error
          if (response.status === 401) {
            console.error('❌ Authentication required - redirecting to login');
            window.location.href = '/auth/login';
            return;
          }
          
          const errorText = await response.text();
          console.error('❌ Profile save error response:', errorText);
          throw new Error(`Save failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || 'Profile save failed');
        }

        console.log('✅ Profile saved successfully');
      } catch (error) {
        console.error('❌ Failed to save profile:', error.message);
      }
    }
  }

  // Initialize player profile as class instance
  const playerProfile = new PlayerProfile();

  // Expose playerProfile globally for dialogue system access
  window.playerProfile = playerProfile;

  // Simple game state for Map3
  const gameState = {
    debugMode: false,
    collisionDebug: false,
    showHUD: true,
    showSettings: false,
    gearHovered: false,
    settingsHoverOption: 0,
    completedQuests: new Set(),
    currentEnemy: null,
    showingDialogue: false,
    completedEnemies: new Set(), // Track defeated enemies
    dialogueAutoCloseTimer: null,
    collectedRewards: new Set(),
    activeQuests: new Set(),
    interactedNPCs: new Set(),
    questProgress: {},
    playerDirection: 'right',
    currentAnimation: 'idle'
  };

  // Expose gameState globally for dialogue system access
  window.gameState = gameState;

  // Quest completion handler for dialogue system
  window.onQuestComplete = function(questId, questTitle) {
    console.log(`🎉 Quest completed: ${questId} - ${questTitle}`);
    
    // Add to completed quests
    gameState.completedQuests.add(questId.toLowerCase());
    
    // Award experience and level up
    playerProfile.awardExperience(25, `Completed quest: ${questTitle}`);
    
    // Award pixel coins
    playerProfile.awardPixelCoins(10, `Completed quest: ${questTitle}`);
    
    // Save profile data
    playerProfile.saveToServer();
    
    console.log(`✅ Quest ${questId} marked as completed. Total completed: ${gameState.completedQuests.size}`);
  };

  // Audio Management System for Map3 - uses global AudioManager
  const AudioManager = window.AudioManager;

  // Player object
  let player = {
    x: 0,
    y: 0,
    width: 48,
    height: 48,
    speed: 200
  };

  const camera = { x: 0, y: 0, width: canvas.width, height: canvas.height, zoom: 1.5 };
  let animationManager = null;
  let debugManager = null; // DebugManager for collision debugging
  let collisionDebugSystem = null; // Fallback collision debug system

  // Resize canvas
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.width = canvas.width;
    camera.height = canvas.height;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Load map
  async function loadMap() {
    try {
      console.log('🗺️ Loading Map3...');
      await MapRenderer.loadMap();
      
      // Find spawn point
      const spawn = MapRenderer.findPlayerStart();
      if (spawn) {
        player.x = spawn.x;
        player.y = spawn.y;
        console.log('✅ Player spawned at:', spawn);
      }
      
      // Process map objects
      MapRenderer.processMapObjects();
      
      // Initialize DebugManager (same pattern as game.js)
      try {
        if (typeof window.DebugManager !== 'undefined') {
          console.log('🔧 Initializing DebugManager for Map3...');
          
          // Create pseudo-scene for canvas-based game (same as game.js)
          const pseudoScene = {
            add: {
              graphics: () => ({
                lineStyle: () => {},
                strokeRect: () => {},
                fillStyle: () => {},
                fillRect: () => {},
                setDepth: () => {}
              }),
              text: (x, y, text, style) => ({
                setScrollFactor: () => {},
                setDepth: () => {},
                setText: () => {},
                destroy: () => {}
              })
            },
            input: {
              on: () => {},
              off: () => {}
            },
            cameras: {
              main: {
                worldView: { x: camera.x, y: camera.y, width: canvas.width, height: canvas.height }
              }
            },
            scale: {
              width: canvas.width,
              height: canvas.height
            }
          };
          
          debugManager = new window.DebugManager(pseudoScene);

          // Setup collision debug for map layers
          const mapData = MapRenderer.getMapData();
          if (mapData && mapData.layers) {
            const debugLayers = mapData.layers
              .filter(layer => layer.type === 'tilelayer')
              .map(layer => ({
                name: layer.name,
                layer: layer,
                collision: !['floor', 'floor2', 'floor3', 'ground', 'background'].includes(layer.name.toLowerCase())
              }));

            debugManager.setupCollisionDebug(debugLayers, {
              excludeLayers: ['floor', 'floor2', 'floor3', 'ground', 'background'],
              player: player,
              autoEnable: false
            });

            console.log(`✅ DebugManager initialized for ${debugLayers.length} layers`);
          }
        } else {
          console.log('⚠️ DebugManager not available - collision debug will be limited');
          console.log('💡 Load collision-debug-new.js before game_map3.js to enable full collision debugging');
        }
      } catch (error) {
        console.warn('⚠️ Failed to initialize DebugManager:', error);
        console.log('Collision debugging will still work via drawCollisionDebugOverlay()');
      }
      
      console.log('✅ Map3 loaded successfully');
      
      // Load collision overrides from database (only if user is authenticated and admin)
      try {
        await loadCollisionOverridesGlobally();
      } catch (error) {
        console.log('ℹ️ Collision overrides not loaded (not authenticated or not admin):', error.message);
      }
      
      // Check if user has admin access marked (for cross-game compatibility)
      if (window.gameData?.user?.id) {
        const adminAccessKey = `admin_access_${window.gameData.user.id}`;
        const hasAdminAccess = localStorage.getItem(adminAccessKey) === 'true';

        if (hasAdminAccess && !window.gameData.user.role) {
          // Set admin role if not already set but user has admin access
          window.gameData.user.role = 'admin';
          console.log('✅ Admin role set based on previous admin access');
        }
      }
      
      // Profile and avatar are loaded in main init function
      
      return true;
    } catch (error) {
      console.error('❌ Map3 loading failed:', error);
      throw error;
    }
  }

  // AnimationManager copied from game.js
  class AnimationManager {
    constructor() {
      this.frameIndex = 0;
      this.animationTimer = 0;
      this.currentAnimation = 'idle';
      this.sprites = {};
      
      // Animation configurations - 3x3 grid with 7 frames
      this.animConfig = {
        idle: { frameRate: 6, expectedFrames: 7, spriteSheet: 'idle', frameWidth: 32, frameHeight: 32 },
        walk: { frameRate: 8, expectedFrames: 7, spriteSheet: 'walk', frameWidth: 32, frameHeight: 32 }
      };
    }
    
    async loadCharacterSprite(characterType) {
      const capitalizedType = characterType.charAt(0).toUpperCase() + characterType.slice(1);
      const fileName = `${capitalizedType}.png`;

      console.log('🔍 Loading character sprite for:', characterType);
      console.log('🔍 Capitalized type:', capitalizedType);
      console.log('🔍 Full path:', `/images/characters/player/${fileName}`);

      return new Promise((resolve, reject) => {
        const img = new Image();
        const fullPath = `/images/characters/player/${fileName}`;

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.warn(`⏰ Loading timeout for ${fileName} after 10 seconds`);
          reject(new Error(`Loading timeout for ${fileName}`));
        }, 10000);

        img.onload = () => {
          clearTimeout(timeout);
          // Store the sprite sheet for all animations
          this.sprites['character'] = img;
          this.sprites['idle'] = img;
          this.sprites['walk'] = img;

          console.log(`✅ Successfully loaded: ${fileName}`);
          console.log(`📐 Sprite dimensions: ${img.width}x${img.height}`);
          resolve();
        };
        img.onerror = (error) => {
          clearTimeout(timeout);
          console.error(`❌ Failed to load: ${fullPath}`);

          // Try fallback variations
          console.log('🔄 Trying fallback sprite variations...');
          const variations = [
            characterType.toLowerCase(),
            characterType.charAt(0).toUpperCase() + characterType.slice(1).toLowerCase(),
            characterType.toLowerCase().replace(' ', ''),
            characterType.charAt(0).toUpperCase() + characterType.slice(1)
          ];

          let loaded = false;
          for (const variation of variations) {
            const fallbackPath = `/images/characters/player/${variation}.png`;
            const fallbackImg = new Image();

            fallbackImg.onload = () => {
              if (!loaded) {
                loaded = true;
                clearTimeout(timeout);
                this.sprites['character'] = fallbackImg;
                this.sprites['idle'] = fallbackImg;
                this.sprites['walk'] = fallbackImg;
                console.log(`✅ Successfully loaded fallback: ${variation}.png`);
                console.log(`📐 Sprite dimensions: ${fallbackImg.width}x${fallbackImg.height}`);
                resolve();
              }
            };
            fallbackImg.onerror = () => {
              console.warn(`⚠️ Failed to load fallback: ${fallbackPath}`);
            };
            fallbackImg.src = fallbackPath;
          }

          // If no variations work, try hardcoded fallbacks
          if (!loaded) {
            const fallbacks = ['Knight', 'Mage', 'Druid', 'Paladin'];
            for (const fallback of fallbacks) {
              const fallbackPath = `/images/characters/player/${fallback}.png`;
              const fallbackImg = new Image();

              fallbackImg.onload = () => {
                if (!loaded) {
                  loaded = true;
                  clearTimeout(timeout);
                  this.sprites['character'] = fallbackImg;
                  this.sprites['idle'] = fallbackImg;
                  this.sprites['walk'] = fallbackImg;
                  console.log(`✅ Successfully loaded hardcoded fallback: ${fallback}.png`);
                  console.log(`📐 Sprite dimensions: ${fallbackImg.width}x${fallbackImg.height}`);
                  resolve();
                }
              };
              fallbackImg.onerror = () => {
                console.warn(`⚠️ Failed to load hardcoded fallback: ${fallbackPath}`);
              };
              fallbackImg.src = fallbackPath;
            }
          }

          // If still no luck, reject
          if (!loaded) {
            reject(new Error(`Failed to load ${fileName}`));
          }
        };
        img.src = fullPath;
      });
    }
    
    update(deltaTime = 16) {
      const config = this.animConfig[gameState.currentAnimation];
      if (!config) return;
      
      this.animationTimer += deltaTime;
      const frameTime = 1000 / config.frameRate;
      
      if (this.animationTimer >= frameTime) {
        this.frameIndex = (this.frameIndex + 1) % config.expectedFrames;
        this.animationTimer = 0;
      }
      
      // Reset animation if changed
      if (this.currentAnimation !== gameState.currentAnimation) {
        this.currentAnimation = gameState.currentAnimation;
        this.frameIndex = 0;
        this.animationTimer = 0;
      }
    }
    
    getCurrentSprite() {
      const config = this.animConfig[gameState.currentAnimation];
      if (!config || !this.sprites[config.spriteSheet]) {
        return this.sprites['idle'];
      }
      return this.sprites[config.spriteSheet];
    }
    
    getFrameData() {
      const sprite = this.getCurrentSprite();
      if (!sprite) return null;
      
      const config = this.animConfig[gameState.currentAnimation];
      if (!config) return null;
      
      // Check if sprite is loaded and has dimensions
      if (sprite.width === 0 || sprite.height === 0) {
        return null;
      }
      
      // 3x3 grid sprite sheet - use only first 7 frames
      const gridCols = 3;
      const gridRows = 3;
      const totalFrames = 7;
      
      const frameWidth = Math.floor(sprite.width / gridCols);
      const frameHeight = Math.floor(sprite.height / gridRows);
      
      // Limit frame index to 7 frames
      const currentFrame = this.frameIndex % totalFrames;
      
      // Calculate position in 3x3 grid
      const col = currentFrame % gridCols;
      const row = Math.floor(currentFrame / gridCols);
      
      const sourceX = col * frameWidth;
      const sourceY = row * frameHeight;
      
      return {
        sprite,
        frameWidth,
        frameHeight,
        sourceX,
        sourceY
      };
    }
  }

  // Collision detection (respects collision overrides like game.js)
  // Now checks ALL layers for collision overrides, not just excluding certain layers
  // This allows floor2, stairs, and other layers to be toggled on/off for collision
  // Floor layer is completely excluded from collision detection and visualization
  function checkCollisionAtPosition(x, y, width, height) {
    const mapData = MapRenderer.getMapData();
    if (!mapData) return false;

    const tileW = mapData.tilewidth || 16;
    const tileH = mapData.tileheight || tileW;

    const hitboxInset = 12;
    const checkX = x + hitboxInset;
    const checkY = y + hitboxInset;
    const checkW = width - (hitboxInset * 2);
    const checkH = height - (hitboxInset * 2);

    const corners = [
      { x: checkX, y: checkY },
      { x: checkX + checkW, y: checkY },
      { x: checkX, y: checkY + checkH },
      { x: checkX + checkW, y: checkY + checkH }
    ];

    for (const corner of corners) {
      const tileX = Math.floor(corner.x / tileW);
      const tileY = Math.floor(corner.y / tileH);

      // Check ALL layers for collision overrides (except floor layer)
      for (const layer of mapData.layers) {
        if (layer.type !== 'tilelayer') continue;

        const layerName = layer.name.toLowerCase();

        // Skip floor layer completely (never has collision)
        if (layerName === 'floor') continue;

        // Check if there's a tile at this position
        let hasTile = false;
        MapRenderer.forEachTileInLayer(layer, (tileId, tx, ty) => {
          if (tx === tileX && ty === tileY && tileId) {
            hasTile = true;
          }
        });

        if (hasTile) {
          // Check for collision override first
          const tileKey = `${tileX},${tileY},${layer.name}`;
          if (collisionOverrides.has(tileKey)) {
            // Use override value (true = collision ON, false = collision OFF)
            if (collisionOverrides.get(tileKey)) {
              return true; // Override says collision ON
            }
            // Override says collision OFF, continue checking other layers
          } else {
            // No override - check if this layer normally has collision
            const normallyHasCollision = !['floor', 'floor2', 'floor3', 'ground', 'background', 'stairs', 'people'].includes(layerName);
            if (normallyHasCollision) {
              return true; // Normal collision layer without override
            }
            // Non-collision layer without override - no collision
          }
        }
      }
    }
    return false;
  }

  // Player movement
  const keys = {};
  let lastUpdateTime = 0;

  function update(currentTime) {
    const deltaTime = (currentTime - lastUpdateTime) || 16;
    lastUpdateTime = currentTime;

    if (!player) return;

    let dx = 0;
    let dy = 0;
    let isMoving = false;
    const moveSpeed = (player.speed * deltaTime) / 1000;

    // Disable movement when dialogue, quiz, or settings are active
    if (gameState.showingDialogue || currentEnemy.active || gameState.showSettings) {
      gameState.currentAnimation = 'idle';
      // Update animation
      if (animationManager) {
        animationManager.update(deltaTime);
      }
      // Update camera even when not moving
      updateCamera();
      return;
    }

    if (keys['w'] || keys['arrowup']) {
      dy -= moveSpeed;
      gameState.playerDirection = 'up';
      isMoving = true;
    }
    if (keys['s'] || keys['arrowdown']) {
      dy += moveSpeed;
      gameState.playerDirection = 'down';
      isMoving = true;
    }
    if (keys['a'] || keys['arrowleft']) {
      dx -= moveSpeed;
      gameState.playerDirection = 'left';
      isMoving = true;
    }
    if (keys['d'] || keys['arrowright']) {
      dx += moveSpeed;
      gameState.playerDirection = 'right';
      isMoving = true;
    }

    // Update animation state
    gameState.currentAnimation = isMoving ? 'walk' : 'idle';

    // Apply movement with collision detection
    const newX = player.x + dx;
    const newY = player.y + dy;

    if (!checkCollisionAtPosition(newX, player.y, player.width, player.height)) {
      player.x = newX;
    }
    if (!checkCollisionAtPosition(player.x, newY, player.width, player.height)) {
      player.y = newY;
    }

    // Update animation
    if (animationManager) {
      animationManager.update(deltaTime);
    }

    // Check for enemy proximity (similar to game.js)
    checkEnemyProximity();

    // Update camera
    updateCamera();
  }

  function updateCamera() {
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    const zoom = camera.zoom || 1.0;
    
    camera.x = Math.round(playerCenterX - (canvas.width / zoom) / 2);
    camera.y = Math.round(playerCenterY - (canvas.height / zoom) / 2);
  }

  // Draw player - copied from game.js
  // ... (rest of the code remains the same)

  // Save/Load Game Slots System for Map3
  function saveGameToSlot(slot) {
    if (!player || !gameState || !playerProfile) {
      console.error('❌ Cannot save game - game not initialized');
      return false;
    }

    try {
      const saveData = {
        player: {
          x: player.x,
          y: player.y,
          direction: gameState.playerDirection || 'right',
          animation: gameState.currentAnimation || 'idle'
        },
        playerProfile: {
          playerName: playerProfile.playerName,
          inGameName: playerProfile.inGameName,
          pixelCoins: playerProfile.pixelCoins,
          experience: playerProfile.experience,
          level: playerProfile.level,
          badges: [...playerProfile.badges],
          gameStats: {...playerProfile.gameStats}
        },
        gameState: {
          collectedRewards: [...gameState.collectedRewards],
          activeQuests: [...gameState.activeQuests],
          completedQuests: [...gameState.completedQuests],
          interactedNPCs: [...gameState.interactedNPCs],
          questProgress: {...gameState.questProgress}
        },
        timestamp: Date.now()
      };

      localStorage.setItem(`game_map3_save_slot_${slot}`, JSON.stringify(saveData));
      console.log(`💾 Game saved to Map3 slot ${slot} at ${new Date(saveData.timestamp).toLocaleString()}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to save game:', error);
      return false;
    }
  }

  function loadGameFromSlot(slot) {
    try {
      const data = localStorage.getItem(`game_map3_save_slot_${slot}`);
      if (!data) {
        console.log(`ℹ️ No save data found in Map3 slot ${slot}`);
        return false;
      }

      const saveData = JSON.parse(data);
      console.log(`📥 Loading game from Map3 slot ${slot} (saved ${new Date(saveData.timestamp).toLocaleString()})`);

      // Restore player data
      if (saveData.player) {
        if (typeof saveData.player.x === 'number') player.x = saveData.player.x;
        if (typeof saveData.player.y === 'number') player.y = saveData.player.y;
        if (saveData.player.direction) gameState.playerDirection = saveData.player.direction;
        if (saveData.player.animation) gameState.currentAnimation = saveData.player.animation;
      }

      // Restore player profile
      if (saveData.playerProfile) {
        if (saveData.playerProfile.playerName) playerProfile.playerName = saveData.playerProfile.playerName;
        if (saveData.playerProfile.inGameName) playerProfile.inGameName = saveData.playerProfile.inGameName;
        if (typeof saveData.playerProfile.pixelCoins === 'number') playerProfile.pixelCoins = saveData.playerProfile.pixelCoins;
        if (typeof saveData.playerProfile.experience === 'number') playerProfile.experience = saveData.playerProfile.experience;
        if (typeof saveData.playerProfile.level === 'number') playerProfile.level = saveData.playerProfile.level;
        if (Array.isArray(saveData.playerProfile.badges)) playerProfile.badges = saveData.playerProfile.badges;
        if (saveData.playerProfile.gameStats) playerProfile.gameStats = saveData.playerProfile.gameStats;
      }

      // Restore game state
      if (saveData.gameState) {
        if (Array.isArray(saveData.gameState.collectedRewards)) gameState.collectedRewards = new Set(saveData.gameState.collectedRewards);
        if (Array.isArray(saveData.gameState.activeQuests)) gameState.activeQuests = new Set(saveData.gameState.activeQuests);
        if (Array.isArray(saveData.gameState.completedQuests)) gameState.completedQuests = new Set(saveData.gameState.completedQuests);
        if (Array.isArray(saveData.gameState.interactedNPCs)) gameState.interactedNPCs = new Set(saveData.gameState.interactedNPCs);
        if (saveData.gameState.questProgress) gameState.questProgress = saveData.gameState.questProgress;
      }

      console.log(`✅ Game loaded from Map3 slot ${slot}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to load game from Map3 slot ${slot}:`, error);
      return false;
    }
  }

  function getSaveSlotInfo(slot) {
    const data = localStorage.getItem(`game_map3_save_slot_${slot}`);
    if (!data) return null;

    try {
      const saveData = JSON.parse(data);
      return {
        exists: true,
        timestamp: saveData.timestamp,
        level: saveData.playerProfile?.level || 1,
        playerName: saveData.playerProfile?.playerName || 'Unknown'
      };
    } catch (error) {
      return null;
    }
  }

  // Draw player - copied from game.js
  function drawAnimatedPlayer() {
    if (!animationManager) {
      drawFallbackPlayer();
      return;
    }
    
    // ... (rest of the code remains the same)
    const frameData = animationManager.getFrameData();
    if (!frameData) {
      drawFallbackPlayer();
      return;
    }
    
    const { sprite, frameWidth, frameHeight, sourceX, sourceY } = frameData;
    
    // Validate frame data
    if (frameWidth <= 0 || frameHeight <= 0) {
      drawFallbackPlayer();
      return;
    }
    
    // Calculate screen position
    const screenX = Math.round(player.x - camera.x);
    const screenY = Math.round(player.y - camera.y);
    
    // Scale down the sprite to fit the map better
    const scale = 0.3; // 30% of original size
    const drawWidth = frameWidth * scale;
    const drawHeight = frameHeight * scale;
    
    // Center the sprite on the player position
    const offsetX = (player.width - drawWidth) / 2;
    const offsetY = (player.height - drawHeight) / 2;
    
    // Handle direction mirroring
    ctx.save();
    
    try {
      if (gameState.playerDirection === 'left') {
        // Flip horizontally for left movement
        ctx.scale(-1, 1);
        ctx.drawImage(
          sprite,
          sourceX, sourceY, frameWidth, frameHeight,
          -(screenX + offsetX + drawWidth), screenY + offsetY, 
          drawWidth, drawHeight
        );
      } else {
        // Normal drawing for right movement
        ctx.drawImage(
          sprite,
          sourceX, sourceY, frameWidth, frameHeight,
          screenX + offsetX, screenY + offsetY, 
          drawWidth, drawHeight
        );
      }
    } catch (error) {
      console.warn('Error drawing sprite:', error);
      ctx.restore();
      drawFallbackPlayer();
      return;
    }
    
    ctx.restore();
  }

  function drawFallbackPlayer() {
    const screenX = Math.round(player.x - camera.x);
    const screenY = Math.round(player.y - camera.y);
    
    // Draw main body
    const bodyColor = gameState.currentAnimation === 'walk' ? '#00ff00' : '#00cc00';
    const borderColor = '#004400';
    
    // Draw border
    ctx.fillStyle = borderColor;
    ctx.fillRect(screenX - 2, screenY - 2, player.width + 4, player.height + 4);
    
    // Draw main body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(screenX, screenY, player.width, player.height);
    
    // Add animated pulse effect when walking
    if (gameState.currentAnimation === 'walk') {
      const pulse = Math.sin(Date.now() / 200) * 0.1 + 0.9;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#88ff88';
      ctx.fillRect(screenX + 4, screenY + 4, player.width - 8, player.height - 8);
      ctx.globalAlpha = 1;
    }
  }

  // Collision debug overlay
  // Color coding:
  // - 🟢 Green: Normal collision layers (walls, etc.) with collision enabled
  // - 🔴 Red with X: Normal collision layers with collision disabled
  // - 🟣 Purple: Non-collision layers (floor2, stairs) with collision enabled (toggled on)
  // - 🔵 Blue: Non-collision layers (floor2, stairs) with collision disabled (default state)
  // - ❌ No display: Floor layer (completely hidden from debug and collision)
  // - 🏷️ Labels: Show layer names and ON/OFF status
  function drawCollisionDebugOverlay() {
    const mapData = MapRenderer.getMapData();
    if (!mapData || !mapData.layers) return;
    
    const tileW = mapData.tilewidth || 16;
    const tileH = mapData.tileheight || 16;

    // Calculate visible tile range for culling
    const startTileX = Math.floor(camera.x / tileW) - 1;
    const startTileY = Math.floor(camera.y / tileH) - 1;
    const endTileX = Math.ceil((camera.x + canvas.width) / tileW) + 1;
    const endTileY = Math.ceil((camera.y + canvas.height) / tileH) + 1;
    
    for (const layer of mapData.layers) {
      if (layer.type !== 'tilelayer') continue;

      const layerName = layer.name.toLowerCase();

      // Skip floor layer completely (don't show in debug mode)
      if (layerName === 'floor') continue;

      // Check if this layer normally has collision
      const normallyHasCollision = !['floor', 'floor2', 'floor3', 'ground', 'background', 'stairs', 'people'].includes(layerName);

      // Show all layers that have tiles or are toggleable (except floor)
      let shouldShowLayer = false;
      let hasTiles = false;

      MapRenderer.forEachTileInLayer(layer, (tileId, tx, ty) => {
        if (tileId && tx >= startTileX && tx <= endTileX && ty >= startTileY && ty <= endTileY) {
          hasTiles = true;
        }
      });

      if (hasTiles || normallyHasCollision) {
        shouldShowLayer = true;
      }

      if (!shouldShowLayer) continue;

      MapRenderer.forEachTileInLayer(layer, (tileId, tx, ty) => {
        if (!tileId) return;
        if (tx < startTileX || tx > endTileX || ty < startTileY || ty > endTileY) return;

        const wx = tx * tileW;
        const wy = ty * tileH;
        const screenX = Math.round(wx - camera.x);
        const screenY = Math.round(wy - camera.y);

        // Check collision override status
        const tileKey = `${tx},${ty},${layer.name}`;
        const hasOverride = collisionOverrides.has(tileKey);

        // Determine collision state
        let collisionEnabled;
        if (hasOverride) {
          collisionEnabled = collisionOverrides.get(tileKey);
        } else {
          // Default state based on layer type
          collisionEnabled = normallyHasCollision;
        }

        // Draw collision visualization
        if (normallyHasCollision) {
          // Normal collision layers (walls, etc.)
          if (!collisionEnabled) {
            // Draw red overlay for disabled collision tiles
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(screenX, screenY, tileW, tileH);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX, screenY, tileW, tileH);

            // Draw X to indicate disabled
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenX + 2, screenY + 2);
            ctx.lineTo(screenX + tileW - 2, screenY + tileH - 2);
            ctx.moveTo(screenX + tileW - 2, screenY + 2);
            ctx.lineTo(screenX + 2, screenY + tileH - 2);
            ctx.stroke();
          } else {
            // Draw green overlay for tiles with collision enabled
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.fillRect(screenX, screenY, tileW, tileH);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX, screenY, tileW, tileH);
          }
        } else {
          // Non-collision layers (floor2, stairs, etc.)
          if (collisionEnabled) {
            // Draw purple overlay for enabled collision on non-collision layers
            ctx.fillStyle = 'rgba(128, 0, 128, 0.3)';
            ctx.fillRect(screenX, screenY, tileW, tileH);
            ctx.strokeStyle = 'rgba(128, 0, 128, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX, screenY, tileW, tileH);

            // Add layer name label for toggled non-collision layers
            ctx.fillStyle = 'rgba(128, 0, 128, 0.9)';
            ctx.font = '8px Arial';
            ctx.fillText(`${layerName.toUpperCase()} ON`, screenX + 2, screenY + 10);
          } else {
            // Draw blue overlay for disabled collision on non-collision layers
            ctx.fillStyle = 'rgba(0, 100, 255, 0.2)';
            ctx.fillRect(screenX, screenY, tileW, tileH);
            ctx.strokeStyle = 'rgba(0, 100, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX, screenY, tileW, tileH);

            // Add layer name label for non-collision layers
            ctx.fillStyle = 'rgba(0, 100, 255, 0.9)';
            ctx.font = '8px Arial';
            ctx.fillText(layerName.toUpperCase(), screenX + 2, screenY + 10);
          }
        }
      });
    }
  }

  // Enemy Quiz System (Higher Difficulty than main game)
  const enemyQuizzes = {
    'enemy1': {
      title: 'JavaScript Fundamentals - Advanced',
      enemyImage: '/images/enemy1.png',
      questions: [
        {
          question: "What is the difference between 'let' and 'const' in terms of scope?",
          options: ["'let' has block scope, 'const' has function scope", "'let' has function scope, 'const' has block scope", "Both have the same scope", "'const' cannot be reassigned, 'let' can be redeclared"],
          correctAnswer: 3
        },
        {
          question: "What happens when you try to access a 'const' variable before it's declared?",
          options: ["ReferenceError", "TypeError", "SyntaxError", "It returns undefined"],
          correctAnswer: 0
        },
        {
          question: "Which of the following is NOT a primitive data type in JavaScript?",
          options: ["string", "number", "boolean", "object"],
          correctAnswer: 3
        },
        {
          question: "What does the 'typeof' operator return for null?",
          options: ["'null'", "'object'", "'undefined'", "'boolean'"],
          correctAnswer: 1
        }
      ]
    },
    'enemy2': {
      title: 'Functions & Scope - Expert Level',
      enemyImage: '/images/enemy2.png',
      questions: [
        {
          question: "What is a closure in JavaScript?",
          options: ["A function that closes the browser", "A function that has access to variables in its outer scope", "A function that cannot be called", "A function with no parameters"],
          correctAnswer: 1
        },
        {
          question: "What happens when a function is called with fewer arguments than parameters?",
          options: ["Error is thrown", "Missing parameters become undefined", "Function doesn't execute", "Parameters are set to null"],
          correctAnswer: 1
        },
        {
          question: "Which statement about arrow functions is FALSE?",
          options: ["They have implicit return", "They don't have their own 'this'", "They can't be used as constructors", "They always need parentheses"],
          correctAnswer: 3
        },
        {
          question: "What is function hoisting in JavaScript?",
          options: ["Moving functions to the top of the file", "Functions can be called before declaration", "Functions are optimized by the engine", "Functions are automatically exported"],
          correctAnswer: 1
        }
      ]
    },
    'enemy3': {
      title: 'Conditionals & Logic - Advanced',
      enemyImage: '/images/enemy3.png',
      questions: [
        {
          question: "What is the difference between '==' and '==='?",
          options: ["No difference", "'===' does not do type coercion", "'==' is faster", "'===' only works with numbers"],
          correctAnswer: 1
        },
        {
          question: "What does 'NaN === NaN' return?",
          options: ["true", "false", "undefined", "Error"],
          correctAnswer: 1
        },
        {
          question: "Which logical operator has the highest precedence?",
          options: ["&&", "||", "!", "All have equal precedence"],
          correctAnswer: 2
        },
        {
          question: "What happens in a switch statement when no case matches and there's no default?",
          options: ["Error is thrown", "Code continues execution", "Switch statement exits", "Nothing happens"],
          correctAnswer: 1
        }
      ]
    },
    'enemy4': {
      title: 'Loops & Iteration - Expert',
      enemyImage: '/images/enemy4.png',
      questions: [
        {
          question: "What is the difference between 'for...in' and 'for...of' loops?",
          options: ["No difference", "'for...in' iterates over keys, 'for...of' iterates over values", "'for...of' is faster", "'for...in' works only with arrays"],
          correctAnswer: 1
        },
        {
          question: "What does the 'continue' statement do in a loop?",
          options: ["Exits the loop", "Skips current iteration and continues with next", "Restarts the loop", "Pauses the loop"],
          correctAnswer: 1
        },
        {
          question: "Which method can be used to execute a function for each array element?",
          options: ["map()", "forEach()", "filter()", "All of the above"],
          correctAnswer: 3
        },
        {
          question: "What happens if you don't increment the counter in a for loop?",
          options: ["Infinite loop", "Loop doesn't execute", "Syntax error", "Loop executes once"],
          correctAnswer: 0
        }
      ]
    },
    'enemy5': {
      title: 'Arrays & Objects - Advanced',
      enemyImage: '/images/enemy5.png',
      questions: [
        {
          question: "What does the 'splice()' method do?",
          options: ["Adds elements to array", "Removes and/or adds elements at specific position", "Finds elements in array", "Sorts array elements"],
          correctAnswer: 1
        },
        {
          question: "What is the difference between 'slice()' and 'splice()'?",
          options: ["No difference", "'slice()' modifies original, 'splice()' creates new array", "'slice()' creates new array, 'splice()' modifies original", "'splice()' only works with strings"],
          correctAnswer: 2
        },
        {
          question: "What does 'Object.keys(obj).length' return?",
          options: ["Number of values in object", "Number of properties in object", "Object type", "Object size in memory"],
          correctAnswer: 1
        },
        {
          question: "Which method creates a shallow copy of an array?",
          options: ["copy()", "duplicate()", "slice()", "clone()"],
          correctAnswer: 2
        }
      ]
    },
    'enemy6': {
      title: 'Advanced Methods - Expert Level',
      enemyImage: '/images/enemy6.png',
      questions: [
        {
          question: "What does the 'reduce()' method do?",
          options: ["Reduces array size", "Executes function on each element and reduces to single value", "Removes duplicate elements", "Sorts array in descending order"],
          correctAnswer: 1
        },
        {
          question: "What is the difference between 'find()' and 'filter()'?",
          options: ["No difference", "'find()' returns first match, 'filter()' returns all matches", "'filter()' returns first match, 'find()' returns all matches", "'find()' only works with objects"],
          correctAnswer: 1
        },
        {
          question: "Which method checks if all array elements pass a test?",
          options: ["some()", "every()", "all()", "check()"],
          correctAnswer: 1
        },
        {
          question: "What does 'Array.from()' do?",
          options: ["Creates array from string", "Creates array from array-like object or iterable", "Creates copy of array", "Converts array to object"],
          correctAnswer: 1
        }
      ]
    }
  };

  // Enemy interaction state
  let currentEnemy = {
    active: false,
    enemyId: null,
    enemyData: null,
    currentQuestion: 0,
    questions: [],
    title: '',
    enemyImage: null,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    hoveredOption: -1,
    userAnswers: []
  };

  // Enemy detection and interaction
  function checkEnemyInteraction(x, y) {
    const mapData = MapRenderer.getMapData();
    if (!mapData || !mapData.layers) return null;

    const tileW = mapData.tilewidth || 16;
    const tileH = mapData.tileheight || 16;

    // Check enemies object layer
    for (const layer of mapData.layers) {
      if (layer.type !== 'objectgroup' || layer.name.toLowerCase() !== 'enemies') continue;

      for (const obj of layer.objects || []) {
        // Check if player is near enemy (within 50 pixels)
        const distance = Math.sqrt(
          Math.pow(x - obj.x - obj.width/2, 2) +
          Math.pow(y - obj.y - obj.height/2, 2)
        );

        if (distance <= 50) {
          return {
            id: obj.name || `enemy${Math.floor(Math.random() * 1000)}`,
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            properties: obj.properties || {}
          };
        }
      }
    }

    return null;
  }

  // Start enemy quiz
  function startEnemyQuiz(enemy) {
    const enemyKey = enemy.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const quizData = enemyQuizzes[enemyKey] || enemyQuizzes['enemy1'];

    if (!quizData) {
      console.log('❌ No quiz data found for enemy:', enemyKey);
      return;
    }

    // Set up current enemy quiz
    currentEnemy = {
      active: true,
      enemyId: enemy.id,
      enemyData: enemy,
      currentQuestion: 0,
      questions: quizData.questions,
      title: quizData.title,
      enemyImage: quizData.enemyImage,
      score: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      hoveredOption: -1,
      userAnswers: []
    };

    console.log(`⚔️ Enemy quiz started: ${quizData.title}`);
    canvas.style.cursor = 'default';

    // Disable player movement during quiz
    keys = {};

    // Show quiz notification
    playerProfile.showRewardNotification(`Enemy Challenge: ${quizData.title}`, '#FF6B6B');
  }

  // Handle enemy quiz answer
  function handleEnemyQuizAnswer(answerIndex) {
    if (!currentEnemy.active || !currentEnemy.questions.length) return;

    const question = currentEnemy.questions[currentEnemy.currentQuestion];
    const isCorrect = answerIndex === question.correctAnswer;

    // Record answer
    currentEnemy.userAnswers.push({
      questionIndex: currentEnemy.currentQuestion,
      selectedAnswer: answerIndex,
      correctAnswer: question.correctAnswer,
      isCorrect: isCorrect
    });

    if (isCorrect) {
      currentEnemy.correctAnswers++;
      currentEnemy.score += 10;

      // Show positive feedback
      playerProfile.showFloatingText('Correct! +10 XP', player.x + player.width/2, player.y - 20, '#00FF00');

      // Award XP immediately for correct answers
      playerProfile.awardExperience(5, `Enemy quiz correct answer`);

    } else {
      currentEnemy.wrongAnswers++;

      // Show negative feedback
      playerProfile.showFloatingText('Incorrect', player.x + player.width/2, player.y - 20, '#FF6B6B');
    }

    // Move to next question or complete quiz
    currentEnemy.currentQuestion++;

    if (currentEnemy.currentQuestion >= currentEnemy.questions.length) {
      // Quiz completed
      completeEnemyQuiz();
    }
  }

  // Complete enemy quiz
  function completeEnemyQuiz() {
    const totalQuestions = currentEnemy.questions.length;
    const correctPercentage = (currentEnemy.correctAnswers / totalQuestions) * 100;
    const xpReward = Math.floor(currentEnemy.score * 1.5); // Bonus XP multiplier
    const goldReward = currentEnemy.correctAnswers * 15; // Gold per correct answer

    let resultMessage = '';
    let resultColor = '#FF6B6B';

    if (correctPercentage >= 80) {
      resultMessage = `🎉 Excellent! ${correctPercentage.toFixed(0)}% correct!`;
      resultColor = '#00FF00';
      playerProfile.awardBadge('enemy_master', 'Defeated enemy with 80%+ quiz score');
    } else if (correctPercentage >= 60) {
      resultMessage = `👍 Good job! ${correctPercentage.toFixed(0)}% correct!`;
      resultColor = '#FFD700';
    } else if (correctPercentage >= 40) {
      resultMessage = `😐 Not bad! ${correctPercentage.toFixed(0)}% correct.`;
      resultColor = '#FF6B6B';
    } else {
      resultMessage = `💪 Keep practicing! ${correctPercentage.toFixed(0)}% correct.`;
      resultColor = '#FF4444';
    }

    // Award final rewards
    playerProfile.awardExperience(xpReward, `Completed enemy quiz: ${currentEnemy.title}`);
    playerProfile.awardPixelCoins(goldReward, `Enemy quiz rewards`);

    // Mark enemy as defeated
    gameState.completedEnemies.add(currentEnemy.enemyId);

    // Show completion message
    setTimeout(() => {
      playerProfile.showRewardNotification(resultMessage, resultColor);
      playerProfile.showRewardNotification(`Earned ${xpReward} XP and ${goldReward} Gold!`, '#FFD700');

      // Play quest completion sound
      AudioManager.playQuestSound();

      // Show defeat dialogue after a short delay
      setTimeout(() => {
        showEnemyDefeatDialogue(currentEnemy.enemyId);
      }, 1500);
    }, 500);

    console.log(`✅ Enemy quiz completed: ${currentEnemy.title}`);
    console.log(`📊 Score: ${currentEnemy.correctAnswers}/${totalQuestions} (${correctPercentage.toFixed(1)}%)`);
    console.log(`🎁 Rewards: ${xpReward} XP, ${goldReward} Gold`);

    // Reset enemy state
    currentEnemy.active = false;
    canvas.style.cursor = 'default';

    // Re-enable player movement
    // Note: keys object needs to be reset or player movement will be disabled
  }

  // Show enemy defeat dialogue (after quiz completion)
  function showEnemyDefeatDialogue(enemyId) {
    const enemyKey = enemyId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dialogue = enemyDialogues[enemyKey] || enemyDialogues['enemy1'];

    // Create defeat dialogue box
    const dialogueBox = document.createElement('div');
    dialogueBox.id = 'enemy-defeat-dialogue';
    dialogueBox.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      border: 3px solid #27ae60;
      max-width: 600px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    `;

    dialogueBox.innerHTML = `
      <div style="margin-bottom: 15px; color: #27ae60; font-weight: bold; font-size: 18px;">
        ✅ ${enemyId.toUpperCase()} DEFEATED!
      </div>
      <div style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        ${dialogue.defeat}<br><br>
        Well fought! You have proven your worth as a JavaScript master.
      </div>
      <div style="text-align: center;">
        <button id="closeDefeatDialogueBtn" style="background: #27ae60; color: white; border: none;
          padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer;
          font-weight: bold;">
          Continue Adventure
        </button>
      </div>
    `;

    document.body.appendChild(dialogueBox);

    // Handle close button
    const closeBtn = document.getElementById('closeDefeatDialogueBtn');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(dialogueBox);
    });

    // Handle ESC key to close dialogue
    const handleEscape = (e) => {
      if (e.key.toLowerCase() === 'escape') {
        document.body.removeChild(dialogueBox);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Auto-close after 5 seconds
    setTimeout(() => {
      if (document.body.contains(dialogueBox)) {
        document.body.removeChild(dialogueBox);
        document.removeEventListener('keydown', handleEscape);
      }
    }, 5000);
  }

  // Draw enemy quiz UI
  function drawEnemyQuiz() {
    if (!currentEnemy.active) return;

    const question = currentEnemy.questions[currentEnemy.currentQuestion];
    if (!question) return;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Quiz container
    const containerWidth = 700;
    const containerHeight = 400;
    const containerX = canvas.width / 2 - containerWidth / 2;
    const containerY = canvas.height / 2 - containerHeight / 2;

    // Main container
    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
    ctx.fillRect(containerX, containerY, containerWidth, containerHeight);

    // Border
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 3;
    ctx.strokeRect(containerX, containerY, containerWidth, containerHeight);

    // Title
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(currentEnemy.title, canvas.width / 2, containerY + 40);

    // Progress
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.fillText(`Question ${currentEnemy.currentQuestion + 1} of ${currentEnemy.questions.length}`, canvas.width / 2, containerY + 70);

    // Score
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`Score: ${currentEnemy.score} | Correct: ${currentEnemy.correctAnswers} | Wrong: ${currentEnemy.wrongAnswers}`, canvas.width / 2, containerY + 95);

    // Question
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    const questionY = containerY + 130;
    const maxQuestionWidth = containerWidth - 40;
    const words = question.question.split(' ');
    let line = '';
    let lineY = questionY;

    for (const word of words) {
      const testLine = line + word + ' ';
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth > maxQuestionWidth && line !== '') {
        ctx.fillText(line, containerX + 20, lineY);
        line = word + ' ';
        lineY += 30;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, containerX + 20, lineY);

    // Options
    const optionY = lineY + 50;
    const optionHeight = 40;
    const optionSpacing = 50;

    for (let i = 0; i < question.options.length; i++) {
      const optionX = containerX + 30;
      const optionCurrentY = optionY + (i * optionSpacing);

      // Option background
      if (currentEnemy.hoveredOption === i) {
        ctx.fillStyle = 'rgba(255, 107, 107, 0.3)';
        ctx.fillRect(optionX - 10, optionCurrentY - 25, containerWidth - 60, optionHeight);
      }

      // Option border
      ctx.strokeStyle = currentEnemy.hoveredOption === i ? '#FF6B6B' : '#666666';
      ctx.lineWidth = 2;
      ctx.strokeRect(optionX - 10, optionCurrentY - 25, containerWidth - 60, optionHeight);

      // Option text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px Arial';
      ctx.fillText(`${String.fromCharCode(65 + i)}. ${question.options[i]}`, optionX, optionCurrentY);
    }

    // Instructions
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Click an option or press A/B/C/D keys to answer • ESC to quit', canvas.width / 2, containerY + containerHeight - 30);

    // Reset text alignment
    ctx.textAlign = 'left';
  }

  // Check for enemy interactions (similar to game.js quest/NPC system)
  function checkEnemyProximity() {
    if (!player) return;

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;

    const enemy = checkEnemyInteraction(playerCenterX, playerCenterY);
    if (enemy) {
      showEnemyPrompt(enemy);
    } else {
      hideEnemyPrompt();
    }
  }

  // Show enemy interaction prompt (similar to game.js)
  function showEnemyPrompt(enemy) {
    if (gameState.currentEnemy === enemy.id) return; // Already showing

    gameState.currentEnemy = enemy.id;

    // Create or update enemy prompt
    let prompt = document.getElementById('enemy-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'enemy-prompt';
      prompt.style.cssText = `
        position: fixed;
        bottom: 140px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 107, 107, 0.9);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 1000;
        pointer-events: none;
        border: 2px solid #FF6B6B;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      `;
      document.body.appendChild(prompt);
    }

    // Check if enemy quiz already completed
    const enemyKey = enemy.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const quizData = enemyQuizzes[enemyKey] || enemyQuizzes['enemy1'];
    const isCompleted = gameState.completedEnemies?.has(enemy.id) || false;

    if (isCompleted) {
      prompt.innerHTML = `<span style="background: #27ae60; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">✓</span> Enemy defeated`;
      prompt.style.background = 'rgba(39, 174, 96, 0.9)';
    } else {
      prompt.innerHTML = `<span style="background: #FF6B6B; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">E</span> Challenge ${quizData?.title || 'Enemy'}`;
      prompt.style.background = 'rgba(255, 107, 107, 0.9)';
    }

    prompt.style.display = 'block';
  }

  // Hide enemy prompt
  function hideEnemyPrompt() {
    gameState.currentEnemy = null;
    const prompt = document.getElementById('enemy-prompt');
    if (prompt) {
      prompt.style.display = 'none';
    }
  }

  // Enemy dialogue data (small talk before quiz)
  const enemyDialogues = {
    'enemy1': {
      greeting: "Hey there! Think you're smart enough to take me on?",
      challenge: "Let's see if you can handle these JavaScript questions!",
      defeat: "Impressive! You really know your stuff."
    },
    'enemy2': {
      greeting: "Well, well, well... Another challenger approaches.",
      challenge: "Functions and scope are my specialty. Can you keep up?",
      defeat: "Not bad at all! You've earned my respect."
    },
    'enemy3': {
      greeting: "Ah, fresh meat! Ready to test your logical thinking?",
      challenge: "Conditionals and logic puzzles await. Show me what you've got!",
      defeat: "Wow! Your logic is sharper than I expected."
    },
    'enemy4': {
      greeting: "Greetings, programmer! Care to match wits with me?",
      challenge: "Loops and iteration are my domain. Let's begin!",
      defeat: "Excellent work! You truly understand iteration."
    },
    'enemy5': {
      greeting: "So you've found me... Ready for an array of challenges?",
      challenge: "Arrays and objects hold many secrets. Can you unlock them?",
      defeat: "Remarkable! You have a deep understanding of data structures."
    },
    'enemy6': {
      greeting: "Ah, a worthy opponent! Advanced methods are my weapon.",
      challenge: "Reduce, filter, find... These are the tools of masters!",
      defeat: "Outstanding! You are truly a JavaScript master."
    }
  };

  // Handle E key for enemy interaction (similar to game.js)
  function handleEKey() {
    if (gameState.showingDialogue || gameState.showSettings || currentEnemy.active) {
      return;
    }

    if (gameState.currentEnemy) {
      handleEnemyStart();
    }
  }

  // Handle enemy interaction start
  function handleEnemyStart() {
    if (!gameState.currentEnemy) return;

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;

    const enemy = checkEnemyInteraction(playerCenterX, playerCenterY);
    if (enemy) {
      console.log(`⚔️ Enemy interaction started: ${enemy.id}`);
      showEnemyDialogue(enemy);
      hideEnemyPrompt(); // Hide prompt after interaction
    }
  }

  // Show enemy dialogue (small talk before quiz)
  function showEnemyDialogue(enemy) {
    const enemyKey = enemy.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dialogue = enemyDialogues[enemyKey] || enemyDialogues['enemy1'];

    // Create dialogue box
    const dialogueBox = document.createElement('div');
    dialogueBox.id = 'enemy-dialogue-box';
    dialogueBox.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      border: 3px solid #FF6B6B;
      max-width: 600px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    `;

    const playerName = playerProfile.inGameName || 'Adventurer';

    dialogueBox.innerHTML = `
      <div style="margin-bottom: 15px; color: #FF6B6B; font-weight: bold; font-size: 18px;">
        ⚔️ ${enemy.id.toUpperCase()}
      </div>
      <div style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        "${dialogue.greeting}<br><br>
        ${dialogue.challenge}"
      </div>
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button id="startEnemyQuizBtn" style="background: #FF6B6B; color: white; border: none;
          padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer;
          font-weight: bold;">
          ⚔️ Accept Challenge!
        </button>
        <button id="declineEnemyBtn" style="background: #666666; color: white; border: none;
          padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer;
          font-weight: bold;">
          ❌ Not Now
        </button>
      </div>
    `;

    document.body.appendChild(dialogueBox);
    gameState.showingDialogue = true;

    // Handle Accept Challenge button
    const startBtn = document.getElementById('startEnemyQuizBtn');
    startBtn.addEventListener('click', () => {
      document.body.removeChild(dialogueBox);
      gameState.showingDialogue = false;
      startEnemyQuiz(enemy);
    });

    // Handle Decline button
    const declineBtn = document.getElementById('declineEnemyBtn');
    declineBtn.addEventListener('click', () => {
      document.body.removeChild(dialogueBox);
      gameState.showingDialogue = false;
      // Show prompt again
      showEnemyPrompt(enemy);
    });

    // Handle ESC key to close dialogue
    const handleEscape = (e) => {
      if (e.key.toLowerCase() === 'escape') {
        document.body.removeChild(dialogueBox);
        gameState.showingDialogue = false;
        showEnemyPrompt(enemy);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  // Render function
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply camera zoom
    const zoom = camera.zoom || 1.0;
    ctx.save();
    ctx.scale(zoom, zoom);

    // Draw map
    MapRenderer.drawMap(ctx, camera, canvas);

    // Draw player
    drawAnimatedPlayer();

    // Draw collision debug overlay if debug mode is enabled (but not during interactions, and only for admins)
    if (gameState.debugMode && !gameState.showingDialogue && !currentEnemy.active && !gameState.showSettings && isUserAdmin()) {
      drawCollisionDebugOverlay();

      // Draw player hitbox
      const hitboxInset = 12;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        player.x - camera.x + hitboxInset,
        player.y - camera.y + hitboxInset,
        player.width - (hitboxInset * 2),
        player.height - (hitboxInset * 2)
      );
    }

    ctx.restore(); // Restore scale before drawing UI

    // Draw HUD (player info)
    drawHUD();

    // Draw gear icon
    drawGearIcon();

    // Draw settings menu
    drawSettings();

    // Draw enemy quiz if active
    if (currentEnemy.active) {
      drawEnemyQuiz();
    }

    // Draw simple instructions if not showing HUD
    if (!gameState.showHUD) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 350, 80);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.fillText('Press R to return to main map', 20, 30);
      ctx.fillText('Press C or TAB to toggle collision debug', 20, 50);
      ctx.fillText('Press E near enemies to challenge them', 20, 70);
    }

    if (gameState.debugMode && !gameState.showHUD && !gameState.showingDialogue && !currentEnemy.active && !gameState.showSettings && isUserAdmin()) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('DEBUG MODE', canvas.width - 130, 30);
    }
  }

  // Game loop
  function loop(currentTime) {
    update(currentTime);
    render();
    requestAnimationFrame(loop);
  }

  // Input handling
  window.addEventListener('keydown', (e) => {
    // Handle enemy quiz input when active
    if (currentEnemy.active) {
      const question = currentEnemy.questions[currentEnemy.currentQuestion];
      if (question) {
        let answerIndex = -1;

        // Handle letter key answers (A, B, C, D)
        if (e.key.toLowerCase() === 'a') answerIndex = 0;
        else if (e.key.toLowerCase() === 'b') answerIndex = 1;
        else if (e.key.toLowerCase() === 'c') answerIndex = 2;
        else if (e.key.toLowerCase() === 'd') answerIndex = 3;

        if (answerIndex >= 0 && answerIndex < question.options.length) {
          handleEnemyQuizAnswer(answerIndex);
          e.preventDefault();
          return;
        }

        // Handle number key answers (1, 2, 3, 4)
        if (e.key >= '1' && e.key <= '4') {
          answerIndex = parseInt(e.key) - 1;
          if (answerIndex < question.options.length) {
            handleEnemyQuizAnswer(answerIndex);
            e.preventDefault();
            return;
          }
        }

        // Handle ESC to close quiz
        if (e.key.toLowerCase() === 'escape') {
          currentEnemy.active = false;
          canvas.style.cursor = 'default';
          playerProfile.showRewardNotification('Quiz closed', '#e74c3c');
          e.preventDefault();
          return;
        }
      }
      return;
    }

    // Handle E key for enemy interaction (similar to game.js)
    if (e.key.toLowerCase() === 'e') {
      handleEKey();
      e.preventDefault();
      return;
    }

    // Block all keys during dialogue (except ESC to close)
    if (gameState.showingDialogue) {
      if (e.key.toLowerCase() === 'escape') {
        // Close any open dialogue
        const dialogueBox = document.getElementById('enemy-dialogue-box') || document.getElementById('enemy-defeat-dialogue');
        if (dialogueBox) {
          document.body.removeChild(dialogueBox);
          gameState.showingDialogue = false;
        }
        // Show enemy prompt again if we closed the initial dialogue
        if (gameState.currentEnemy) {
          const playerCenterX = player.x + player.width / 2;
          const playerCenterY = player.y + player.height / 2;
          const enemy = checkEnemyInteraction(playerCenterX, playerCenterY);
          if (enemy) {
            showEnemyPrompt(enemy);
          }
        }
        e.preventDefault();
        return;
      }
      // Block all other keys during dialogue
      e.preventDefault();
      return;
    }
    
    // Block all keys during settings (except ESC to close)
    if (gameState.showSettings) {
      if (e.key.toLowerCase() === 'escape') {
        gameState.showSettings = false;
        e.preventDefault();
        return;
      }
      // Block all other keys during settings
      e.preventDefault();
      return;
    }
    
    // Handle ESC key for dialogue and settings
    if (e.key.toLowerCase() === 'escape') {
      e.preventDefault();
      return;
    }
    
    // Set movement keys only if no interaction is active
    keys[e.key.toLowerCase()] = true;
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // P key to toggle HUD
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') {
      // Disable HUD toggling during interactions
      if (gameState.showingDialogue || currentEnemy.active || gameState.showSettings) {
        return;
      }
      
      gameState.showHUD = !gameState.showHUD;
      console.log('HUD toggled:', gameState.showHUD ? 'ON' : 'OFF');
    }
  });

  // Mouse event handling for collision tile toggling, enemy interaction, and settings
  canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check if clicked on top-right gear icon
    const gearX = canvas.width - 60;
    const gearY = 20;
    const gearSize = 40;
    const gearCenterX = gearX + gearSize/2;
    const gearCenterY = gearY + gearSize/2;
    const distance = Math.sqrt(Math.pow(mouseX - gearCenterX, 2) + Math.pow(mouseY - gearCenterY, 2));

    if (distance <= gearSize/2) {
      // Disable settings toggling during interactions
      if (gameState.showingDialogue || currentEnemy.active) {
        return;
      }
      
      gameState.showSettings = !gameState.showSettings;
      gameState.settingsHoverOption = 0; // Reset hover
      console.log('Settings toggled via gear icon:', gameState.showSettings ? 'ON' : 'OFF');
      return;
    }

    // Handle settings menu clicks
    if (gameState.showSettings) {
      const menuWidth = 450; // Updated width
      const menuHeight = 350; // Updated height
      const centerX = canvas.width / 2 - menuWidth / 2;
      const centerY = canvas.height / 2 - menuHeight / 2;
      const optionY = centerY + 70;
      const lineHeight = 25; // Updated line height

      // Check which option was clicked
      if (mouseX >= centerX + 20 && mouseX <= centerX + menuWidth - 20) {
        for (let i = 0; i < 11; i++) { // Now 11 options instead of 7
          const optionTop = optionY + (i * lineHeight) - 18;
          const optionBottom = optionY + (i * lineHeight) + 4;

          if (mouseY >= optionTop && mouseY <= optionBottom) {
            const option = i + 1;

            if (option === 1) { // Save to Slot 1
              console.log('💾 Saving game to slot 1...');
              try {
                await playerProfile.saveToServer();
                console.log('✅ Game saved successfully!');
              } catch (error) {
                console.error('❌ Failed to save game:', error);
              }
            } else if (option === 2) { // Load Slot 1
              console.log('📥 Loading game from slot 1...');
              if (loadGameFromSlot(1)) {
                showNotification('Game loaded from slot 1!', '#00BFFF');
              } else {
                showNotification('No save data in slot 1!', '#FF6B6B');
              }
            } else if (option === 3) { // Save to Slot 2
              console.log('💾 Saving game to slot 2...');
              try {
                await playerProfile.saveToServer();
                console.log('✅ Game saved successfully!');
              } catch (error) {
                console.error('❌ Failed to save game:', error);
              }
            } else if (option === 4) { // Load Slot 2
              console.log('📥 Loading game from slot 2...');
              if (loadGameFromSlot(2)) {
                showNotification('Game loaded from slot 2!', '#00BFFF');
              } else {
                showNotification('No save data in slot 2!', '#FF6B6B');
              }
            } else if (option === 5) { // Save to Slot 3
              console.log('💾 Saving game to slot 3...');
              try {
                await playerProfile.saveToServer();
                console.log('✅ Game saved successfully!');
              } catch (error) {
                console.error('❌ Failed to save game:', error);
              }
            } else if (option === 6) { // Load Slot 3
              console.log('📥 Loading game from slot 3...');
              if (loadGameFromSlot(3)) {
                showNotification('Game loaded from slot 3!', '#00BFFF');
              } else {
                showNotification('No save data in slot 3!', '#FF6B6B');
              }
            } else if (option === 7) { // Exit Game
              console.log('🚪 Exit Game - returning to main map');
              window.location.href = '/';
            }
          }
        }
      }
      return;
    }

    // Handle enemy quiz click
    if (currentEnemy.active) {
      const question = currentEnemy.questions[currentEnemy.currentQuestion];
      if (question) {
        const containerWidth = 700;
        const containerHeight = 400;
        const containerX = canvas.width / 2 - containerWidth / 2;
        const containerY = canvas.height / 2 - containerHeight / 2;

        const optionY = containerY + 180; // Approximate position
        const optionHeight = 40;
        const optionSpacing = 50;

        for (let i = 0; i < question.options.length; i++) {
          const optionCurrentY = optionY + (i * optionSpacing);

          if (mouseX >= containerX + 20 && mouseX <= containerX + containerWidth - 20 &&
              mouseY >= optionCurrentY - 25 && mouseY <= optionCurrentY + optionHeight - 25) {
            handleEnemyQuizAnswer(i);
            return;
          }
        }
      }
    }

  // Handle collision tile toggle in debug mode (ADMIN ONLY)
  if (gameState.debugMode && !gameState.showSettings) {
    // Disable collision toggling during interactions
    if (gameState.showingDialogue || currentEnemy.active) {
      return;
    }
    
    // Check if user is admin
    if (!isUserAdmin()) {
      // Try alternative admin detection methods
      console.log('🔄 Primary admin check failed, trying alternatives...');

      // Check if user has been able to access admin features elsewhere
      const hasCollisionOverrides = collisionOverrides.size > 0;
      const hasGameData = !!window.gameData?.user;
      const userId = window.gameData?.user?.id;

      console.log('🔍 Alternative admin detection:', {
        hasCollisionOverrides,
        hasGameData,
        userId,
        collisionOverridesLoaded: !!localStorage.getItem('collision_overrides_loaded')
      });

      // If user has collision overrides loaded, they might be admin
      if (hasCollisionOverrides) {
        console.log('✅ Admin access granted via collision overrides');
        markAdminAccess(); // Remember this user has admin access
      } else if (userId) {
        // Check if this user has accessed admin features before
        const adminAccessKey = `admin_access_${userId}`;
        const hasAdminAccess = localStorage.getItem(adminAccessKey) === 'true';

        if (hasAdminAccess) {
          console.log('✅ Admin access granted via previous admin features');
        } else {
          console.log('⚠️ Collision toggle is restricted to admin users only');
          console.log('💡 To enable admin features, make sure your user account has admin role or access admin features in the main game first');

          return; // Exit early if not admin
        }
      } else {
        console.log('⚠️ Collision toggle is restricted to admin users only');
        console.log('💡 Please ensure you are logged in with an admin account');
        return; // Exit early if no user data
      }
    }

    console.log('✅ Admin access granted for collision toggle');
    markAdminAccess(); // Remember this user has admin access

    // Convert screen coordinates to world coordinates (account for zoom)
    const zoom = camera.zoom || 1.0;
    const worldX = (mouseX / zoom) + camera.x;
    const worldY = (mouseY / zoom) + camera.y;

    // Get map data
    const mapData = MapRenderer.getMapData();
    if (mapData && mapData.layers) {
      const tileW = mapData.tilewidth || 16;
      const tileH = mapData.tileheight || 16;
      // Check which tile was clicked
      const tileX = Math.floor(worldX / tileW);
      const tileY = Math.floor(worldY / tileH);

      let tileToggled = false;

      // Check all layers (including stairs)
      for (const layer of mapData.layers) {
        if (layer.type !== 'tilelayer') continue;

        // Get tile at position using MapRenderer
        let tileId = null;
        MapRenderer.forEachTileInLayer(layer, (id, tx, ty) => {
          if (tx === tileX && ty === tileY && id) {
            tileId = id;
          }
        });

        if (tileId) {
          const layerName = layer.name.toLowerCase();

          // Allow toggling any layer that has collision capability (except floor)
          const normallyHasCollision = !['floor', 'floor2', 'floor3', 'ground', 'background', 'stairs', 'people'].includes(layerName);

          // Skip floor layer completely (not toggleable)
          if (layerName === 'floor') continue;

          // Create unique key for this tile
          const tileKey = `${tileX},${tileY},${layer.name}`;

          // Check current collision state
          const hasOverride = collisionOverrides.has(tileKey);
          // Default state: collision layers = true, non-collision layers = false
          const defaultState = normallyHasCollision;
          const currentState = hasOverride ? collisionOverrides.get(tileKey) : defaultState;

          // Toggle collision state
          const newState = !currentState;
          collisionOverrides.set(tileKey, newState);

          console.log(`🖱️ Toggled collision at (${tileX}, ${tileY}) on layer '${layer.name}'`);
          console.log(`   Tile ID: ${tileId} | Collision: ${newState ? 'ON ✓' : 'OFF ✗'}`);
          console.log(`   Layer type: ${normallyHasCollision ? 'Collision' : 'Non-collision'}`);
          console.log(`   💾 Collision override will be saved globally for all users`);

          // Auto-save collision overrides globally to database
          saveCollisionOverridesGlobally().catch(err => {
            console.error('❌ Failed to auto-save collision override:', err);
          });

          tileToggled = true;
          break;
        }
      }

      // If a collision tile was clicked, don't process other click handlers
      if (tileToggled) {
        return;
      }
    }
  }
});

  // Mouse move handling for settings hover, gear icon, and enemy quiz
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Gear icon hover detection
    const gearX = canvas.width - 60;
    const gearY = 20;
    const gearSize = 40;
    const gearCenterX = gearX + gearSize/2;
    const gearCenterY = gearY + gearSize/2;
    const distance = Math.sqrt(Math.pow(mouseX - gearCenterX, 2) + Math.pow(mouseY - gearCenterY, 2));

    gameState.gearHovered = distance <= gearSize/2;

    // Enemy quiz option hover detection
    if (currentEnemy.active) {
      const question = currentEnemy.questions[currentEnemy.currentQuestion];
      if (question) {
        const containerWidth = 700;
        const containerHeight = 400;
        const containerX = canvas.width / 2 - containerWidth / 2;
        const containerY = canvas.height / 2 - containerHeight / 2;

        const optionY = containerY + 180; // Approximate position
        const optionHeight = 40;
        const optionSpacing = 50;

        currentEnemy.hoveredOption = -1;

        for (let i = 0; i < question.options.length; i++) {
          const optionCurrentY = optionY + (i * optionSpacing);

          if (mouseX >= containerX + 20 && mouseX <= containerX + containerWidth - 20 &&
              mouseY >= optionCurrentY - 25 && mouseY <= optionCurrentY + optionHeight - 25) {
            currentEnemy.hoveredOption = i;
            canvas.style.cursor = 'pointer';
            return;
          }
        }
      }
      canvas.style.cursor = 'default';
      return;
    }

    // Settings hover detection
    if (gameState.showSettings) {
      const menuWidth = 500; // Updated width to match drawSettings
      const menuHeight = 450; // Updated height to match drawSettings
      const centerX = canvas.width / 2 - menuWidth / 2;
      const centerY = canvas.height / 2 - menuHeight / 2;
      const optionY = centerY + 70;
      const lineHeight = 22; // Updated line height to match drawSettings

      gameState.settingsHoverOption = 0; // Reset hover

      // Check which option is being hovered
      if (mouseX >= centerX + 20 && mouseX <= centerX + menuWidth - 20) {
        for (let i = 0; i < 11; i++) { // Now 11 options instead of 7
          const optionTop = optionY + (i * lineHeight) - 18;
          const optionBottom = optionY + (i * lineHeight) + 4;

          if (mouseY >= optionTop && mouseY <= optionBottom) {
            gameState.settingsHoverOption = i + 1;
            canvas.style.cursor = 'pointer';
            return;
          }
        }
      }
      canvas.style.cursor = 'default';
    } else if (gameState.gearHovered) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  });

  // Debug key handling (same pattern as game.js)
  window.addEventListener('keydown', e => {
    if (e.key==='c' || e.key==='C') {
      // Disable debug toggling during interactions
      if (gameState.showingDialogue || currentEnemy.active || gameState.showSettings) {
        return;
      }
      
      // Restrict debug mode to admin users only
      if (!isUserAdmin()) {
        console.log('⚠️ Debug mode is restricted to admin users only');
        return;
      }
      
      // Use the new toggleDebugMode if available, otherwise fallback to old method
      if (typeof window !== 'undefined' && window.toggleDebugMode && typeof window.DebugLogger !== 'undefined') {
        // New unified toggle - handles both debug mode and collision debug
        const newState = window.toggleDebugMode(debugManager || collisionDebugSystem, 'game_map3.js-C-key');
      } else {
        // Fallback to old method if debug-logger.js not loaded
        gameState.debugMode = !gameState.debugMode;
        gameState.collisionDebug = gameState.debugMode; // Sync collisionDebug with debugMode
        console.log('Debug mode:', gameState.debugMode ? 'ON' : 'OFF');
        console.log('Collision debug:', gameState.collisionDebug ? 'ON' : 'OFF');

        // Toggle collision debug visualization
        if (debugManager) {
          debugManager.toggleCollisionDebug();
        } else if (collisionDebugSystem) {
          collisionDebugSystem.toggle();
        }
      }
    }

    // Add TAB key handling for collision debug (consistent with game.js)
    if (e.key === 'Tab') {
      // Disable debug toggling during interactions
      if (gameState.showingDialogue || currentEnemy.active || gameState.showSettings) {
        e.preventDefault();
        return;
      }
      
      // Restrict debug mode to admin users only
      if (!isUserAdmin()) {
        e.preventDefault();
        console.log('⚠️ Debug mode is restricted to admin users only');
        return;
      }
      
      e.preventDefault(); // Prevent tab navigation

      // Use the new toggleDebugMode if available, otherwise fallback to old method
      if (typeof window !== 'undefined' && window.toggleDebugMode && typeof window.DebugLogger !== 'undefined') {
        // New unified toggle - handles both debug mode and collision debug
        const newState = window.toggleDebugMode(debugManager || collisionDebugSystem, 'game_map3.js-TAB-key');
      } else {
        // Fallback to old method if debug-logger.js not loaded
        gameState.debugMode = !gameState.debugMode;
        gameState.collisionDebug = gameState.debugMode; // Sync collisionDebug with debugMode
        console.log('Debug mode (TAB):', gameState.debugMode ? 'ON' : 'OFF');
        console.log('Collision debug (TAB):', gameState.collisionDebug ? 'ON' : 'OFF');

        // Toggle collision debug visualization using the new DebugManager
        if (debugManager) {
          debugManager.toggleCollisionDebug();
        } else if (collisionDebugSystem) {
          // Fallback to old system if DebugManager not available
          collisionDebugSystem.toggle();
        }
      }
    }
  });

  // Draw HUD (matching game.js implementation)
  function drawHUD() {
    // Only draw HUD if toggled on
    if (!gameState.showHUD) return;

    // HUD dimensions
    const hudX = 10;
    const hudY = 10;
    const hudWidth = 260;
    const hudHeight = 120;

    // Draw main background with gradient effect
    const gradient = ctx.createLinearGradient(hudX, hudY, hudX, hudY + hudHeight);
    gradient.addColorStop(0, 'rgba(25, 25, 35, 0.95)');
    gradient.addColorStop(1, 'rgba(15, 15, 25, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(hudX, hudY, hudWidth, hudHeight);

    // Draw elegant border
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 2;
    ctx.strokeRect(hudX, hudY, hudWidth, hudHeight);

    // Character Avatar Icon (left side)
    const avatarSize = 70;
    const avatarX = hudX + 10;
    const avatarY = hudY + 10;

    if (characterAvatarImage && characterAvatarImage.complete) {
      // Draw avatar with border
      ctx.strokeStyle = '#4A90E2';
      ctx.lineWidth = 2;
      ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);

      // Draw avatar image
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(characterAvatarImage, avatarX + 2, avatarY + 2, avatarSize - 4, avatarSize - 4);
      ctx.imageSmoothingEnabled = false;
    }

    // Player name and class (top right of avatar)
    const infoX = avatarX + avatarSize + 15;
    const displayName = playerProfile.inGameName || playerProfile.playerName;
    const characterClass = window.gameData?.user?.characterType || 'Adventurer';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(displayName, infoX, hudY + 20);

    ctx.fillStyle = '#AAAAAA';
    ctx.font = '11px Arial';
    ctx.fillText(characterClass.charAt(0).toUpperCase() + characterClass.slice(1), infoX, hudY + 35);

    // Level
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`LV`, infoX, hudY + 55);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${playerProfile.level}`, infoX + 25, hudY + 55);

    // XP Progress Bar
    const currentXP = playerProfile.experience - playerProfile.getXPForCurrentLevel();
    const neededXP = playerProfile.getXPForNextLevel() - playerProfile.getXPForCurrentLevel();
    const progress = playerProfile.getXPProgress();

    const barX = infoX;
    const barY = hudY + 65;
    const barWidth = 140;
    const barHeight = 10;

    // XP label
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '10px Arial';
    ctx.fillText('EXP', barX, barY);

    // XP Bar background
    ctx.fillStyle = 'rgba(50, 50, 60, 0.8)';
    ctx.fillRect(barX + 30, barY - 8, barWidth, barHeight);

    // XP Bar progress
    const xpGradient = ctx.createLinearGradient(barX + 30, barY - 8, barX + 30 + barWidth, barY - 8);
    xpGradient.addColorStop(0, '#00BFFF');
    xpGradient.addColorStop(1, '#0080FF');
    ctx.fillStyle = xpGradient;
    ctx.fillRect(barX + 30, barY - 8, barWidth * progress, barHeight);

    // XP text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '9px Arial';
    ctx.fillText(`${currentXP} / ${neededXP}`, barX + 35, barY);

    // Stats section (below avatar)
    const statsY = avatarY + avatarSize + 10;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px Arial';

    ctx.fillText('📋 Quests:', hudX + 15, statsY);
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(`${gameState.completedQuests.size}`, hudX + 85, statsY);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('🏆 Badges:', hudX + 120, statsY);
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText(`${playerProfile.badges.length}`, hudX + 190, statsY);

    // Gold at bottom
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`💰 ${playerProfile.pixelCoins} Gold`, hudX + 15, statsY + 20);

    // Toggle hint (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px Arial';
    ctx.fillText('Press P', hudX + hudWidth - 45, hudY + 12);

    // Reset text alignment
    ctx.textAlign = 'left';
  }

  function drawGearIcon() {
    // Top-right gear icon
    const gearX = canvas.width - 60;
    const gearY = 20;
    const gearSize = 40;

    // Gear background circle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(gearX + gearSize/2, gearY + gearSize/2, gearSize/2, 0, Math.PI * 2);
    ctx.fill();

    // Gear border
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gearX + gearSize/2, gearY + gearSize/2, gearSize/2, 0, Math.PI * 2);
    ctx.stroke();

    // Gear icon
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚙', gearX + gearSize/2, gearY + gearSize/2 + 8);

    // Hover effect
    if (gameState.gearHovered) {
      ctx.fillStyle = 'rgba(74, 144, 226, 0.3)';
      ctx.beginPath();
      ctx.arc(gearX + gearSize/2, gearY + gearSize/2, gearSize/2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Reset text alignment
    ctx.textAlign = 'left';
  }

  function drawSettings() {
    // Only draw settings if toggled on
    if (!gameState.showSettings) return;

    // Draw overlay background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate center position
    const menuWidth = 500; // Wider for audio controls
    const menuHeight = 450; // Taller for more options
    const centerX = canvas.width / 2 - menuWidth / 2;
    const centerY = canvas.height / 2 - menuHeight / 2;

    // Draw settings menu background
    ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
    ctx.fillRect(centerX, centerY, menuWidth, menuHeight);

    // Draw border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.strokeRect(centerX, centerY, menuWidth, menuHeight);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Settings', centerX + menuWidth/2, centerY + 35);

    // Menu options
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';

    const optionY = centerY + 70;
    const lineHeight = 22; // Tighter spacing

    // Create options array with audio controls
    const options = [];
    
    // Save/Load options (first 6)
    for (let slot = 1; slot <= 3; slot++) {
      const slotInfo = getSaveSlotInfo(slot);
      let saveText, loadText;
      
      if (slotInfo && slotInfo.exists) {
        const date = new Date(slotInfo.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const statusText = `LV${slotInfo.level} ${slotInfo.playerName} - ${dateStr} ${timeStr}`;
        
        saveText = { text: `💾 Save to Slot ${slot} (Overwrite)`, color: '#FFA500' };
        loadText = { text: `📂 Load Slot ${slot}: ${statusText}`, color: '#00BFFF' };
      } else {
        saveText = { text: `💾 Save to Slot ${slot}`, color: '#00FF00' };
        loadText = { text: `📂 Load Slot ${slot}: [EMPTY]`, color: '#666666' };
      }
      
      options.push(saveText, loadText);
    }
    
    // Audio options (7-10)
    const masterMuteIcon = AudioManager.masterMuted ? '🔇' : '🔊';
    options.push({ text: `${masterMuteIcon} Master Mute: ${AudioManager.masterMuted ? 'ON' : 'OFF'}`, color: AudioManager.masterMuted ? '#FF6B6B' : '#00FF00' });
    
    const bgMuteIcon = AudioManager.backgroundMuted ? '🔇' : '🔊';
    const bgVolPercent = Math.round(AudioManager.backgroundVolume * 100);
    options.push({ text: `${bgMuteIcon} Background Music: ${bgVolPercent}% ${AudioManager.backgroundMuted ? '(Muted)' : ''}`, color: '#FFD700' });
    
    const gameMuteIcon = AudioManager.gameMuted ? '🔇' : '🔊';
    const gameVolPercent = Math.round(AudioManager.gameVolume * 100);
    options.push({ text: `${gameMuteIcon} Game Music: ${gameVolPercent}% ${AudioManager.gameMuted ? '(Muted)' : ''}`, color: '#FFD700' });
    
    const soundMuteIcon = AudioManager.soundMuted ? '🔇' : '🔊';
    const soundVolPercent = Math.round(AudioManager.soundVolume * 100);
    options.push({ text: `${soundMuteIcon} Sound Effects: ${soundVolPercent}% ${AudioManager.soundMuted ? '(Muted)' : ''}`, color: '#FFD700' });
    
    // Add exit option
    options.push({ text: '🚪 Exit Game', color: '#FF4444' });

    // Draw each option with hover effect
    for (let i = 0; i < options.length; i++) {
      const isHovered = gameState.settingsHoverOption === i + 1;
      const yPos = optionY + (i * lineHeight);

      // Draw hover background
      if (isHovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(centerX + 10, yPos - 18, menuWidth - 20, 22);
      }

      // Draw option text
      ctx.fillStyle = isHovered ? '#FFFFFF' : options[i].color;
      ctx.fillText(options[i].text, centerX + 20, yPos);

      // Draw arrow for hovered option
      if (isHovered) {
        ctx.fillStyle = '#FFD700';
        ctx.fillText('→', centerX + menuWidth - 30, yPos);
      }
    }

    // Instructions
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Click an option or press ESC to close', centerX + menuWidth/2, centerY + menuHeight - 20);
    // Reset text alignment
    ctx.textAlign = 'left';
  }

  function handleSettingsOption(option) {
    switch(option) {
        case 1: // Save to Slot 1
            saveGameToSlot(1);
            showNotification('Game saved to slot 1!', '#00FF00');
            break;
        case 2: // Load Slot 1
            if (loadGameFromSlot(1)) {
                showNotification('Game loaded from slot 1!', '#00BFFF');
            } else {
                showNotification('No save data in slot 1!', '#FF6B6B');
            }
            break;
        case 3: // Save to Slot 2
            saveGameToSlot(2);
            showNotification('Game saved to slot 2!', '#00FF00');
            break;
        case 4: // Load Slot 2
            if (loadGameFromSlot(2)) {
                showNotification('Game loaded from slot 2!', '#00BFFF');
            } else {
                showNotification('No save data in slot 2!', '#FF6B6B');
            }
            break;
        case 5: // Save to Slot 3
            saveGameToSlot(3);
            showNotification('Game saved to slot 3!', '#00FF00');
            break;
        case 6: // Load Slot 3
            if (loadGameFromSlot(3)) {
                showNotification('Game loaded from slot 3!', '#00BFFF');
            } else {
                showNotification('No save data in slot 3!', '#FF6B6B');
            }
            break;
        case 7: // Master Mute Toggle
            const masterMuted = AudioManager.toggleMasterMute();
            showNotification(`Master mute ${masterMuted ? 'ON' : 'OFF'}`, masterMuted ? '#FF6B6B' : '#00FF00');
            break;
        case 8: // Background Music Toggle/Mute
            const bgMuted = AudioManager.toggleBackgroundMute();
            showNotification(`Background music ${bgMuted ? 'muted' : 'unmuted'}`, bgMuted ? '#FF6B6B' : '#00FF00');
            break;
        case 9: // Game Music Toggle/Mute
            const gameMuted = AudioManager.toggleGameMute();
            showNotification(`Game music ${gameMuted ? 'muted' : 'unmuted'}`, gameMuted ? '#FF6B6B' : '#00FF00');
            break;
        case 10: // Sound Effects Toggle/Mute
            const soundMuted = AudioManager.toggleSoundMute();
            showNotification(`Sound effects ${soundMuted ? 'muted' : 'unmuted'}`, soundMuted ? '#FF6B6B' : '#00FF00');
            break;
        case 11: // Exit Game
            console.log('🚪 Exit Game - returning to main map');
            window.location.href = '/';
            break;
    }
    gameState.showSettings = false; // Close menu after selection
  }

  function showNotification(text, color = '#FFD700') {
    const notification = document.createElement('div');
    notification.textContent = text;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: ${color};
        padding: 20px 30px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-weight: bold;
        font-size: 18px;
        z-index: 2000;
        pointer-events: none;
        border: 2px solid ${color};
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
  }

  // Profile loading and initialization
  async function loadProfile() {
    try {
      console.log('🎮 Initializing Map3 Game...');

      // Load map
      console.log('📦 Loading map data...');
      await loadMap();

      // Load character sprite
      console.log('🎭 Loading character sprites...');
      animationManager = new AnimationManager();

      // Get character type from server
      try {
        console.log('👤 Fetching player profile for character sprite...');
        console.log('🔍 gameData before profile fetch:', window.gameData);

        // Add timeout and retry logic
        let profileRetries = 0;
        const maxProfileRetries = 3;
        let profile = null;

        while (profileRetries < maxProfileRetries) {
          try {
            console.log(`🔄 Profile fetch attempt ${profileRetries + 1}/${maxProfileRetries}...`);

            // Add timeout to fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch('/api/profile', {
              signal: controller.signal,
              headers: {
                'Cache-Control': 'no-cache'
              }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              profile = await response.json();
              console.log('🔍 Profile data for sprite loading:', profile);
              break; // Success, exit retry loop
            } else if (response.status === 401) {
              console.log('🔐 Not authenticated - using default character');
              break; // Not authenticated, this is OK, use defaults
            } else {
              console.warn('⚠️ Profile API returned status:', response.status);
              if (response.status === 404) {
                console.log('ℹ️ No profile found, using defaults');
                break; // No profile exists yet, this is OK
              }
              throw new Error(`Profile fetch failed with status: ${response.status}`);
            }
          } catch (fetchError) {
            console.error(`❌ Profile fetch attempt ${profileRetries + 1} failed:`, fetchError.message);
            profileRetries++;
            if (profileRetries < maxProfileRetries) {
              console.log(`⏳ Retrying profile fetch in 1 second...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        if (profile) {
          // DON'T update from profile - keep fresh start
          // Just load character sprite
          const characterType = profile.characterType || 'knight';
          console.log('🎨 Loading character sprite:', characterType);
          await animationManager.loadCharacterSprite(characterType);

          // Keep admin role if present
          if (window.gameData && window.gameData.user && profile.role) {
            window.gameData.user.role = profile.role;
          }

          console.log('✅ Fresh game initialized (no profile data loaded):', {
            level: playerProfile.level,
            experience: playerProfile.experience,
            pixelCoins: playerProfile.pixelCoins,
            badges: playerProfile.badges.length
          });

          // Load avatar after profile data is available
          loadCharacterAvatar();

        } else {
          console.warn('⚠️ No profile data available, using defaults');
          await animationManager.loadCharacterSprite('knight');
          loadCharacterAvatar();
        }

      } catch (error) {
        console.warn('⚠️ Could not load character type, using default knight:', error.message);
        await animationManager.loadCharacterSprite('knight');
        loadCharacterAvatar();
      }

      // Hide loading screen
      console.log('🎬 Hiding loading screen...');
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }

      // Start game loop
      console.log('🚀 Starting game loop...');
      requestAnimationFrame(loop);

      console.log('✅ Map3 initialization complete!');
    } catch (error) {
      console.error('❌ Map3 initialization failed:', error);

      // Hide loading screen even on error
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }

      // Try to continue with minimal setup
      try {
        console.log('🔄 Attempting fallback initialization...');
        animationManager = new AnimationManager();
        await animationManager.loadCharacterSprite('knight');
        requestAnimationFrame(loop);
        console.log('✅ Fallback initialization successful');
      } catch (fallbackError) {
        console.error('❌ Fallback initialization also failed:', fallbackError);
      }
    }
  }

  // Start the game
  loadProfile();

})();
