// Tutorial-style game system adapted for canvas rendering
(function(){
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Map rendering is now handled by MapRenderer module (map_render.js)
  
  // Game Music Manager
  const gameMusicManager = {
    audio: null,
    volume: 0.5, // Default volume (0-1)
    isPlaying: false,
    
    init() {
      this.audio = document.getElementById('gameMusic');
      if (this.audio) {
        this.audio.volume = this.volume;
        // Load volume from localStorage
        const savedVolume = localStorage.getItem('codequest_music_volume');
        if (savedVolume !== null) {
          this.volume = parseFloat(savedVolume);
          this.audio.volume = this.volume;
        }
        console.log('🎵 Game music initialized, volume:', this.volume);
      }
    },
    
    play() {
      if (this.audio && !this.isPlaying) {
        this.audio.play().then(() => {
          this.isPlaying = true;
          console.log('🎵 Game music started');
        }).catch(err => {
          console.warn('⚠️ Could not play game music:', err);
        });
      }
    },
    
    pause() {
      if (this.audio && this.isPlaying) {
        this.audio.pause();
        this.isPlaying = false;
        console.log('⏸️ Game music paused');
      }
    },
    
    setVolume(vol) {
      this.volume = Math.max(0, Math.min(1, vol)); // Clamp between 0-1
      if (this.audio) {
        this.audio.volume = this.volume;
      }
      // Save to localStorage
      localStorage.setItem('codequest_music_volume', this.volume.toString());
      console.log('🔊 Music volume set to:', Math.round(this.volume * 100) + '%');
    },
    
    getVolume() {
      return this.volume;
    },
    
    toggleMute() {
      if (this.volume > 0) {
        this.previousVolume = this.volume;
        this.setVolume(0);
      } else {
        this.setVolume(this.previousVolume || 0.5);
      }
    }
  };
  
  // Prologue Video System
  const PROLOGUE_PLAYED_KEY = 'codequest_prologue_played';
  
  function shouldPlayPrologue() {
    // Check if prologue has been played before
    return !localStorage.getItem(PROLOGUE_PLAYED_KEY);
  }
  
  function markPrologueAsPlayed() {
    localStorage.setItem(PROLOGUE_PLAYED_KEY, 'true');
  }
  
  function resetPrologue() {
    localStorage.removeItem(PROLOGUE_PLAYED_KEY);
    console.log('✅ Prologue reset - will play on next new game');
  }
  
  // Expose reset function globally for debugging
  window.resetPrologue = resetPrologue;
  
  function playPrologueVideo(onComplete) {
    const overlay = document.getElementById('prologue-overlay');
    const video = document.getElementById('prologue-video');
    const skipBtn = document.getElementById('skip-prologue-btn');
    const soundBtn = document.getElementById('sound-prologue-btn');
    
    if (!overlay || !video || !skipBtn || !soundBtn) {
      console.warn('⚠️ Prologue elements not found');
      onComplete();
      return;
    }
    
    // Show the overlay
    overlay.style.display = 'flex';
    
    // Function to end prologue
    const endPrologue = () => {
      overlay.style.display = 'none';
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      markPrologueAsPlayed();
      onComplete();
    };
    
    // Sound toggle button handler
    soundBtn.onclick = () => {
      video.muted = !video.muted;
      soundBtn.textContent = video.muted ? '🔇' : '🔊';
      console.log(video.muted ? '🔇 Sound muted' : '🔊 Sound unmuted');
    };
    
    // Skip button handler
    skipBtn.onclick = () => {
      console.log('⏭️ Prologue skipped');
      endPrologue();
    };
    
    // Auto-end when video finishes
    video.onended = () => {
      console.log('✅ Prologue completed');
      endPrologue();
    };
    
    // Handle video errors
    video.onerror = (e) => {
      console.error('❌ Prologue video error:', e);
      endPrologue();
    };
    
    console.log('🎬 Playing prologue video (click sound button to unmute)');
  }
  
  // Character Avatar Image
  let characterAvatarImage = null;
  
  function loadCharacterAvatar() {
    if (window.gameData?.user?.characterType) {
      const characterType = window.gameData.user.characterType.toLowerCase();
      // Use the portrait images like in the profile page
      const portraitPath = `/images/characters/${characterType}.jpg`;
      
      characterAvatarImage = new Image();
      characterAvatarImage.src = portraitPath;
      characterAvatarImage.onload = () => {
        console.log('✅ Character portrait loaded:', portraitPath);
      };
      characterAvatarImage.onerror = () => {
        console.warn('⚠️ Failed to load character portrait:', portraitPath);
        characterAvatarImage = null;
      };
    }
  }
  
  // Global collision override system (Map of "x,y,layer" -> boolean)
  // true = force collision ON, false = force collision OFF, undefined = use map default
  // This needs to be declared early so it's accessible to all functions
  const collisionOverrides = new Map();
  
  // Check if current user is admin
  function isUserAdmin() {
    return window.gameData?.user?.role === 'admin';
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
        throw new Error(`Save failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Collision overrides saved globally:', result.count, 'tiles');
      return true;
    } catch (error) {
      console.error('❌ Failed to save collision overrides globally:', error);
      return false;
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
        throw new Error(`Load failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.overrides) {
        // Clear existing and load from server
        collisionOverrides.clear();
        Object.entries(result.overrides).forEach(([key, value]) => {
          collisionOverrides.set(key, value);
        });
        console.log('✅ Loaded global collision overrides:', collisionOverrides.size, 'tiles');
        return true;
      }
      
      console.log('ℹ️ No global collision overrides found');
      return false;
    } catch (error) {
      console.error('❌ Failed to load collision overrides globally:', error);
      return false;
    }
  }
  
  // Game State Management
  class GameState {
    constructor() {
      this.reset();
    }
    
    reset() {
      this.player = null;
      this.isAttacking = false;
      this.isMoving = false;
      this.currentAnimation = 'idle';
      this.debugMode = false;
      this.collisionDebug = false;
      this.gameReady = false;
      this.assetsLoaded = false;
      this.collectedRewards = new Set(); // Track collected rewards
      this.currentNPC = null; // Currently nearby NPC
      this.currentQuest = null; // Currently nearby quest
      this.showingDialogue = false; // Whether dialogue is open
      this.activeQuests = new Set(); // Track active quests
      this.completedQuests = new Set(); // Track completed quests
      this.questProgress = {}; // Track quest progress (e.g., {286: {lessonComplete: true, quizComplete: false, progress: 50}})
      this.showHUD = true; // Toggle HUD visibility with 'P' - start visible
      this.showSettings = false; // Settings menu visibility
      this.interactedNPCs = new Set(); // Track NPCs that have been talked to
      this.settingsHoverOption = 0; // Currently hovered settings option (0 = none)
      this.playerDirection = 'right'; // Track player facing direction
      this.dialogueAutoCloseTimer = null; // Timer for auto-closing dialogues
      this.gearHovered = false; // Track gear hover state
    }
  }

  // Player Profile System
  class PlayerProfile {
    constructor() {
      this.playerName = 'Unknown Player'; // Default name until player sets it
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
    
    // Start tracking play time
    startPlayTimeTracking() {
      // Update play time every minute
      this.playTimeInterval = setInterval(() => {
        this.gameStats.playTime = (this.gameStats.playTime || 0) + 1; // Increment by 1 minute
        
        // Log every 5 minutes for debugging
        if (this.gameStats.playTime % 5 === 0) {
          console.log(`⏱️ Play time: ${this.gameStats.playTime} minutes (${Math.floor(this.gameStats.playTime / 60)}h ${this.gameStats.playTime % 60}m)`);
        }
      }, 60000); // Run every 60 seconds (1 minute)
    }
    
    // Stop tracking play time
    stopPlayTimeTracking() {
      if (this.playTimeInterval) {
        clearInterval(this.playTimeInterval);
        this.playTimeInterval = null;
      }
    }

    // Load profile from server
    async loadProfile() {
      try {
        if (!window.gameData?.user?.id) {
          console.warn('No user ID available for profile loading');
          return;
        }

        const response = await fetch('/api/profile', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const userData = await response.json();
          this.updateFromServerData(userData);
          console.log('✅ Profile loaded:', this);
        }
      } catch (error) {
        console.error('❌ Failed to load profile:', error);
      }
    }

    // Update profile from server data
    updateFromServerData(userData) {
      this.playerName = userData.playerName || this.playerName;
      this.inGameName = userData.inGameName || this.inGameName; // Load in-game name
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
      
      // Show floating text
      this.showFloatingText(`+${amount} Gold`, player.x + player.width/2, player.y - 10, '#FFD700');
      
      // Check for coin badges
      await this.checkCoinBadges();
      
      // Note: Save happens after quest completion, not on every coin award
    }
    
    // Check and award coin-based badges
    async checkCoinBadges() {
      if (this.pixelCoins >= 100) {
        await this.awardBadge('coin_collector', 'Earned 100 coins');
      }
      if (this.pixelCoins >= 500) {
        await this.awardBadge('wealthy', 'Earned 500 coins');
      }
      if (this.pixelCoins >= 1000) {
        await this.awardBadge('rich', 'Earned 1000 coins');
      }
      if (this.pixelCoins >= 5000) {
        await this.awardBadge('millionaire', 'Earned 5000 coins!');
      }
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
        this.showRewardNotification(`LEVEL UP! Level ${this.level}`, '#00FF00');
        
        // Award level-up badges
        await this.checkLevelBadges();
        
        // Award bonus coins for leveling up
        await this.awardPixelCoins(this.level * 10, `Level ${this.level} bonus`);
      }
      
      console.log(`⭐ Awarded ${amount} experience: ${reason}`);
      this.showFloatingText(`+${amount} XP`, player.x + player.width/2, player.y, '#00BFFF');
      
      // Note: Save happens after quest completion, not on every XP award
    }
    
    // Check and award level-based badges
    async checkLevelBadges() {
      if (this.level === 5) {
        await this.awardBadge('level_5', 'Reached level 5');
      }
      if (this.level === 10) {
        await this.awardBadge('level_10', 'Reached level 10');
      }
      if (this.level === 20) {
        await this.awardBadge('level_20', 'Reached level 20');
      }
      if (this.level === 50) {
        await this.awardBadge('level_50', 'Reached level 50 - Master!');
      }
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
    
    // Get XP progress in current level (0-1)
    getXPProgress() {
      const currentLevelXP = this.getXPForCurrentLevel();
      const nextLevelXP = this.getXPForNextLevel();
      const progressXP = this.experience - currentLevelXP;
      return Math.max(0, Math.min(1, progressXP / (nextLevelXP - currentLevelXP)));
    }

    // Award badge
    async awardBadge(badgeName, reason = 'Achievement unlocked') {
      if (!this.badges.includes(badgeName)) {
        this.badges.push(badgeName);
        console.log(`🏆 Badge earned: ${badgeName}`);
        this.showRewardNotification(`Badge: ${badgeName}`, '#FF6B6B');
        
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
        
        // Reduce logging for performance
        if (Math.random() < 0.01) {
          console.log('📡 Auto-save');
        }
        
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

        // Reduce logging for performance
        if (Math.random() < 0.01) {
          console.log('✅ Auto-saved');
        }
      } catch (error) {
        console.error('❌ Failed to save profile:', error.message);
        // Don't re-throw - let the game continue even if save fails
        // The error will be logged and the calling code can handle it via .catch()
      }
    }

    // Show reward notification
    showRewardNotification(text, color = '#FFD700') {
      const notification = document.createElement('div');
      notification.textContent = text;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: ${color};
        padding: 10px 20px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-weight: bold;
        font-size: 16px;
        z-index: 1000;
        pointer-events: none;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;
      
      document.body.appendChild(notification);
      
      // Animate in
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      // Animate out and remove
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
    }
  }
  
  const gameState = new GameState();
  
  // Initialize debug logger (requires debug-logger.js to be loaded first)
  let debugLogger = null;
  if (typeof window !== 'undefined' && window.initDebugLogger) {
    debugLogger = window.initDebugLogger(gameState, {
      debugFlag: 'debugMode',
      storageKey: 'DEBUG_LOGS'
    });
    console.log('✅ Debug logger initialized for game.js');
  } else {
    console.warn('⚠️ debug-logger.js not loaded - debug logging may not work correctly');
  }
  
  // Quest names mapping
  const questNames = {
    'quest1': 'First Quest',
    'quest2': 'JavaScript History',
    'quest3': 'Variables & Data Types',
    'quest4': 'Functions in JavaScript',
    'quest5': 'Conditionals (if/else)',
    'quest6': 'Loops in JavaScript',
    'quest7': 'Arrays in JavaScript',
    'arraysinjavascript': 'Arrays in JavaScript',
    'firstquest': 'First Quest'
  };
  
  // Helper function to get quest name by ID
  function getQuestNameById(questId) {
    const quest = window.gameMapData?.quests?.find(q => q.id === questId);
    if (quest && quest.name) {
      const questKey = quest.name.toLowerCase().replace(/\s+/g, '');
      return questNames[questKey] || quest.name;
    }
    return `Quest #${questId}`;
  }
  
  // Expose to window for dashboard access
  window.getQuestNameById = getQuestNameById;
  
  // Quest lesson/dialogue system
  const questLessons = {
    'quest2': { // Quest 2 - use string key to match quest name
      title: 'JavaScript History Lesson',
      npcImage: '/images/Q2.jpg',
      parts: [
        "Welcome, {name}! Ready to learn about JavaScript's fascinating history?",
        "JavaScript was created in 1995 by Brendan Eich at Netscape Communications.",
        "It was originally called 'Mocha', then renamed to 'LiveScript', and finally 'JavaScript'.",
        "Despite its name, JavaScript has no relation to Java programming language!",
        "The name was chosen purely for marketing reasons when Java was popular.",
        "JavaScript became the standard for web browsers and is now one of the most popular languages.",
        "Today, JavaScript powers websites, mobile apps, servers, and even desktop applications!",
        "You've completed the JavaScript History lesson, {name}! You can now take the quiz."
      ]
    },
    'quest3': { // Quest 3 - Variables & Data Types
      title: 'Variables & Data Types Lesson',
      npcImage: '/images/Q3.jpg',
      parts: [
        { text: "Welcome back, {name}! Today we'll learn about JavaScript variables and data types." },
        { text: "Variables are containers that store data values. Think of them as labeled boxes!" },
        { text: "In JavaScript, we use 'let', 'const', and 'var' to create variables.", code: "// Three ways to declare variables\nlet age = 25;        // Can be changed\nconst name = 'Alex'; // Cannot be changed\nvar city = 'Tokyo';  // Old way (avoid)" },
        { text: "'let' creates a variable that can be changed later.", code: "let score = 0;\nscore = 10;  // ✓ This works!\nscore = 20;  // ✓ Can change again" },
        { text: "'const' creates a variable that CANNOT be changed.", code: "const PI = 3.14159;\nPI = 3.14;  // ✗ Error! Cannot reassign" },
        { text: "JavaScript has several data types: String (text), Number, Boolean (true/false), and more!", code: "let userName = 'Alice';  // String\nlet age = 25;            // Number\nlet isStudent = true;    // Boolean" },
        { text: "Strings are text in quotes. Numbers are just digits.", code: "let greeting = 'Hello World';\nlet price = 19.99;\nlet count = 42;" },
        { text: "Booleans are either true or false - perfect for yes/no questions!", code: "let isLoggedIn = true;\nlet hasPermission = false;\nlet isComplete = true;" },
        { text: "Variable names should be descriptive: use 'userName' not 'x'. They can't start with numbers!", code: "// Good names ✓\nlet userName = 'Bob';\nlet totalScore = 100;\n\n// Bad names ✗\nlet x = 'Bob';\nlet 2ndPlace = 'Alice'; // Error!" },
        { text: "Great job, {name}! You now understand variables and data types. Ready for the quiz?" }
      ]
    },
    'quest4': { // Quest 4 - Functions in JavaScript
      title: 'Functions in JavaScript Lesson',
      npcImage: '/images/Q4.jpg',
      parts: [
        { text: "Greetings, {name}! Today we'll explore one of JavaScript's most powerful features: Functions!" },
        { text: "Functions are reusable blocks of code that perform specific tasks. Think of them as recipes!", code: "// A simple function\nfunction sayHello() {\n  console.log('Hello!');\n}\n\n// Call the function\nsayHello();  // Output: Hello!" },
        { text: "To create a function, use the 'function' keyword followed by a name and parentheses ().", code: "function greet() {\n  console.log('Welcome!');\n}\n\ngreet();  // Prints: Welcome!" },
        { text: "Functions can accept inputs called 'parameters'.", code: "function greet(name) {\n  console.log('Hello ' + name);\n}\n\ngreet('Alice');  // Hello Alice\ngreet('Bob');    // Hello Bob" },
        { text: "To use a function, you 'call' or 'invoke' it with parentheses.", code: "function celebrate() {\n  console.log('🎉 Party time!');\n}\n\ncelebrate();  // 🎉 Party time!" },
        { text: "Functions can 'return' values using the return keyword.", code: "function add(a, b) {\n  return a + b;\n}\n\nlet sum = add(5, 3);\nconsole.log(sum);  // 8" },
        { text: "Arrow functions are a shorter, modern syntax!", code: "// Traditional function\nfunction square(x) {\n  return x * x;\n}\n\n// Arrow function ✨\nconst square = (x) => x * x;\n\nsquare(5);  // 25" },
        { text: "Functions help organize code, avoid repetition, and make programs easier to maintain.", code: "// Reusable function\nfunction calculateTax(price) {\n  return price * 0.1;\n}\n\nlet tax1 = calculateTax(100);\nlet tax2 = calculateTax(250);" },
        { text: "Excellent, {name}! You now understand JavaScript functions. Time to test your knowledge!" }
      ]
    },
    'quest5': { // Quest 5 - Conditionals (if/else)
      title: 'Conditionals (if/else) Lesson',
      npcImage: '/images/Q5.jpg',
      parts: [
        { text: "Welcome back, {name}! Today we'll learn about conditionals - how to make decisions in code!" },
        { text: "Conditionals let your code make choices based on conditions. Like a fork in the road!", code: "// Simple if statement\nlet age = 18;\nif (age >= 18) {\n  console.log('You can vote!');\n}" },
        { text: "The 'if' statement runs code only when a condition is true.", code: "let score = 85;\nif (score > 80) {\n  console.log('Great job!');\n}\n// Output: Great job!" },
        { text: "Use 'else' to run code when the condition is false.", code: "let temperature = 15;\nif (temperature > 25) {\n  console.log('Hot day!');\n} else {\n  console.log('Cool day!');\n}\n// Output: Cool day!" },
        { text: "'else if' lets you check multiple conditions in order.", code: "let grade = 85;\nif (grade >= 90) {\n  console.log('A');\n} else if (grade >= 80) {\n  console.log('B');\n} else {\n  console.log('C');\n}\n// Output: B" },
        { text: "Comparison operators: == (equal), === (strict equal), !=, <, >, <=, >=", code: "let x = 5;\nif (x === 5) {  // Strict equality\n  console.log('x is 5');\n}\nif (x > 3) {\n  console.log('x is greater than 3');\n}" },
        { text: "Logical operators: && (AND), || (OR), ! (NOT)", code: "let age = 20;\nlet hasLicense = true;\n\nif (age >= 18 && hasLicense) {\n  console.log('Can drive!');\n}" },
        { text: "You can combine multiple conditions for complex logic.", code: "let hour = 14;\nif (hour < 12) {\n  console.log('Good morning');\n} else if (hour < 18) {\n  console.log('Good afternoon');\n} else {\n  console.log('Good evening');\n}" },
        { text: "Conditionals are essential for interactive programs and game logic!", code: "let health = 50;\nif (health <= 0) {\n  console.log('Game Over');\n} else if (health < 30) {\n  console.log('Warning: Low health!');\n} else {\n  console.log('Healthy');\n}" },
        { text: "Perfect, {name}! You now understand conditionals. Ready for the quiz?" }
      ]
    },
    'quest6': { // Quest 6 - Loops in JavaScript
      title: 'Loops in JavaScript Lesson',
      npcImage: '/images/Q6.jpg',
      parts: [
        { text: "Welcome back, {name}! Today we'll learn about loops - one of programming's most powerful concepts!" },
        { text: "Loops allow you to repeat code multiple times. Think of them as washing dishes repeatedly!", code: "// For loop - repeats a specific number of times\nfor (let i = 0; i < 5; i++) {\n  console.log('Hello #' + i);\n}\n// Output: Hello #0, Hello #1, Hello #2, Hello #3, Hello #4" },
        { text: "The 'for' loop has three parts: initialization (let i = 0), condition (i < 5), increment (i++).", code: "for (let count = 1; count <= 3; count++) {\n  console.log('Count: ' + count);\n}\n// Output: Count: 1, Count: 2, Count: 3" },
        { text: "Use 'while' loops when you don't know how many times to repeat.", code: "// While loop - repeats while condition is true\nlet energy = 100;\nwhile (energy > 0) {\n  console.log('Running...');\n  energy -= 20;\n}\nconsole.log('Out of energy!');" },
        { text: "Be careful with infinite loops! Always ensure the condition will eventually become false.", code: "// Infinite loop - DON'T DO THIS!\n// while (true) {\n//   console.log('Forever...');\n// }\n\n// Safe loop:\nlet attempts = 0;\nwhile (attempts < 3) {\n  console.log('Trying...');\n  attempts++;\n}" },
        { text: "Loops are perfect for processing arrays and lists of data.", code: "// Loop through an array\nconst fruits = ['apple', 'banana', 'orange'];\nfor (let i = 0; i < fruits.length; i++) {\n  console.log('I like ' + fruits[i]);\n}\n// Output: I like apple, I like banana, I like orange" },
        { text: "The 'break' statement exits a loop early, 'continue' skips to the next iteration.", code: "for (let num = 1; num <= 10; num++) {\n  if (num === 5) continue; // Skip 5\n  if (num === 8) break;    // Stop at 8\n  console.log(num);\n}\n// Output: 1,2,3,4,6,7" },
        { text: "Loops make your code efficient and save you from writing repetitive code!", code: "// Without loop (bad):\nconsole.log('Task 1');\nconsole.log('Task 2');\nconsole.log('Task 3');\n\n// With loop (good):\nfor (let task = 1; task <= 3; task++) {\n  console.log('Task ' + task);\n}" },
        { text: "Fantastic work, {name}! You now understand JavaScript loops. Let's test your knowledge!" }
      ]
    },
    'quest7': { // Quest 7 - Arrays in JavaScript
      title: 'Arrays in JavaScript Lesson',
      npcImage: '/images/Q6.jpg',
      parts: [
        { text: "Welcome, {name}! Today we'll explore JavaScript arrays - collections that store multiple values!" },
        { text: "Arrays are like containers that hold multiple items. Perfect for lists of data!", code: "// Creating an array\nconst colors = ['red', 'blue', 'green'];\nconst numbers = [1, 2, 3, 4, 5];\nconst mixed = ['text', 42, true];" },
        { text: "Access array elements using their index (starting from 0).", code: "const fruits = ['apple', 'banana', 'orange'];\nconsole.log(fruits[0]);  // 'apple'\nconsole.log(fruits[1]);  // 'banana'\nconsole.log(fruits[2]);  // 'orange'" },
        { text: "Get the array length with the .length property.", code: "const pets = ['cat', 'dog', 'bird'];\nconsole.log(pets.length);  // 3\n\n// Access last item\nconsole.log(pets[pets.length - 1]);  // 'bird'" },
        { text: "Add items to arrays using push() and unshift().", code: "const foods = ['pizza'];\nfoods.push('burger');     // Add to end\nfoods.unshift('salad');   // Add to start\nconsole.log(foods);       // ['salad', 'pizza', 'burger']" },
        { text: "Remove items using pop() and shift().", code: "const numbers = [1, 2, 3, 4];\nnumbers.pop();      // Remove last (4)\nnumbers.shift();    // Remove first (1)\nconsole.log(numbers);  // [2, 3]" },
        { text: "Loop through arrays to process each element.", code: "const scores = [85, 92, 78, 95];\nfor (let i = 0; i < scores.length; i++) {\n  console.log('Score ' + (i+1) + ': ' + scores[i]);\n}" },
        { text: "Use array methods like includes(), indexOf(), and join().", code: "const items = ['pen', 'book', 'bag'];\nconsole.log(items.includes('book')); // true\nconsole.log(items.indexOf('bag'));   // 2\nconsole.log(items.join(', '));       // 'pen, book, bag'" },
        { text: "Excellent, {name}! You now understand JavaScript arrays. Ready for the quiz?" }
      ]
    },
    'arraysinjavascript': { // Quest 7 - Arrays in JavaScript (alternate key)
      title: 'Arrays in JavaScript Lesson',
      npcImage: '/images/Q7.jpg',
      parts: [
        { text: "Welcome, {name}! Today we'll explore JavaScript arrays - collections that store multiple values!" },
        { text: "Arrays are like containers that hold multiple items. Perfect for lists of data!", code: "// Creating an array\nconst colors = ['red', 'blue', 'green'];\nconst numbers = [1, 2, 3, 4, 5];\nconst mixed = ['text', 42, true];" },
        { text: "Access array elements using their index (starting from 0).", code: "const fruits = ['apple', 'banana', 'orange'];\nconsole.log(fruits[0]);  // 'apple'\nconsole.log(fruits[1]);  // 'banana'\nconsole.log(fruits[2]);  // 'orange'" },
        { text: "Get the array length with the .length property.", code: "const pets = ['cat', 'dog', 'bird'];\nconsole.log(pets.length);  // 3\n\n// Access last item\nconsole.log(pets[pets.length - 1]);  // 'bird'" },
        { text: "Add items to arrays using push() and unshift().", code: "const foods = ['pizza'];\nfoods.push('burger');     // Add to end\nfoods.unshift('salad');   // Add to start\nconsole.log(foods);       // ['salad', 'pizza', 'burger']" },
        { text: "Remove items using pop() and shift().", code: "const numbers = [1, 2, 3, 4];\nnumbers.pop();      // Remove last (4)\nnumbers.shift();    // Remove first (1)\nconsole.log(numbers);  // [2, 3]" },
        { text: "Loop through arrays to process each element.", code: "const scores = [85, 92, 78, 95];\nfor (let i = 0; i < scores.length; i++) {\n  console.log('Score ' + (i+1) + ': ' + scores[i]);\n}" },
        { text: "Use array methods like includes(), indexOf(), and join().", code: "const items = ['pen', 'book', 'bag'];\nconsole.log(items.includes('book')); // true\nconsole.log(items.indexOf('bag'));   // 2\nconsole.log(items.join(', '));       // 'pen, book, bag'" },
        { text: "Excellent, {name}! You now understand JavaScript arrays. Ready for the quiz?" }
      ]
    },
    'quest8': { // Quest 8 - Objects in JavaScript
      title: 'Objects in JavaScript Lesson',
      npcImage: '/images/Q8.jpg',
      parts: [
        { text: "Hello, {name}! Today we'll learn about JavaScript objects - powerful data structures!" },
        { text: "Objects store data as key-value pairs. Think of them as real-world objects with properties!", code: "// Creating an object\nconst person = {\n  name: 'Alice',\n  age: 25,\n  city: 'Tokyo'\n};" },
        { text: "Access object properties using dot notation or bracket notation.", code: "const car = { brand: 'Toyota', year: 2020 };\nconsole.log(car.brand);    // 'Toyota'\nconsole.log(car['year']);  // 2020" },
        { text: "Objects can contain different data types, including arrays and other objects!", code: "const student = {\n  name: 'Bob',\n  grades: [85, 90, 78],\n  address: {\n    city: 'Osaka',\n    zip: '12345'\n  }\n};" },
        { text: "Add or modify properties easily.", code: "const book = { title: 'JavaScript' };\nbook.author = 'John Doe';  // Add new property\nbook.title = 'JS Guide';   // Modify existing\nconsole.log(book);" },
        { text: "Use Object.keys() to get all property names, Object.values() for values.", code: "const user = { name: 'Alice', age: 30 };\nconsole.log(Object.keys(user));    // ['name', 'age']\nconsole.log(Object.values(user));  // ['Alice', 30]" },
        { text: "Objects can have methods - functions as properties!", code: "const calculator = {\n  add: function(a, b) {\n    return a + b;\n  }\n};\nconsole.log(calculator.add(5, 3));  // 8" },
        { text: "Loop through object properties using for...in.", code: "const scores = { math: 90, english: 85 };\nfor (let subject in scores) {\n  console.log(subject + ': ' + scores[subject]);\n}" },
        { text: "Perfect, {name}! You now understand JavaScript objects. Time for the quiz!" }
      ]
    },
    'quest9': { // Quest 9 - String Methods
      title: 'String Methods in JavaScript Lesson',
      npcImage: '/images/Q9.jpg',
      parts: [
        { text: "Welcome back, {name}! Today we'll explore JavaScript string methods - powerful tools for text!" },
        { text: "Strings have many built-in methods to manipulate text. Let's explore them!", code: "const message = 'Hello World';\nconsole.log(message.length);      // 11\nconsole.log(message.toUpperCase()); // 'HELLO WORLD'\nconsole.log(message.toLowerCase()); // 'hello world'" },
        { text: "Use charAt() to get a character at a specific position.", code: "const word = 'JavaScript';\nconsole.log(word.charAt(0));   // 'J'\nconsole.log(word.charAt(4));   // 'S'\nconsole.log(word[0]);          // 'J' (alternative)" },
        { text: "The substring() and slice() methods extract parts of strings.", code: "const text = 'Hello World';\nconsole.log(text.substring(0, 5));  // 'Hello'\nconsole.log(text.slice(6));         // 'World'\nconsole.log(text.slice(-5));        // 'World'" },
        { text: "Use indexOf() to find the position of text, includes() to check if text exists.", code: "const sentence = 'I love JavaScript';\nconsole.log(sentence.indexOf('love'));      // 2\nconsole.log(sentence.includes('Java'));     // true\nconsole.log(sentence.includes('Python'));   // false" },
        { text: "Replace text using replace() method.", code: "const greeting = 'Hello Bob';\nconst newGreeting = greeting.replace('Bob', 'Alice');\nconsole.log(newGreeting);  // 'Hello Alice'" },
        { text: "Split strings into arrays with split(), join arrays into strings.", code: "const csv = 'apple,banana,orange';\nconst fruits = csv.split(',');\nconsole.log(fruits);  // ['apple', 'banana', 'orange']\n\nconst joined = fruits.join(' - ');\nconsole.log(joined);  // 'apple - banana - orange'" },
        { text: "Remove whitespace with trim(), repeat strings with repeat().", code: "const messy = '  Hello  ';\nconsole.log(messy.trim());     // 'Hello'\n\nconst ha = 'Ha';\nconsole.log(ha.repeat(3));     // 'HaHaHa'" },
        { text: "Excellent work, {name}! You've mastered string methods. Ready for the quiz?" }
      ]
    },
    'quest10': { // Quest 10 - Array Methods
      title: 'Advanced Array Methods Lesson',
      npcImage: '/images/Q10.jpg',
      parts: [
        { text: "Greetings, {name}! Let's dive into advanced array methods - the power tools of JavaScript!" },
        { text: "The map() method creates a new array by transforming each element.", code: "const numbers = [1, 2, 3, 4];\nconst doubled = numbers.map(num => num * 2);\nconsole.log(doubled);  // [2, 4, 6, 8]" },
        { text: "Use filter() to create a new array with elements that pass a test.", code: "const ages = [12, 18, 25, 16, 30];\nconst adults = ages.filter(age => age >= 18);\nconsole.log(adults);  // [18, 25, 30]" },
        { text: "The find() method returns the first element that matches a condition.", code: "const users = [\n  { name: 'Alice', age: 25 },\n  { name: 'Bob', age: 30 }\n];\nconst user = users.find(u => u.name === 'Bob');\nconsole.log(user);  // { name: 'Bob', age: 30 }" },
        { text: "Reduce() combines all array elements into a single value.", code: "const prices = [10, 20, 30, 40];\nconst total = prices.reduce((sum, price) => sum + price, 0);\nconsole.log(total);  // 100" },
        { text: "Use forEach() to execute a function for each array element.", code: "const colors = ['red', 'blue', 'green'];\ncolors.forEach((color, index) => {\n  console.log(`${index}: ${color}`);\n});\n// 0: red, 1: blue, 2: green" },
        { text: "The some() and every() methods test array elements.", code: "const scores = [85, 92, 78, 95];\nconsole.log(scores.some(s => s > 90));   // true\nconsole.log(scores.every(s => s > 70));  // true\nconsole.log(scores.every(s => s > 90));  // false" },
        { text: "Sort arrays with sort(), reverse with reverse().", code: "const nums = [3, 1, 4, 1, 5];\nnums.sort((a, b) => a - b);  // Ascending\nconsole.log(nums);  // [1, 1, 3, 4, 5]\n\nnums.reverse();\nconsole.log(nums);  // [5, 4, 3, 1, 1]" },
        { text: "Amazing, {name}! You've mastered advanced array methods. Let's test your knowledge!" }
      ]
    },
    'quest11': { // Quest 11 - Async JavaScript
      title: 'Asynchronous JavaScript Lesson',
      npcImage: '/images/Q11.jpg',
      parts: [
        { text: "Welcome, {name}! Today we'll explore asynchronous JavaScript - handling tasks that take time!" },
        { text: "JavaScript is single-threaded but can handle async operations like fetching data or timers.", code: "// Synchronous (blocking)\nconsole.log('First');\nconsole.log('Second');\n\n// Asynchronous (non-blocking)\nsetTimeout(() => {\n  console.log('After 1 second');\n}, 1000);" },
        { text: "Callbacks are functions passed to other functions to run later.", code: "function fetchData(callback) {\n  setTimeout(() => {\n    callback('Data loaded!');\n  }, 1000);\n}\n\nfetchData((data) => {\n  console.log(data);  // 'Data loaded!' after 1s\n});" },
        { text: "Promises represent future values - they can be pending, fulfilled, or rejected.", code: "const promise = new Promise((resolve, reject) => {\n  setTimeout(() => {\n    resolve('Success!');\n  }, 1000);\n});\n\npromise.then(result => console.log(result));" },
        { text: "Chain promises with .then() for sequential async operations.", code: "fetch('https://api.example.com/data')\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error(error));" },
        { text: "Async/await makes asynchronous code look synchronous and easier to read!", code: "async function getData() {\n  try {\n    const response = await fetch('/api/data');\n    const data = await response.json();\n    console.log(data);\n  } catch (error) {\n    console.error(error);\n  }\n}" },
        { text: "Use Promise.all() to wait for multiple promises to complete.", code: "const promise1 = fetch('/api/users');\nconst promise2 = fetch('/api/posts');\n\nPromise.all([promise1, promise2])\n  .then(([users, posts]) => {\n    console.log('Both loaded!');\n  });" },
        { text: "setTimeout() and setInterval() are common async functions.", code: "// Run once after delay\nsetTimeout(() => {\n  console.log('Hello!');\n}, 2000);\n\n// Run repeatedly\nconst interval = setInterval(() => {\n  console.log('Tick');\n}, 1000);\n\nclearInterval(interval);  // Stop it" },
        { text: "Fantastic, {name}! You now understand asynchronous JavaScript. Ready for the final quiz?" }
      ]
    }
  };
  
  // Quest quizzes system
  const questQuizzes = {
    'quest2': {
      title: 'JavaScript History Quiz',
      npcImage: '/images/Q2.jpg',
      questions: [
        {
          question: "Who created JavaScript?",
          options: ["Brendan Eich", "James Gosling", "Guido van Rossum", "Dennis Ritchie"],
          correctAnswer: 0
        },
        {
          question: "What was JavaScript originally called?",
          options: ["LiveScript", "Mocha", "ECMAScript", "Java"],
          correctAnswer: 1
        },
        {
          question: "Why was JavaScript named 'JavaScript'?",
          options: [
            "It's related to Java",
            "For marketing reasons when Java was popular",
            "It was created by Java developers",
            "It uses Java syntax"
          ],
          correctAnswer: 1
        }
      ]
    },
    'quest3': {
      title: 'Variables & Data Types Quiz',
      npcImage: '/images/Q3.jpg',
      questions: [
        {
          question: "Which keyword creates a variable that CANNOT be changed?",
          options: ["let", "const", "var", "static"],
          correctAnswer: 1
        },
        {
          question: "What data type is 'Hello World'?",
          options: ["Number", "Boolean", "String", "Text"],
          correctAnswer: 2
        },
        {
          question: "Which is a valid variable name in JavaScript?",
          options: ["2ndPlace", "user-name", "userName", "user name"],
          correctAnswer: 2
        }
      ]
    },
    'quest4': {
      title: 'Functions in JavaScript Quiz',
      npcImage: '/images/Q4.jpg',
      questions: [
        {
          question: "What keyword is used to create a function in JavaScript?",
          options: ["func", "function", "def", "method"],
          correctAnswer: 1
        },
        {
          question: "What does a function use to send a value back to the caller?",
          options: ["send", "output", "return", "give"],
          correctAnswer: 2
        },
        {
          question: "Which is the correct arrow function syntax?",
          options: ["const add = (a, b) => a + b;", "const add = (a, b) -> a + b;", "const add = (a, b) : a + b;", "const add = (a, b) = a + b;"],
          correctAnswer: 0
        }
      ]
    },
    'quest5': {
      title: 'Conditionals Quiz',
      npcImage: '/images/Q5.jpg',
      questions: [
        {
          question: "Which keyword is used to check a condition in JavaScript?",
          options: ["check", "if", "when", "condition"],
          correctAnswer: 1
        },
        {
          question: "What does the '===' operator do?",
          options: ["Assigns a value", "Checks strict equality", "Adds numbers", "Compares strings only"],
          correctAnswer: 1
        },
        {
          question: "Which logical operator means 'AND'?",
          options: ["|", "&", "&&", "||"],
          correctAnswer: 2
        }
      ]
    },
    'quest6': {
      title: 'Loops Quiz',
      npcImage: '/images/Q6.jpg',
      questions: [
        {
          question: "What is the correct syntax for a for loop in JavaScript?",
          options: ["for (i = 0; i < 5; i++)", "for (let i = 0; i < 5; i++)", "for (i < 5; i++)", "for (let i = 0, i < 5, i++)"],
          correctAnswer: 1
        },
        {
          question: "What does the 'break' statement do in a loop?",
          options: ["Skips to the next iteration", "Exits the loop completely", "Restarts the loop", "Pauses the loop"],
          correctAnswer: 1
        },
        {
          question: "Which loop is best when you don't know how many times to repeat?",
          options: ["for loop", "while loop", "do-while loop", "foreach loop"],
          correctAnswer: 1
        }
      ]
    },
    'quest7': {
      title: 'Arrays Quiz',
      npcImage: '/images/Q6.jpg',
      questions: [
        {
          question: "How do you access the first element of an array?",
          options: ["array[1]", "array[0]", "array.first()", "array.get(0)"],
          correctAnswer: 1
        },
        {
          question: "Which method adds an item to the END of an array?",
          options: ["unshift()", "append()", "push()", "add()"],
          correctAnswer: 2
        },
        {
          question: "What does array.length return?",
          options: ["The last element", "The first element", "The number of elements", "The array type"],
          correctAnswer: 2
        }
      ]
    },
    'arraysinjavascript': {
      title: 'Arrays Quiz',
      npcImage: '/images/Q6.jpg',
      questions: [
        {
          question: "How do you access the first element of an array?",
          options: ["array[1]", "array[0]", "array.first()", "array.get(0)"],
          correctAnswer: 1
        },
        {
          question: "Which method adds an item to the END of an array?",
          options: ["unshift()", "append()", "push()", "add()"],
          correctAnswer: 2
        },
        {
          question: "What does array.length return?",
          options: ["The last element", "The first element", "The number of elements", "The array type"],
          correctAnswer: 2
        }
      ]
    },
    'quest8': {
      title: 'Objects Quiz',
      npcImage: '/images/Q8.jpg',
      questions: [
        {
          question: "How do you access a property 'name' in an object 'person'?",
          options: ["person[name]", "person.name", "person->name", "person::name"],
          correctAnswer: 1
        },
        {
          question: "Which method returns an array of all property names in an object?",
          options: ["Object.values()", "Object.keys()", "Object.entries()", "Object.names()"],
          correctAnswer: 1
        },
        {
          question: "Can objects contain other objects and arrays?",
          options: ["No, only primitive values", "Yes, objects can be nested", "Only arrays, not objects", "Only in strict mode"],
          correctAnswer: 1
        }
      ]
    },
    'quest9': {
      title: 'String Methods Quiz',
      npcImage: '/images/Q9.jpg',
      questions: [
        {
          question: "Which method converts a string to uppercase?",
          options: ["toUpper()", "toUpperCase()", "upper()", "uppercase()"],
          correctAnswer: 1
        },
        {
          question: "What does 'Hello'.charAt(0) return?",
          options: ["'H'", "'e'", "0", "'Hello'"],
          correctAnswer: 0
        },
        {
          question: "Which method checks if a string contains a substring?",
          options: ["contains()", "has()", "includes()", "find()"],
          correctAnswer: 2
        }
      ]
    },
    'quest10': {
      title: 'Array Methods Quiz',
      npcImage: '/images/Q10.jpg',
      questions: [
        {
          question: "Which method creates a new array by transforming each element?",
          options: ["filter()", "map()", "reduce()", "forEach()"],
          correctAnswer: 1
        },
        {
          question: "What does filter() do?",
          options: ["Removes all elements", "Creates a new array with elements that pass a test", "Sorts the array", "Finds one element"],
          correctAnswer: 1
        },
        {
          question: "Which method combines all array elements into a single value?",
          options: ["combine()", "merge()", "reduce()", "join()"],
          correctAnswer: 2
        }
      ]
    },
    'quest11': {
      title: 'Async JavaScript Quiz',
      npcImage: '/images/Q11.jpg',
      questions: [
        {
          question: "What keyword is used to define an asynchronous function?",
          options: ["async", "await", "promise", "defer"],
          correctAnswer: 0
        },
        {
          question: "What does 'await' do in an async function?",
          options: ["Stops the program", "Waits for a promise to resolve", "Creates a new promise", "Delays execution"],
          correctAnswer: 1
        },
        {
          question: "Which method waits for multiple promises to complete?",
          options: ["Promise.wait()", "Promise.all()", "Promise.multiple()", "Promise.join()"],
          correctAnswer: 1
        }
      ]
    }
  };
  
  // Quest coding challenges (for Quest 5 onwards)
  const questChallenges = {
    // Quest 3 and 4 use traditional lesson + quiz format
    // Coding challenges start from Quest 5
    'quest5': {
      title: 'Conditionals Challenge',
      description: 'Create a variable called "score" with any number value. Write an if/else statement that logs "Pass" if score is 50 or above, and "Fail" if below 50.',
      starterCode: '// Write your code here\n',
      validation: (code, output) => {
        try {
          return code.includes('score') && 
                 code.includes('if') &&
                 (code.includes('else') || code.includes('Fail')) &&
                 (code.includes('>=') || code.includes('>') || code.includes('<=') || code.includes('<')) &&
                 (output.includes('Pass') || output.includes('Fail'));
        } catch(e) {
          return false;
        }
      },
      hint: 'Use: if (score >= 50) { console.log("Pass"); } else { console.log("Fail"); }',
      reward: { xp: 50, gold: 30 }
    },
    'quest6': {
      title: 'Loops Challenge',
      description: 'Write a for loop that logs numbers from 1 to 5. Use console.log() inside the loop to print each number.',
      starterCode: '// Write your for loop here\n',
      validation: (code, output) => {
        try {
          return code.includes('for') &&
                 code.includes('let') &&
                 code.includes('console.log') &&
                 (output.includes('1') && output.includes('2') && output.includes('3') && output.includes('4') && output.includes('5'));
        } catch(e) {
          return false;
        }
      },
      hint: 'Use: for (let i = 1; i <= 5; i++) { console.log(i); }',
      reward: { xp: 50, gold: 30 }
    },
    'quest7': {
      title: 'Arrays Challenge',
      description: 'Create an array called "colors" with three color names. Then use a for loop to log each color.',
      starterCode: '// Write your code here\n',
      validation: (code, output) => {
        try {
          return code.includes('colors') &&
                 code.includes('[') &&
                 code.includes(']') &&
                 code.includes('for') &&
                 code.includes('console.log');
        } catch(e) {
          return false;
        }
      },
      hint: 'Use: const colors = ["red", "blue", "green"]; for (let i = 0; i < colors.length; i++) { console.log(colors[i]); }',
      reward: { xp: 50, gold: 30 }
    },
    'arraysinjavascript': {
      title: 'Arrays Challenge',
      description: 'Create an array called "colors" with three color names. Then use a for loop to log each color.',
      starterCode: '// Write your code here\n',
      validation: (code, output) => {
        try {
          return code.includes('colors') &&
                 code.includes('[') &&
                 code.includes(']') &&
                 code.includes('for') &&
                 code.includes('console.log');
        } catch(e) {
          return false;
        }
      },
      hint: 'Use: const colors = ["red", "blue", "green"]; for (let i = 0; i < colors.length; i++) { console.log(colors[i]); }',
      reward: { xp: 50, gold: 30 }
    }
  };
  
  // Quest objective arrow
  let questObjectiveArrow = {
    active: false,
    targetX: 0,
    targetY: 0,
    questId: null
  };
  
  let currentLesson = {
    active: false,
    questId: null,
    currentPart: 0,
    parts: [],
    title: '',
    npcImage: null
  };
  
  let currentQuiz = {
    active: false,
    questId: null,
    currentQuestion: 0,
    questions: [],
    title: '',
    npcImage: null,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    hoveredOption: -1,
    userAnswers: [] // Track all answers for quest history
  };
  
  let currentChallenge = {
    active: false,
    questId: null,
    title: '',
    description: '',
    code: '',
    output: [],
    validation: null,
    hint: '',
    reward: null,
    cursorPosition: 0,
    showHint: false
  };
  
  const playerProfile = new PlayerProfile();
  
  // Floating Text System with Object Pooling
  class FloatingTextManager {
    constructor() {
      this.texts = [];
      this.pool = []; // Object pool for reuse
      this.maxPoolSize = 20;
    }
    
    addText(text, x, y, color = '#FFFFFF', duration = 2000) {
      // Try to reuse from pool
      let textObj = this.pool.pop();
      
      if (!textObj) {
        textObj = {};
      }
      
      // Reset properties
      textObj.text = text;
      textObj.x = x;
      textObj.y = y - 20;
      textObj.startY = y - 20;
      textObj.color = color;
      textObj.alpha = 1.0;
      textObj.duration = duration;
      textObj.elapsed = 0;
      
      this.texts.push(textObj);
    }
    
    update(deltaTime = 16) {
      // Update in reverse to safely remove items
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const textObj = this.texts[i];
        textObj.elapsed += deltaTime;
        const progress = textObj.elapsed / textObj.duration;
        
        if (progress >= 1) {
          // Return to pool for reuse
          if (this.pool.length < this.maxPoolSize) {
            this.pool.push(textObj);
          }
          this.texts.splice(i, 1);
        } else {
          // Float upward and fade out
          textObj.y = textObj.startY - (progress * 50);
          textObj.alpha = 1 - progress;
        }
      }
    }
    
    render(ctx) {
      if (this.texts.length === 0) return;
      
      // Batch render settings
      ctx.save();
      ctx.font = 'bold 16px Arial';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      
      for (let i = 0; i < this.texts.length; i++) {
        const textObj = this.texts[i];
        ctx.globalAlpha = textObj.alpha;
        ctx.fillStyle = textObj.color;
        
        const screenX = textObj.x - camera.x;
        const screenY = textObj.y - camera.y;
        
        // Draw text with outline
        ctx.strokeText(textObj.text, screenX, screenY);
        ctx.fillText(textObj.text, screenX, screenY);
      }
      
      ctx.restore();
    }
  }
  
  const floatingTextManager = new FloatingTextManager();
  
  // Add floating text method to PlayerProfile
  PlayerProfile.prototype.showFloatingText = function(text, x, y, color) {
    floatingTextManager.addText(text, x, y, color);
  };
  
  // Player Controller
  class PlayerController {
    constructor() {
        this.speed = 200; // Adjusted speed
        this.isAttacking = false;
        this.lastMovementState = false;
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            arrowup: false,
            arrowdown: false,
            arrowleft: false,
            arrowright: false,
            space: false,
            escape: false,
            e: false,
            f: false,
            p: false,
            m: false
        };
        
        this.setupKeys();
        console.log('PlayerController initialized with keys:', this.keys);
    }
    
    setupKeys() {
        window.addEventListener('keydown', (e) => {
            // Disable all keybinds if any input/textarea is focused
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                return; // Don't process game keys when typing
            }
            
            const key = e.key.toLowerCase();
            
            // Disable all player movement and keybinds when quiz is active
            if (currentQuiz.active) {
                // Only allow ESC to close quiz
                if (key === 'escape') {
                    currentQuiz.active = false;
                    canvas.style.cursor = 'default';
                    playerController.showQuestNotification('Quiz closed', '#e74c3c');
                    e.preventDefault();
                }
                return; // Block all other keys during quiz
            }
            
            // Handle coding terminal input
            if (currentChallenge.active) {
                if (key === 'escape') {
                    // Close terminal without completing
                    currentChallenge.active = false;
                    e.preventDefault();
                    return;
                } else if (key === 'enter') {
                    // Add new line
                    currentChallenge.code += '\n';
                    e.preventDefault();
                    return;
                } else if (key === 'backspace') {
                    // Remove last character
                    if (currentChallenge.code.length > 0) {
                        currentChallenge.code = currentChallenge.code.slice(0, -1);
                    }
                    e.preventDefault();
                    return;
                } else if (key === 'tab') {
                    // Add tab (2 spaces)
                    currentChallenge.code += '  ';
                    e.preventDefault();
                    return;
                } else if (e.key.length === 1) {
                    // Add regular character
                    currentChallenge.code += e.key;
                    e.preventDefault();
                    return;
                }
            }
            
            // Handle lesson dialogue
            if (currentLesson.active && key === 'enter') {
                currentLesson.currentPart++;
                if (currentLesson.currentPart >= currentLesson.parts.length) {
                    // Lesson completed
                    currentLesson.active = false;
                    gameState.interactedNPCs.add(`lesson_${currentLesson.questId}`);
                    console.log(`✅ Lesson completed for quest ${currentLesson.questId}`);
                    
                    // Track lesson completion (50% progress for Quest 2)
                    if (!gameState.questProgress[currentLesson.questId]) {
                        gameState.questProgress[currentLesson.questId] = {
                            lessonComplete: false,
                            quizComplete: false,
                            progress: 0
                        };
                    }
                    gameState.questProgress[currentLesson.questId].lessonComplete = true;
                    gameState.questProgress[currentLesson.questId].progress = 50;
                    
                    // Award partial XP for lesson completion
                    playerProfile.awardExperience(25, `Completed lesson for quest ${currentLesson.questId}`);
                    
                    console.log(`📊 Quest ${currentLesson.questId} progress: 50% (Lesson complete)`);
                    
                    // Show arrow pointing back to quest object for quiz
                    const quest = window.gameMapData?.quests.find(q => q.id === currentLesson.questId);
                    if (quest) {
                        questObjectiveArrow.active = true;
                        questObjectiveArrow.targetX = quest.x + quest.width / 2;
                        questObjectiveArrow.targetY = quest.y + quest.height / 2;
                        questObjectiveArrow.questId = quest.id;
                        console.log('🎯 Arrow activated - Return to quest for quiz!');
                        
                        // Show message to return to quest
                        playerController.showQuestNotification('Lesson complete! Return to the quest for the quiz.', '#4A90E2');
                    }
                    currentLesson.npcImage = null;
                }
                e.preventDefault();
                return;
            }
            
            // Handle special keys
            if (key === ' ') {
                this.keys.space = true;
                this.handleSpaceKey();
                e.preventDefault();
            } else if (key === 'escape') {
                this.keys.escape = true;
                this.handleEscapeKey();
                e.preventDefault();
            } else if (key === 'e') {
                this.keys.e = true;
                this.handleEKey();
                e.preventDefault();
            } else if (key === 'f') {
                this.keys.f = true;
                this.handleFKey();
                e.preventDefault();
            } else if (key === 'p') {
                this.keys.p = true;
                this.handlePKey();
                e.preventDefault();
            } else if (key === 'm') {
                this.keys.m = true;
                this.handleMKey();
                e.preventDefault();
            } else if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = true;
                console.log('Key down:', key, this.keys);
            }
        });
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            
            if (key === ' ') {
                this.keys.space = false;
            } else if (key === 'escape') {
                this.keys.escape = false;
            } else if (key === 'e') {
                this.keys.e = false;
            } else if (key === 'f') {
                this.keys.f = false;
            } else if (key === 'p') {
                this.keys.p = false;
            } else if (key === 'm') {
                this.keys.m = false;
            } else if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
                console.log('Key up:', key, this.keys);
            }
        });
    }
    
    handleSpaceKey() {
        if (gameState.showingDialogue) {
            // Close dialogue if it's open
            this.hideDialogue();
        } else if (gameState.currentNPC) {
            // Interact with NPC
            this.handleInteraction();
        } else if (gameState.currentQuest) {
            // Start quest
            this.handleQuestStart();
        } else {
            // Attack if no other interaction
            this.handleAttack();
        }
    }

    // Handle quest start
    handleQuestStart() {
        if (!gameState.currentQuest || !window.gameMapData?.quests) return;
        
        const quest = window.gameMapData.quests.find(q => q.id === gameState.currentQuest);
        if (quest) {
            // Check if quest is already completed
            if (gameState.completedQuests.has(quest.id)) {
                this.showQuestCompletedMessage(quest);
                return;
            }
            
            // Check if this is the first quest and player hasn't entered name yet
            const isFirstQuest = (quest.name || '').toLowerCase().includes('first quest');
            if (isFirstQuest && !playerProfile.inGameName) {
                console.log('🎮 First quest detected, showing name entry dialog');
                this.showNameEntryDialog(quest);
            } else {
                this.startQuest(quest);
            }
        }
    }
    
    // Show message for completed quest
    showQuestCompletedMessage(quest) {
        const dialogueBox = document.createElement('div');
        dialogueBox.id = 'dialogue-box';
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
                ✅ Quest Complete
            </div>
            <div style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                You've already completed this quest!<br>
                <strong style="color: #FFD700;">"${quest.name || 'Quest'}"</strong> is done.
            </div>
            <button id="closeCompletedQuestBtn" style="background: #27ae60; color: white; border: none; 
                padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer; 
                font-weight: bold; width: 100%;">
                OK
            </button>
        `;
        
        document.body.appendChild(dialogueBox);
        
        const closeBtn = document.getElementById('closeCompletedQuestBtn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(dialogueBox);
            gameState.currentQuest = null;
        });
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            if (document.body.contains(dialogueBox)) {
                document.body.removeChild(dialogueBox);
                gameState.currentQuest = null;
            }
        }, 3000);
    }
    
    // Show name entry dialog for first quest
    showNameEntryDialog(quest) {
        // Hide quest prompt
        this.hideQuestPrompt();
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        // Create dialog box
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: linear-gradient(135deg, #2c3e50, #34495e);
            border: 3px solid #f39c12;
            border-radius: 15px;
            padding: 30px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        `;
        
        // Create content
        dialog.innerHTML = `
            <h2 style="color: #f39c12; margin-bottom: 20px; font-family: Arial, sans-serif;">
                🎮 Welcome to CodeQuest! 🎮
            </h2>
            <p style="color: #ecf0f1; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 16px;">
                Before we begin your adventure, please tell us your name:
            </p>
            <input type="text" id="playerNameInput" placeholder="Enter your name" 
                style="width: 100%; padding: 12px; font-size: 16px; border: 2px solid #3498db; 
                border-radius: 6px; margin-bottom: 20px; box-sizing: border-box;" 
                maxlength="20" autofocus />
            <button id="confirmNameBtn" style="background: #27ae60; color: white; border: none; 
                padding: 12px 30px; border-radius: 6px; font-size: 16px; cursor: pointer; 
                font-weight: bold; width: 100%;">
                Start Adventure
            </button>
            <button id="cancelNameBtn" style="background: #e74c3c; color: white; border: none; 
                    padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer;
                    font-family: Arial, sans-serif;">
                Cancel
            </button>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Focus on input
        const nameInput = document.getElementById('playerNameInput');
        nameInput.focus();
        
        // Handle confirm
        const confirmBtn = document.getElementById('confirmNameBtn');
        const cancelBtn = document.getElementById('cancelNameBtn');
        
        confirmBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (name) {
                // Set the in-game name
                playerProfile.inGameName = name;
                console.log('✅ In-game name set to:', name);
                
                // Save to server with explicit inGameName
                await playerProfile.saveToServer({ inGameName: name });
                console.log('💾 Saved in-game name to server:', name);
                
                // Update HUD to show player name
                const playerNameElement = document.getElementById('playerName');
                if (playerNameElement) {
                    playerNameElement.textContent = name;
                }
                
                // Remove overlay
                document.body.removeChild(overlay);
                
                // Show welcome message from NPC
                this.showWelcomeDialogue(name, quest);
            } else {
                nameInput.style.borderColor = '#e74c3c';
                nameInput.placeholder = 'Please enter a name';
            }
        });
        
        // Allow Enter key to submit
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            gameState.currentQuest = null;
        });
    }
    
    // Show greeting after name entry
    showGreeting(playerName, quest) {
        // Create greeting overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        // Create greeting dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: linear-gradient(135deg, #8e44ad, #9b59b6);
            border: 3px solid #f1c40f;
            border-radius: 15px;
            padding: 30px;
            max-width: 450px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        `;
        
        dialog.innerHTML = `
            <h2 style="color: #f1c40f; margin-bottom: 20px; font-family: Arial, sans-serif;">
                🌟 Welcome, ${playerName}! 🌟
            </h2>
            <p style="color: #ecf0f1; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">
                Greetings, brave adventurer! Your journey in CodeQuest begins now. 
                Prepare to face challenges, solve puzzles, and become a coding hero!
            </p>
            <p style="color: #f39c12; margin-bottom: 25px; font-family: Arial, sans-serif; font-size: 14px;">
                Your first quest awaits...
            </p>
            <button id="startQuestBtn" style="background: #27ae60; color: white; border: none; 
                    padding: 15px 30px; border-radius: 8px; font-size: 18px; cursor: pointer;
                    font-family: Arial, sans-serif; font-weight: bold;">
                Begin Quest!
            </button>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Handle start quest
        const startBtn = document.getElementById('startQuestBtn');
        startBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.startQuest(quest);
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
                this.startQuest(quest);
            }
        }, 5000);
    }

    // Start a quest
    async startQuest(quest) {
        // Check quest prerequisites (quest order enforcement)
        const questKey = (quest.name || '').toLowerCase().replace(/\s+/g, '');
        const prerequisiteCheck = this.checkQuestPrerequisites(questKey);
        
        if (!prerequisiteCheck.allowed) {
            this.showQuestRejectionMessage(quest, prerequisiteCheck.reason);
            return;
        }
        
        // Check if quest has a lesson (by quest name)
        if (questLessons[questKey]) {
            this.startQuestLesson(quest);
            return;
        }
        
        // If quest has dialogue, show it instead of immediately starting
        if (quest.dialogue) {
            this.showQuestDialogue(quest);
            return;
        }
        
        // Mark quest as active
        gameState.activeQuests.add(quest.id);
        
        console.log(`📋 Started quest: ${quest.name}`);
        
        // Award experience only on first interaction with this quest
        if (!gameState.interactedNPCs.has(`quest_${quest.id}`)) {
            await playerProfile.awardExperience(10, `Started quest: ${quest.name}`);
            gameState.interactedNPCs.add(`quest_${quest.id}`);
            console.log(`⭐ First time starting quest ${quest.name}, awarded 10 XP`);
        }
        
        // Check for quest badges
        await this.checkQuestBadges();
        
        // Show quest start notification
        this.showQuestNotification(`Quest Started: ${quest.name}`, '#FFD700');
        
        // Hide quest prompt
        this.hideQuestPrompt();
    }
    
    // Check quest prerequisites
    checkQuestPrerequisites(questKey) {
        // Define quest order and prerequisites
        const questOrder = {
            'quest1': { prerequisite: null, name: 'First Quest', aliases: ['firstquest'] },
            'firstquest': { prerequisite: null, name: 'First Quest', aliases: ['quest1'] },
            'quest2': { prerequisite: ['quest1', 'firstquest'], name: 'Quest 2' },
            'quest3': { prerequisite: ['quest2'], name: 'Quest 3' },
            'quest4': { prerequisite: ['quest3'], name: 'Quest 4' },
            'quest5': { prerequisite: ['quest4'], name: 'Quest 5' },
            'quest6': { prerequisite: ['quest5'], name: 'Quest 6' },
            'quest7': { prerequisite: ['quest6'], name: 'Quest 7' },
            'arraysinjavascript': { prerequisite: ['quest6'], name: 'Quest 7' },
            'quest8': { prerequisite: ['quest7', 'arraysinjavascript'], name: 'Quest 8' },
            'quest9': { prerequisite: ['quest8'], name: 'Quest 9' },
            'quest10': { prerequisite: ['quest9'], name: 'Quest 10' },
            'quest11': { prerequisite: ['quest10'], name: 'Quest 11' }
        };
        
        const questInfo = questOrder[questKey];
        
        // If quest not in order system, allow it
        if (!questInfo) {
            return { allowed: true };
        }
        
        // If no prerequisite, allow it
        if (!questInfo.prerequisite) {
            return { allowed: true };
        }
        
        // Check if ANY of the prerequisite quests is completed
        const prerequisites = Array.isArray(questInfo.prerequisite) ? questInfo.prerequisite : [questInfo.prerequisite];
        
        for (const prereqKey of prerequisites) {
            const prerequisiteQuest = window.gameMapData?.quests?.find(q => {
                const qKey = (q.name || '').toLowerCase().replace(/\s+/g, '');
                return qKey === prereqKey;
            });
            
            if (prerequisiteQuest && gameState.completedQuests.has(prerequisiteQuest.id)) {
                return { allowed: true };
            }
        }
        
        // Get prerequisite quest name for message
        const prereqInfo = questOrder[prerequisites[0]];
        const prereqName = prereqInfo ? prereqInfo.name : 'the previous quest';
        
        return { 
            allowed: false, 
            reason: `You must complete ${prereqName} first!` 
        };
    }
    
    // Show quest rejection message
    showQuestRejectionMessage(quest, reason) {
        const dialogueBox = document.createElement('div');
        dialogueBox.id = 'dialogue-box';
        dialogueBox.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            border: 3px solid #e74c3c;
            max-width: 600px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        `;
        
        const playerName = playerProfile.inGameName || 'Adventurer';
        
        dialogueBox.innerHTML = `
            <div style="margin-bottom: 15px; color: #e74c3c; font-weight: bold; font-size: 18px;">
                🚫 Quest Locked
            </div>
            <div style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hold on, <strong style="color: #FFD700;">${playerName}</strong>!<br><br>
                ${reason}<br><br>
                Complete the previous quests in order to unlock this one.
            </div>
            <button id="closeRejection" style="background: #e74c3c; color: white; border: none; 
                padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer; 
                font-weight: bold; width: 100%;">
                Understood
            </button>
        `;
        
        document.body.appendChild(dialogueBox);
        
        const closeBtn = document.getElementById('closeRejection');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(dialogueBox);
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            if (document.body.contains(dialogueBox)) {
                document.body.removeChild(dialogueBox);
            }
        }, 5000);
    }
    
    // Check and award quest-related badges
    async checkQuestBadges() {
        const activeCount = gameState.activeQuests.size;
        const completedCount = gameState.completedQuests.size;
        
        if (activeCount === 1) {
            await playerProfile.awardBadge('first_quest', 'Started first quest');
        }
        
        // Always sync questsCompleted with actual completed quests count
        playerProfile.gameStats.questsCompleted = completedCount;
        
        if (completedCount === 1) {
            await playerProfile.awardBadge('quest_complete', 'Completed first quest');
            await playerProfile.saveToServer({ gameStats: playerProfile.gameStats });
        }
        if (completedCount === 5) {
            await playerProfile.awardBadge('quest_master', 'Completed 5 quests');
            await playerProfile.saveToServer({ gameStats: playerProfile.gameStats });
        }
        if (completedCount === 10) {
            await playerProfile.awardBadge('legendary_quester', 'Completed 10 quests');
            await playerProfile.saveToServer({ gameStats: playerProfile.gameStats });
        }
    }
    
    // Show welcome dialogue after name entry
    showWelcomeDialogue(playerName, quest) {
        const dialogueBox = document.createElement('div');
        dialogueBox.id = 'dialogue-box';
        dialogueBox.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            border: 3px solid #FFD700;
            max-width: 600px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        `;
        
        dialogueBox.innerHTML = `
            <div style="margin-bottom: 15px; color: #FFD700; font-weight: bold; font-size: 18px;">
                🧙 Quest Giver
            </div>
            <div style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Welcome, <strong style="color: #FFD700;">${playerName}</strong>! It's great to meet you!<br><br>
                I have an important quest for you. Are you ready to begin your adventure?
            </div>
            <button id="startQuestAfterWelcome" style="background: #27ae60; color: white; border: none; 
                padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer; 
                font-weight: bold; width: 100%;">
                Yes, I'm ready!
            </button>
        `;
        
        document.body.appendChild(dialogueBox);
        
        const startBtn = document.getElementById('startQuestAfterWelcome');
        startBtn.addEventListener('click', async () => {
            document.body.removeChild(dialogueBox);
            
            // Mark quest as active first
            gameState.activeQuests.add(quest.id);
            console.log(`📋 Started first quest: ${quest.name}`);
            
            // Award experience for starting
            if (!gameState.interactedNPCs.has(`quest_${quest.id}`)) {
                await playerProfile.awardExperience(10, `Started quest: ${quest.name}`);
                gameState.interactedNPCs.add(`quest_${quest.id}`);
            }
            
            // Show quest start notification
            this.showQuestNotification(`Quest Started: ${quest.name}`, '#FFD700');
            
            // Immediately complete the first quest
            gameState.activeQuests.delete(quest.id);
            gameState.completedQuests.add(quest.id);
            
            // Award completion rewards
            await playerProfile.awardExperience(100, `Completed quest: ${quest.name}`);
            await playerProfile.awardPixelCoins(50, `Quest reward: ${quest.name}`);
            
            // Show completion notification
            this.showQuestNotification(`Quest Completed! +100 XP, +50 Gold`, '#27ae60');
            
            // Check for quest badges
            await this.checkQuestBadges();
            
            // Save game progress after quest completion
            console.log('💾 Saving game progress after first quest completion...');
            await playerProfile.saveToServer({
                pixelCoins: playerProfile.pixelCoins,
                experience: playerProfile.experience,
                level: playerProfile.level,
                badges: playerProfile.badges,
                gameStats: playerProfile.gameStats,
                completedQuests: Array.from(gameState.completedQuests),
                activeQuests: Array.from(gameState.activeQuests),
                interactedNPCs: Array.from(gameState.interactedNPCs)
            });
            console.log('✅ First quest completed and saved');
        });
    }
    
    // Start quest lesson
    startQuestLesson(quest) {
        // Look up lesson by quest name (lowercase)
        const questKey = (quest.name || '').toLowerCase().replace(/\s+/g, '');
        const lesson = questLessons[questKey];
        
        console.log(`🔍 Looking for lesson with key: "${questKey}" from quest name: "${quest.name}"`);
        console.log(`📋 Available lessons:`, Object.keys(questLessons));
        
        if (!lesson) {
            console.log(`⚠️ No lesson found for quest: ${quest.name} (key: ${questKey})`);
            // No lesson for this quest, start directly
            this.startQuest(quest);
            return;
        }
        
        // Check if lesson already completed
        if (gameState.interactedNPCs.has(`lesson_${quest.id}`)) {
            console.log(`✅ Lesson already completed for quest ${quest.id}, starting quiz`);
            // Lesson done, start quiz
            this.startQuestQuiz(quest);
            return;
        }
        
        // Start the lesson
        currentLesson.active = true;
        currentLesson.questId = quest.id;
        currentLesson.currentPart = 0;
        currentLesson.parts = lesson.parts;
        currentLesson.title = lesson.title;
        
        // Load NPC image
        if (lesson.npcImage) {
            currentLesson.npcImage = new Image();
            currentLesson.npcImage.src = lesson.npcImage;
        }
        
        console.log(`📚 Started lesson: ${lesson.title} for quest: ${quest.name}`);
    }
    
    // Start quest quiz
    startQuestQuiz(quest) {
        const questKey = (quest.name || '').toLowerCase().replace(/\s+/g, '');
        const quiz = questQuizzes[questKey];
        
        if (!quiz) {
            console.log(`⚠️ No quiz found for quest: ${quest.name}`);
            // No quiz, complete quest directly
            this.showQuestDialogue(quest);
            return;
        }
        
        // Start the quiz
        currentQuiz.active = true;
        currentQuiz.questId = quest.id;
        currentQuiz.currentQuestion = 0;
        currentQuiz.questions = quiz.questions;
        currentQuiz.title = quiz.title;
        currentQuiz.score = 0;
        currentQuiz.correctAnswers = 0;
        currentQuiz.wrongAnswers = 0;
        currentQuiz.userAnswers = []; // Reset answers for new quiz
        
        // Load NPC image
        if (quiz.npcImage) {
            currentQuiz.npcImage = new Image();
            currentQuiz.npcImage.src = quiz.npcImage;
        }
        
        console.log(`📝 Started quiz: ${quiz.title} for quest: ${quest.name}`);
    }
    
    // Start coding challenge
    startCodingChallenge(quest) {
        const questKey = (quest.name || '').toLowerCase().replace(/\s+/g, '');
        const challenge = questChallenges[questKey];
        
        if (!challenge) {
            console.log(`⚠️ No coding challenge found for quest: ${quest.name}`);
            // No challenge, complete quest directly
            this.showQuestDialogue(quest);
            return;
        }
        
        // Start the challenge
        currentChallenge.active = true;
        currentChallenge.questId = quest.id;
        currentChallenge.title = challenge.title;
        currentChallenge.description = challenge.description;
        currentChallenge.code = challenge.starterCode;
        currentChallenge.output = [];
        currentChallenge.validation = challenge.validation;
        currentChallenge.hint = challenge.hint;
        currentChallenge.reward = challenge.reward;
        currentChallenge.showHint = false;
        
        console.log(`💻 Started coding challenge: ${challenge.title} for quest: ${quest.name}`);
    }
    
    // Show quest dialogue (similar to NPC dialogue)
    showQuestDialogue(quest) {
        // Create dialogue box
        let dialogueBox = document.getElementById('dialogue-box');
        if (!dialogueBox) {
            dialogueBox = document.createElement('div');
            dialogueBox.id = 'dialogue-box';
            dialogueBox.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                right: 20px;
                max-width: 600px;
                margin: 0 auto;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                font-size: 16px;
                z-index: 1001;
                border: 2px solid #FFD700;
            `;
            document.body.appendChild(dialogueBox);
        }
        
        // Use default completion message if no dialogue
        const dialogueText = quest.dialogue || "Quest completed! Well done! Proceed to your next mission.";
        
        dialogueBox.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #FFD700;">
                ${quest.name}:
            </div>
            <div style="margin-bottom: 15px; line-height: 1.4;">
                ${dialogueText}
            </div>
            <div style="text-align: right; font-size: 12px; color: #AAA;">
                Press ESC to close
            </div>
        `;
        
        dialogueBox.style.display = 'block';
        gameState.showingDialogue = true;
        
        // Clear existing timer
        if (gameState.dialogueAutoCloseTimer) {
            clearTimeout(gameState.dialogueAutoCloseTimer);
        }
        
        // Set auto-close timer for 2 seconds
        gameState.dialogueAutoCloseTimer = setTimeout(() => {
            this.hideDialogue();
            // After dialogue closes, complete the quest
            setTimeout(async () => {
                // Track quiz completion (remaining 50% progress for Quest 2)
                if (!gameState.questProgress[quest.id]) {
                    gameState.questProgress[quest.id] = {
                        lessonComplete: false,
                        quizComplete: false,
                        progress: 0
                    };
                }
                gameState.questProgress[quest.id].quizComplete = true;
                gameState.questProgress[quest.id].progress = 100;
                
                console.log(`📊 Quest ${quest.id} progress: 100% (Quiz complete)`);
                
                // Deactivate arrow when quest is fully completed
                if (questObjectiveArrow.questId === quest.id) {
                    questObjectiveArrow.active = false;
                    questObjectiveArrow.questId = null;
                    console.log('🎯 Arrow deactivated - Quest complete!');
                }
                
                // Mark quest as completed
                gameState.activeQuests.delete(quest.id);
                gameState.completedQuests.add(quest.id);
                
                // Award completion rewards (75 XP for quiz + 25 from lesson = 100 total)
                await playerProfile.awardExperience(75, `Completed quiz for quest: ${quest.name}`);
                await playerProfile.awardPixelCoins(50, `Quest reward: ${quest.name}`);
                
                // Show completion notification
                this.showQuestNotification(`Quest Completed! +100 XP, +50 Gold`, '#27ae60');
                this.hideQuestPrompt();
                
                // Check for quest badges
                await this.checkQuestBadges();
                
                // Save game progress after quest completion
                console.log('💾 Saving game progress after quest completion...');
                await playerProfile.saveToServer({
                    pixelCoins: playerProfile.pixelCoins,
                    experience: playerProfile.experience,
                    level: playerProfile.level,
                    badges: playerProfile.badges,
                    gameStats: playerProfile.gameStats
                });
                console.log('✅ Game saved after quest completion');
            }, 100);
        }, 2000);
    }

    // Complete quest after quiz
    async completeQuest(quest) {
        // Track quiz completion (100% progress)
        if (!gameState.questProgress[quest.id]) {
            gameState.questProgress[quest.id] = {
                lessonComplete: false,
                quizComplete: false,
                progress: 0
            };
        }
        gameState.questProgress[quest.id].quizComplete = true;
        gameState.questProgress[quest.id].progress = 100;
        
        console.log(`📊 Quest ${quest.id} progress: 100% (Quiz complete)`);
        
        // Deactivate arrow
        if (questObjectiveArrow.questId === quest.id) {
            questObjectiveArrow.active = false;
            questObjectiveArrow.questId = null;
            console.log('🎯 Arrow deactivated - Quest complete!');
        }
        
        // Mark quest as completed
        gameState.activeQuests.delete(quest.id);
        gameState.completedQuests.add(quest.id);
        
        // Play quest complete sound
        const questCompleteSound = document.getElementById('questCompleteSound');
        if (questCompleteSound) {
            questCompleteSound.currentTime = 0; // Reset to start
            questCompleteSound.volume = 0.5; // Set volume to 50%
            questCompleteSound.play().catch(err => console.log('Sound play failed:', err));
        }
        
        // Award quest-specific badge
        const questKey = (quest.name || '').toLowerCase().replace(/\s+/g, '');
        const questBadges = {
            'firstquest': { id: 'quest1_complete', name: 'First Quest Complete', description: 'Completed your first quest!' },
            'quest1': { id: 'quest1_complete', name: 'First Quest Complete', description: 'Completed your first quest!' },
            'quest2': { id: 'quest2_complete', name: 'JavaScript Historian', description: 'Learned JavaScript history' },
            'quest3': { id: 'quest3_complete', name: 'Variable Master', description: 'Mastered variables and data types' },
            'quest4': { id: 'quest4_complete', name: 'Function Expert', description: 'Became a function expert' },
            'quest5': { id: 'quest5_complete', name: 'Conditional Champion', description: 'Mastered if/else statements' },
            'quest6': { id: 'quest6_complete', name: 'Loop Legend', description: 'Mastered JavaScript loops' },
            'quest7': { id: 'quest7_complete', name: 'Array Master', description: 'Mastered JavaScript arrays' },
            'arraysinjavascript': { id: 'quest7_complete', name: 'Array Master', description: 'Mastered JavaScript arrays' }
        };
        
        const badgeInfo = questBadges[questKey];
        if (badgeInfo) {
            await playerProfile.awardBadge(badgeInfo.id, badgeInfo.description);
            console.log(`🏆 Awarded badge: ${badgeInfo.name}`);
        }
        
        // Show completion notification
        this.showQuestNotification(`Quest Completed! Check your rewards!`, '#27ae60');
        this.hideQuestPrompt();
        
        // Special message for Quest 11 - directs to monster battle map
        if (quest.id === 338 || questKey === 'quest11') {
            setTimeout(() => {
                this.showQuestNotification(`🗡️ New Challenge Unlocked! Head to the portal to battle a monster!`, '#FF6B6B');
                console.log('🗺️ Quest 11 complete - Monster battle map unlocked!');
                console.log('📍 Map location: /images/map3/try22.tmj');
            }, 3000);
        }
        
        // Check for quest badges
        await this.checkQuestBadges();
        
        // Calculate quest rewards
        const quizXP = (currentQuiz.correctAnswers * 30) - (currentQuiz.wrongAnswers * 15);
        const quizGold = currentQuiz.correctAnswers * 20;
        const challengeXP = currentChallenge.completed ? 50 : 0;
        const challengeGold = currentChallenge.completed ? 30 : 0;
        const totalXP = quizXP + challengeXP + 25; // +25 for lesson
        const totalGold = quizGold + challengeGold;
        
        // Save quest history with detailed data
        const questHistoryData = {
            questId: quest.id,
            questName: quest.name || `Quest ${quest.id}`,
            quizScore: {
                correct: currentQuiz.correctAnswers,
                wrong: currentQuiz.wrongAnswers,
                total: currentQuiz.questions.length,
                percentage: Math.round((currentQuiz.correctAnswers / currentQuiz.questions.length) * 100)
            },
            quizAnswers: currentQuiz.userAnswers || [],
            challengeCompleted: currentChallenge.completed || false,
            challengeCode: currentChallenge.code || '',
            totalXP: totalXP,
            totalGold: totalGold
        };
        
        // Send quest history to server
        try {
            const response = await fetch('/api/quest-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(questHistoryData)
            });
            
            if (response.ok) {
                console.log('📚 Quest history saved successfully');
            } else {
                console.warn('⚠️ Failed to save quest history');
            }
        } catch (error) {
            console.error('❌ Error saving quest history:', error);
        }
        
        // Save game progress
        console.log('💾 Saving game progress after quest completion...');
        await playerProfile.saveToServer({
            pixelCoins: playerProfile.pixelCoins,
            experience: playerProfile.experience,
            level: playerProfile.level,
            badges: playerProfile.badges,
            gameStats: playerProfile.gameStats
        });
        console.log('✅ Quest completed and saved!');
    }
    
    // Show quest notification
    showQuestNotification(text, color = '#FFD700') {
        const notification = document.createElement('div');
        notification.textContent = text;
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: ${color};
            padding: 15px 25px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-weight: bold;
            font-size: 18px;
            z-index: 1000;
            pointer-events: none;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            border: 2px solid ${color};
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Animate out and remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
    
    handleEscapeKey() {
        if (gameState.showingDialogue) {
            this.hideDialogue();
        } else if (gameState.showSettings) {
            gameState.showSettings = false;
        }
    }
    
    handleEKey() {
        if (gameState.showingDialogue) {
            this.hideDialogue();
        } else if (gameState.currentNPC) {
            this.handleInteraction();
        } else if (gameState.currentQuest) {
            this.handleQuestStart();
        }
    }
    
    handleFKey() {
        // F key is for collecting rewards - this happens automatically when near rewards
        // But we can add a manual collection trigger if needed
        console.log('F key pressed - rewards are collected automatically when walking over them');
    }
    
    handlePKey() {
        // Toggle HUD visibility
        gameState.showHUD = !gameState.showHUD;
        console.log('HUD toggled:', gameState.showHUD ? 'ON' : 'OFF');
    }
    
    handleMKey() {
        // Toggle settings menu
        gameState.showSettings = !gameState.showSettings;
        console.log('Settings menu toggled:', gameState.showSettings ? 'ON' : 'OFF');
    }
    
    handleSettingsOption(option) {
        switch(option) {
            case '1':
                this.saveGame();
                break;
            case '2':
                this.loadGame();
                break;
            case '3':
                this.deleteSave();
                break;
            case '4':
                this.exitGame();
                break;
        }
        gameState.showSettings = false; // Close menu after selection
    }
    
    async saveGame() {
        try {
            // Validate player object exists
            if (!player) {
                throw new Error('Player object not initialized');
            }

            // Ensure all required data is properly formatted
            // Note: Collision overrides are now saved globally, not per-user
            
            const saveData = {
                playerName: playerProfile.playerName || 'Unknown Player',
                inGameName: playerProfile.inGameName || null,
                pixelCoins: Number(playerProfile.pixelCoins) || 0,
                experience: Number(playerProfile.experience) || 0,
                level: Number(playerProfile.level) || 1,
                badges: Array.isArray(playerProfile.badges) ? playerProfile.badges : [],
                achievements: Array.isArray(playerProfile.achievements) ? playerProfile.achievements : [],
                gameStats: {
                    monstersDefeated: Number(playerProfile.gameStats?.monstersDefeated) || 0,
                    questsCompleted: Number(playerProfile.gameStats?.questsCompleted) || 0,
                    codeLinesWritten: Number(playerProfile.gameStats?.codeLinesWritten) || 0,
                    playTime: Number(playerProfile.gameStats?.playTime) || 0
                },
                playerPosition: { 
                    x: Number(player.x) || 0, 
                    y: Number(player.y) || 0 
                },
                collectedRewards: Array.from(gameState.collectedRewards || []),
                activeQuests: Array.from(gameState.activeQuests || []),
                completedQuests: Array.from(gameState.completedQuests || []),
                interactedNPCs: Array.from(gameState.interactedNPCs || []),
                questProgress: gameState.questProgress || {},
                playerDirection: gameState.playerDirection || 'right',
                currentAnimation: gameState.currentAnimation || 'idle',
                savedAt: new Date().toISOString()
            };
            
            console.log('💾 Saving game to server (player account)...');
            
            // Save ONLY to server/database (no localStorage)
            const response = await fetch('/game/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(saveData)
            });
            
            console.log('📡 Server response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Server error response:', errorText);
                throw new Error(`Server save failed: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            console.log('📡 Server response data:', result);
            
            if (!result.success) {
                throw new Error(result.message || 'Unknown server error');
            }
            
            this.showNotification('Game Saved to Your Account!', '#00FF00');
            console.log('✅ Game saved to player account successfully');
        } catch (error) {
            console.error('❌ Failed to save game to account:', error);
            this.showNotification('Save Failed: ' + error.message, '#FF4444');
        }
    }
    
    async loadGame() {
        try {
            console.log('📥 Loading game from player account...');
            
            // Load ONLY from server/database (no localStorage)
            const response = await fetch('/game/load', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Check if it's an authentication error
                if (response.status === 401) {
                    console.error('❌ Authentication required - redirecting to login');
                    window.location.href = '/auth/login';
                    return;
                }
                
                throw new Error(`Failed to load game: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success || !result.data) {
                this.showNotification('No save data found in your account!', '#FF6B6B');
                return;
            }
            
            const saveData = result.data;
            console.log('✅ Loaded from player account');
            
            // Restore player profile
            playerProfile.playerName = saveData.playerName || 'Unknown Player';
            playerProfile.inGameName = saveData.inGameName || null; // Restore in-game name
            playerProfile.pixelCoins = saveData.pixelCoins || 0;
            playerProfile.experience = saveData.experience || 0;
            playerProfile.level = saveData.level || 1;
            playerProfile.badges = saveData.badges || [];
            playerProfile.achievements = saveData.achievements || [];
            playerProfile.gameStats = saveData.gameStats || playerProfile.gameStats;
            
            // Restore player position
            if (saveData.playerPosition && player) {
                player.x = saveData.playerPosition.x;
                player.y = saveData.playerPosition.y;
            }
            
            // Restore game state
            gameState.collectedRewards = new Set(saveData.collectedRewards || []);
            gameState.activeQuests = new Set(saveData.activeQuests || []);
            gameState.completedQuests = new Set(saveData.completedQuests || []);
            gameState.interactedNPCs = new Set(saveData.interactedNPCs || []);
            gameState.questProgress = saveData.questProgress || {};
            gameState.playerDirection = saveData.playerDirection || 'right';
            gameState.currentAnimation = saveData.currentAnimation || 'idle';
            
            // Note: Collision overrides are now loaded globally, not per-user
            
            this.showNotification('Game Loaded Successfully!', '#00BFFF');
            console.log('✅ Game loaded:', saveData);
        } catch (error) {
            console.error('❌ Failed to load game:', error);
            this.showNotification('Load Failed: ' + error.message, '#FF4444');
        }
    }
    
    async deleteSave() {
        if (!confirm('Are you sure you want to delete your save data from your account? This action cannot be undone!')) {
            return;
        }
        
        try {
            console.log('🗑️ Deleting save data from player account...');
            
            // Set flag to prevent auto-save on page unload
            window.deletingSave = true;
            
            // Delete ONLY from server/database (no localStorage)
            const response = await fetch('/game/delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Check if it's an authentication error
                if (response.status === 401) {
                    console.error('❌ Authentication required - redirecting to login');
                    window.location.href = '/auth/login';
                    return;
                }
                
                throw new Error(`Failed to delete save: ${response.status}`);
            }
            
            console.log('✅ Save deleted from player account');
            
            // Show notification and reload to start fresh game
            this.showNotification('Save deleted! Starting new game...', '#FF6B6B');
            console.log('🗑️ Save data deleted - reloading for new game');
            
            // Reload page after short delay to start a new game
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            console.error('❌ Failed to delete save:', error);
            this.showNotification('Delete Failed: ' + error.message, '#FF4444');
            window.deletingSave = false; // Reset flag on error
        }
    }
    
    exitGame() {
        if (confirm('Are you sure you want to exit the game?')) {
            this.showNotification('Returning to Dashboard...', '#FFD700');
            setTimeout(() => {
                // Redirect to dashboard
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            gameState.showSettings = true; // Reopen settings if cancelled
        }
    }
    
    showNotification(text, color = '#FFD700') {
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
    
    handleMovement(deltaTime = 16) {
        if (!player) {
            console.warn('No player object available');
            return;
        }
        
        // Disable movement when quiz or challenge is active
        if (currentQuiz.active || currentChallenge.active) {
            gameState.isMoving = false;
            gameState.currentAnimation = 'idle';
            return;
        }

        const isUpPressed = this.keys.w || this.keys.arrowup;
        const isDownPressed = this.keys.s || this.keys.arrowdown;
        const isLeftPressed = this.keys.a || this.keys.arrowleft;
        const isRightPressed = this.keys.d || this.keys.arrowright;
        
        let velocityX = 0;
        let velocityY = 0;
        
        if (isLeftPressed) velocityX = -1;
        if (isRightPressed) velocityX = 1;
        if (isUpPressed) velocityY = -1;
        if (isDownPressed) velocityY = 1;
        
        // Normalize diagonal movement for consistent speed
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707;
            velocityY *= 0.707;
        }
        
        // Frame-rate independent movement
        const frameTime = deltaTime / 1000; // Convert to seconds
        velocityX *= this.speed * frameTime;
        velocityY *= this.speed * frameTime;

        // Move player with collision detection
        if (velocityX !== 0 || velocityY !== 0) {
            const oldX = player.x;
            const oldY = player.y;
            
            // Update player direction based on movement
            if (velocityX > 0) {
                gameState.playerDirection = 'right';
            } else if (velocityX < 0) {
                gameState.playerDirection = 'left';
            }
            
            // Calculate new position
            const newX = player.x + velocityX;
            const newY = player.y + velocityY;
            
            // Check collision for new position
            const canMoveX = !this.checkCollisionAtPosition(newX, player.y);
            const canMoveY = !this.checkCollisionAtPosition(player.x, newY);
            const canMoveDiagonal = !this.checkCollisionAtPosition(newX, newY);
            
            // Apply movement with collision checking
            if (canMoveDiagonal) {
                // No collision at destination
                player.x = newX;
                player.y = newY;
            } else if (canMoveX && velocityX !== 0) {
                // Can't move diagonally, try just X
                player.x = newX;
            } else if (canMoveY && velocityY !== 0) {
                // Can't move diagonally, try just Y
                player.y = newY;
            }
            // else: blocked, don't move
            
            // Update movement state
            const actuallyMoved = (player.x !== oldX || player.y !== oldY);
            gameState.isMoving = actuallyMoved;
            
            // Update animation based on actual movement
            if (actuallyMoved) {
                gameState.currentAnimation = 'walk';
            } else {
                gameState.currentAnimation = 'idle';
            }
        } else {
            // Not pressing movement keys
            gameState.isMoving = false;
            gameState.currentAnimation = 'idle';
        }
    }
    
    checkCollisionAtPosition(x, y) {
        const mapData = MapRenderer.getMapData();
        if (!mapData || !mapData.layers) return false;
        
        const tileW = mapData.tilewidth || 16;
        const tileH = mapData.tileheight || 16;
        const excludedLayers = ['ground', 'people'];
        
        // Reduce hitbox size for better gameplay feel
        // Add inset padding so collision box is smaller than visual sprite
        const hitboxInset = 30; // Pixels to shrink hitbox from each side (increased from 20)
        const hitboxX = x + hitboxInset;
        const hitboxY = y + hitboxInset;
        const hitboxWidth = player.width - (hitboxInset * 2);
        const hitboxHeight = player.height - (hitboxInset * 2);
        
        // Check all four corners of the reduced hitbox
        const corners = [
            { x: hitboxX, y: hitboxY },                                    // Top-left
            { x: hitboxX + hitboxWidth - 1, y: hitboxY },                // Top-right
            { x: hitboxX, y: hitboxY + hitboxHeight - 1 },              // Bottom-left
            { x: hitboxX + hitboxWidth - 1, y: hitboxY + hitboxHeight - 1 }  // Bottom-right
        ];
        
        for (const corner of corners) {
            const tileX = Math.floor(corner.x / tileW);
            const tileY = Math.floor(corner.y / tileH);
            
            // Check all collision layers
            for (const layer of mapData.layers) {
                if (layer.type !== 'tilelayer') continue;
                if (excludedLayers.includes(layer.name.toLowerCase())) continue;
                
                // Check if there's a tile at this position
                let hasTile = false;
                MapRenderer.forEachTileInLayer(layer, (tileId, tx, ty) => {
                    if (tx === tileX && ty === tileY && tileId) {
                        hasTile = true;
                    }
                });
                
                if (hasTile) {
                    // Check for collision override
                    const tileKey = `${tileX},${tileY},${layer.name}`;
                    if (collisionOverrides.has(tileKey)) {
                        // Use override value (true = collision ON, false = collision OFF)
                        if (collisionOverrides.get(tileKey)) {
                            return true; // Override says collision ON
                        }
                        // Otherwise override says collision OFF, continue checking other layers
                    } else {
                        // No override, use default behavior (collision ON)
                        return true; // Collision detected
                    }
                }
            }
        }
        
        return false; // No collision
    }
    
    update(deltaTime = 16) {
        this.handleMovement(deltaTime);
        this.checkRewardCollection();
        // Check quests first - they have priority over NPCs
        this.checkQuestInteraction();
        // Only check NPCs if no quest is nearby
        if (!gameState.currentQuest) {
            this.checkNPCInteraction();
        } else {
            // Hide NPC prompt if quest is active
            this.hideInteractionPrompt();
        }
    }

    // Handle attack (adapted from tutorial.js)
    handleAttack() {
        if (gameState.isAttacking) {
            if (gameState.debugMode) console.log('[Attack] Attack already in progress');
            return;
        }
        
        const currentAnim = gameState.currentAnimation;
        if (currentAnim === 'hurt') {
            if (gameState.debugMode) console.log('[Attack] Cannot attack while hurt');
            return;
        }
        
        console.log('[Attack] Starting attack sequence...');
        
        gameState.isAttacking = true;
        
        // Store current movement state
        const wasMoving = gameState.isMoving;
        
        // Set attack animation
        gameState.currentAnimation = 'attack';
        
        console.log('[Attack] Attack animation started successfully');
        
        // Set up completion handler with timeout (like tutorial.js)
        const attackDuration = 600; // Attack animation duration in ms
        
        setTimeout(() => {
            if (gameState.isAttacking) {
                console.log('[Attack] Attack animation completed');
                gameState.isAttacking = false;
                
                // Return to appropriate state
                const nextAnim = wasMoving ? 'walk' : 'idle';
                console.log(`[Attack] Returning to ${nextAnim} animation`);
                gameState.currentAnimation = nextAnim;
            }
        }, attackDuration);
        
        // Safety timeout in case something goes wrong (like tutorial.js)
        setTimeout(() => {
            if (gameState.isAttacking) {
                console.warn('[Attack] Attack timeout - forcing completion');
                gameState.isAttacking = false;
                const nextAnim = gameState.isMoving ? 'walk' : 'idle';
                gameState.currentAnimation = nextAnim;
            }
        }, 2000); // 2 second timeout
    }

    // Check for quest interactions (optimized with squared distance)
    checkQuestInteraction() {
        if (!window.gameMapData?.quests || !player) return;

        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const interactionRadiusSquared = 625; // 25 * 25 (avoid sqrt)

        for (let i = 0; i < window.gameMapData.quests.length; i++) {
            const quest = window.gameMapData.quests[i];
            if (!quest) continue;
            
            // Only show interaction prompt for quests with a valid name (not empty or default "Quest")
            if (!quest.name || quest.name.trim() === '' || quest.name.trim().toLowerCase() === 'quest') continue;
            
            const questCenterX = quest.x + quest.width / 2;
            const questCenterY = quest.y + quest.height / 2;

            // Use squared distance to avoid expensive sqrt
            const dx = playerCenterX - questCenterX;
            const dy = playerCenterY - questCenterY;
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared <= interactionRadiusSquared) {
                // Check if quest is completed
                const isCompleted = gameState.completedQuests.has(quest.id);
                this.showQuestPrompt(quest, isCompleted);
                return; // Only show one at a time
            }
        }
        
        // Hide quest prompt if no quests nearby
        this.hideQuestPrompt();
    }

    // Show quest interaction prompt
    showQuestPrompt(quest, isCompleted = false) {
        // Hide prompt if lesson, quiz, or coding challenge is active
        if (currentLesson.active || currentQuiz.active || currentChallenge.active) {
            this.hideQuestPrompt();
            return;
        }
        
        if (gameState.currentQuest === quest.id) return; // Already showing
        
        gameState.currentQuest = quest.id;
        
        // Create or update quest prompt
        let prompt = document.getElementById('quest-prompt');
        if (!prompt) {
            prompt = document.createElement('div');
            prompt.id = 'quest-prompt';
            prompt.style.cssText = `
                position: fixed;
                bottom: 140px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 215, 0, 0.9);
                color: black;
                padding: 10px 20px;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                font-weight: bold;
                z-index: 1000;
                pointer-events: none;
                border: 2px solid #FFD700;
            `;
            document.body.appendChild(prompt);
        }
        
        if (isCompleted) {
            prompt.innerHTML = `<span style="background: #27ae60; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">✓</span> Quest already finished`;
            prompt.style.background = 'rgba(39, 174, 96, 0.9)';
        } else {
            prompt.innerHTML = `<span style="background: #00FF00; color: black; padding: 2px 6px; border-radius: 3px; font-weight: bold;">E</span> Start quest: ${quest.name || 'Quest'}`;
            prompt.style.background = 'rgba(255, 215, 0, 0.9)';
        }
        prompt.style.display = 'block';
    }

    // Hide quest prompt
    hideQuestPrompt() {
        gameState.currentQuest = null;
        const prompt = document.getElementById('quest-prompt');
        if (prompt) {
            prompt.style.display = 'none';
        }
    }

    // Check for reward collection (optimized with squared distance)
    checkRewardCollection() {
        if (!window.gameMapData?.rewards || !player) return;

        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const collectionRadiusSquared = 400; // 20 * 20 (avoid sqrt)

        for (let i = 0; i < window.gameMapData.rewards.length; i++) {
            const reward = window.gameMapData.rewards[i];
            // Skip already collected rewards
            if (gameState.collectedRewards.has(reward.id)) continue;

            const rewardCenterX = reward.x + reward.width / 2;
            const rewardCenterY = reward.y + reward.height / 2;

            // Use squared distance to avoid expensive sqrt
            const dx = playerCenterX - rewardCenterX;
            const dy = playerCenterY - rewardCenterY;
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared <= collectionRadiusSquared) {
                this.collectReward(reward);
            }
        }
    }

    // Check for NPC interactions
    checkNPCInteraction() {
        if (!window.gameMapData?.npcs || !player) return;

        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const interactionRadiusSquared = 625; // 25 * 25 (avoid sqrt)

        for (let i = 0; i < window.gameMapData.npcs.length; i++) {
            const npc = window.gameMapData.npcs[i];
            if (!npc) continue;
            
            // Only show interaction prompt for NPCs with dialogue
            if (!npc.dialogue || npc.dialogue.trim() === '') continue;

            const npcCenterX = npc.x + (npc.width || 16) / 2;
            const npcCenterY = npc.y + (npc.height || 16) / 2;
            const dx = playerCenterX - npcCenterX;
            const dy = playerCenterY - npcCenterY;
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared <= interactionRadiusSquared) {
                this.showInteractionPrompt(npc);
                return; // Only show one at a time
            }
        }
        
        // Hide interaction prompt if no NPCs nearby
        this.hideInteractionPrompt();
    }

    // Show interaction prompt
    showInteractionPrompt(npc) {
        if (gameState.currentNPC === npc.id) return; // Already showing
        
        gameState.currentNPC = npc.id;
        
        // Create or update interaction prompt
        let prompt = document.getElementById('interaction-prompt');
        if (!prompt) {
            prompt = document.createElement('div');
            prompt.id = 'interaction-prompt';
            prompt.style.cssText = `
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.body.appendChild(prompt);
        }
        
        prompt.innerHTML = `<span style="background: #00FF00; color: black; padding: 2px 6px; border-radius: 3px; font-weight: bold;">E</span> Talk to ${npc.name || 'NPC'}`;
        prompt.style.display = 'block';
    }

    // Hide interaction prompt
    hideInteractionPrompt() {
        gameState.currentNPC = null;
        const prompt = document.getElementById('interaction-prompt');
        if (prompt) {
            prompt.style.display = 'none';
        }
    }

    // Handle NPC interaction
    async handleInteraction() {
        if (!gameState.currentNPC || !window.gameMapData?.npcs) return;
        
        const npc = window.gameMapData.npcs.find(n => n.id === gameState.currentNPC);
        if (npc && npc.dialogue) {
            // Award XP for first interaction with this NPC
            if (!gameState.interactedNPCs.has(npc.id)) {
                gameState.interactedNPCs.add(npc.id);
                await playerProfile.awardExperience(10, `First talk with ${npc.name || 'NPC'}`);
                console.log(`🎯 First interaction with NPC ${npc.id}: +10 XP`);
            }
            
            this.showDialogue(npc);
        }
    }

    // Show dialogue system
    showDialogue(npc) {
        // Create dialogue box
        let dialogueBox = document.getElementById('dialogue-box');
        if (!dialogueBox) {
            dialogueBox = document.createElement('div');
            dialogueBox.id = 'dialogue-box';
            dialogueBox.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                right: 20px;
                max-width: 600px;
                margin: 0 auto;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                font-size: 16px;
                z-index: 1001;
                border: 2px solid #444;
            `;
            document.body.appendChild(dialogueBox);
        }
        
        dialogueBox.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #FFD700;">
                ${npc.name || 'NPC'}:
            </div>
            <div style="margin-bottom: 15px; line-height: 1.4;">
                ${npc.dialogue}
            </div>
            <div style="text-align: right; font-size: 12px; color: #AAA;">
                Press ESC to close
            </div>
        `;
        
        dialogueBox.style.display = 'block';
        gameState.showingDialogue = true;
        
        // Clear existing timer
        if (gameState.dialogueAutoCloseTimer) {
            clearTimeout(gameState.dialogueAutoCloseTimer);
        }
        
        // Set auto-close timer for 1.5 seconds
        gameState.dialogueAutoCloseTimer = setTimeout(() => {
            this.hideDialogue();
        }, 1500);
    }

    // Hide dialogue
    hideDialogue() {
        const dialogueBox = document.getElementById('dialogue-box');
        if (dialogueBox) {
            dialogueBox.style.display = 'none';
        }
        gameState.showingDialogue = false;
        
        // Clear auto-close timer
        if (gameState.dialogueAutoCloseTimer) {
            clearTimeout(gameState.dialogueAutoCloseTimer);
            gameState.dialogueAutoCloseTimer = null;
        }
    }

    // Collect a reward
    async collectReward(reward) {
        // Mark as collected
        gameState.collectedRewards.add(reward.id);
        
        console.log(`🎁 Collected reward: ${reward.name} at (${reward.x}, ${reward.y})`);
        
        // Determine reward type and value based on reward properties or position
        const rewardValue = this.calculateRewardValue(reward);
        
        // Award rewards
        await playerProfile.awardPixelCoins(rewardValue.coins, `Found ${reward.name}`);
        await playerProfile.awardExperience(rewardValue.experience, `Discovered ${reward.name}`);
        
        // Check for reward collection badges
        await this.checkRewardBadges();
    }
    
    // Check and award reward collection badges
    async checkRewardBadges() {
        const rewardCount = gameState.collectedRewards.size;
        
        if (rewardCount === 1) {
            await playerProfile.awardBadge('first_reward', 'Collected first reward');
        }
        if (rewardCount === 5) {
            await playerProfile.awardBadge('treasure_hunter', 'Collected 5 rewards');
        }
        if (rewardCount === 10) {
            await playerProfile.awardBadge('pixel_collector', 'Collected 10 rewards');
        }
        if (rewardCount === 20) {
            await playerProfile.awardBadge('master_collector', 'Collected 20 rewards');
        }
        if (rewardCount === 50) {
            await playerProfile.awardBadge('legendary_hunter', 'Collected 50 rewards');
        }
    }

    // Calculate reward value based on reward properties
    calculateRewardValue(reward) {
        // Fixed values for all rewards
        return { 
            coins: 20,      // 20 gold per reward
            experience: 50  // 50 XP per reward
        };
    }
}

// Collision detection removed - define collisions in Tiled map editor

// Enhanced Animation Manager with proper sprite handling
class AnimationManager {
    constructor() {
      this.frameIndex = 0;
      this.animationTimer = 0;
      this.currentAnimation = 'idle';
      this.sprites = {};
      
      // Animation configurations - 3x3 grid with 7 frames
      this.animConfig = {
        idle: { frameRate: 6, expectedFrames: 7, spriteSheet: 'idle', frameWidth: 32, frameHeight: 32 },
        walk: { frameRate: 8, expectedFrames: 7, spriteSheet: 'walk', frameWidth: 32, frameHeight: 32 },
        attack: { frameRate: 12, expectedFrames: 7, spriteSheet: 'attack', frameWidth: 32, frameHeight: 32 },
        hurt: { frameRate: 10, expectedFrames: 7, spriteSheet: 'hurt', frameWidth: 32, frameHeight: 32 }
      };
      
      this.loadSprites();
    }
    
    async loadSprites() {
      // Get character type from game data (lowercase from database)
      const characterType = window.gameData?.user?.characterType || 'knight';
      
      console.log('🔍 DEBUG: window.gameData =', window.gameData);
      console.log('🔍 DEBUG: user object =', window.gameData?.user);
      console.log('🔍 DEBUG: characterType from DB =', characterType);
      
      // Capitalize first letter to match filename format (Knight, Mage, etc.)
      const capitalizedType = characterType.charAt(0).toUpperCase() + characterType.slice(1);
      
      // New clean filenames (no tiny prefix, no spaces)
      const fileVariations = [
        `${capitalizedType}.png`
      ];
      
      console.log(`🎮 Loading character sprite for: ${characterType}`);
      console.log(`📂 Capitalized type: ${capitalizedType}`);
      console.log(`📂 Trying filenames:`, fileVariations);
      
      // Try each filename variation
      let loaded = false;
      for (const fileName of fileVariations) {
        try {
          await this.loadCharacterSprite(fileName);
          console.log(`✅ Character sprite loaded: ${fileName}`);
          loaded = true;
          break;
        } catch (error) {
          console.warn(`⚠️ Failed to load ${fileName}, trying next...`);
        }
      }
      
      if (!loaded) {
        console.error('❌ Failed to load character sprite, using fallback');
        this.createFallbackSprite('idle');
      }
    }
    
    loadCharacterSprite(fileName) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const fullPath = `/images/characters/player/${fileName}`;
        
        console.log(`🔄 Attempting to load: ${fullPath}`);
        
        img.onload = () => {
          // Store the sprite sheet for all animations
          this.sprites['character'] = img;
          this.sprites['idle'] = img;
          this.sprites['walk'] = img;
          this.sprites['attack'] = img;
          this.sprites['hurt'] = img;
          
          console.log(`✅ Successfully loaded: ${fileName}`);
          console.log(`📐 Sprite dimensions: ${img.width}x${img.height}`);
          console.log(`🎨 Sprite loaded into memory, ready for animation`);
          resolve();
        };
        img.onerror = (error) => {
          console.error(`❌ Failed to load: ${fullPath}`);
          console.error(`Error details:`, error);
          reject(new Error(`Failed to load ${fileName}`));
        };
        img.src = fullPath;
      });
    }
    
    createFallbackSprite(name) {
      // Create a proper animated sprite sheet as fallback
      const config = this.animConfig[name] || this.animConfig['idle'];
      const frameCount = config.expectedFrames;
      const frameSize = 32; // Standard frame size
      
      const canvas = document.createElement('canvas');
      canvas.width = frameSize * frameCount; // Horizontal sprite sheet
      canvas.height = frameSize;
      const ctx = canvas.getContext('2d');
      
      // Create different frames for animation
      for (let i = 0; i < frameCount; i++) {
        const x = i * frameSize;
        
        // Base color varies by animation type
        let baseColor = '#00ff00';
        if (name === 'walk') baseColor = '#00cc00';
        if (name === 'attack') baseColor = '#ff6600';
        if (name === 'hurt') baseColor = '#ff0000';
        
        // Draw frame background
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, 0, frameSize, frameSize);
        
        // Add frame-specific variations for animation
        const variation = Math.sin((i / frameCount) * Math.PI * 2) * 0.3 + 0.7;
        ctx.globalAlpha = variation;
        
        // Draw animated elements
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4, 4, frameSize - 8, frameSize - 8);
        
        // Add eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 8, 10, 4, 4);
        ctx.fillRect(x + frameSize - 12, 10, 4, 4);
        
        // Add mouth (varies by frame for animation)
        const mouthY = 20 + Math.sin((i / frameCount) * Math.PI * 4) * 2;
        ctx.fillRect(x + 10, mouthY, frameSize - 20, 2);
        
        ctx.globalAlpha = 1;
      }
      
      // Convert to image
      const img = new Image();
      img.onload = () => {
        console.log(`✅ Created animated fallback sprite for: ${name} (${frameCount} frames, ${canvas.width}x${canvas.height})`);
      };
      img.src = canvas.toDataURL();
      this.sprites[name] = img;
    }
    
    loadSprite(name) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.sprites[name] = img;
          
          // Analyze the sprite sheet to determine frame count
          const config = this.animConfig[name];
          if (config && img.width > 0 && img.height > 0) {
            const aspectRatio = img.width / img.height;
            let actualFrames;
            
            if (aspectRatio > 2) {
              // Horizontal sprite sheet
              actualFrames = Math.floor(img.width / img.height); // Assume square frames
            } else {
              // Vertical or square sprite sheet
              actualFrames = Math.floor(img.height / img.width); // Assume square frames
            }
            
            // Update config with actual frame count if different
            if (actualFrames !== config.expectedFrames && actualFrames > 0) {
              console.log(`📊 Sprite ${name}: Expected ${config.expectedFrames} frames, found ${actualFrames} frames`);
              config.expectedFrames = actualFrames;
            }
          }
          
          console.log(`✅ Loaded ${name} sprite: ${img.width}x${img.height} (${config?.expectedFrames || 'unknown'} frames)`);
          resolve(img);
        };
        img.onerror = () => {
          console.error(`❌ Failed to load ${name} sprite`);
          // Create fallback sprite instead of rejecting
          this.createFallbackSprite(name);
          resolve(this.sprites[name]);
        };
        img.src = `/images/characters/player/${name}.png`;
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
    
    getCurrentFrame() {
      return this.frameIndex;
    }
    
    getCurrentSprite() {
      const config = this.animConfig[gameState.currentAnimation];
      if (!config || !this.sprites[config.spriteSheet]) {
        // Fallback to idle sprite, or create one if it doesn't exist
        if (!this.sprites['idle']) {
          this.createFallbackSprite('idle');
        }
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
        console.warn('Sprite not fully loaded yet:', sprite.src);
        return null;
      }
      
      // 3x3 grid sprite sheet - use only first 7 frames
      // Grid layout: 0,1,2 (row 0), 3,4,5 (row 1), 6,7,8 (row 2)
      // We use frames 0-6 (7 frames total)
      const gridCols = 3;
      const gridRows = 3;
      const totalFrames = 7; // Only use first 7 frames
      
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
  
  // Map data is now handled by MapRenderer module (map_render.js)
  
  // Remove old single sprite loading - now handled by AnimationManager

  let playerController;
  let animationManager;
  let collisionDebugSystem; // Collision debug system for visualizing collision layers
  let debugManager; // New DebugManager for collision debugging
  let hoveredTile = null; // Track hovered tile for visual feedback: {x, y, layer}
  
  // Note: collisionOverrides Map is declared at the top of the file for global access

  // Move player initialization before map loading
  let player = {
    x: 0,
    y: 0,
    width: 16,  // Default size
    height: 16, // Default size
    speed: 160
  };

  const camera = { x:0, y:0, width:canvas.width, height:canvas.height };

  // Debug key handling
  window.addEventListener('keydown', e => { 
    if (e.key==='c' || e.key==='C') {
      // Use the new toggleDebugMode if available, otherwise fallback to old method
      if (typeof window !== 'undefined' && window.toggleDebugMode && debugLogger) {
        // New unified toggle - handles both debug mode and collision debug
        const newState = window.toggleDebugMode(debugManager || collisionDebugSystem, 'game.js-C-key');
        debugLogOnce = !newState; // Reset log flag when turning off, set when turning on
      } else {
        // Fallback to old method if debug-logger.js not loaded
        gameState.debugMode = !gameState.debugMode;
        console.log('Debug mode:', gameState.debugMode ? 'ON' : 'OFF');
        debugLogOnce = !gameState.debugMode; // Reset log flag when turning off
        
        // Toggle collision debug visualization
        if (collisionDebugSystem) {
          collisionDebugSystem.toggle();
          console.log('Collision debug:', collisionDebugSystem.enabled ? 'ON' : 'OFF');
        }
      }
    }
    
    // Add TAB key handling for collision debug (consistent with tutorial)
    if (e.key === 'Tab') {
      e.preventDefault(); // Prevent tab navigation
      
      // Use the new toggleDebugMode if available, otherwise fallback to old method
      if (typeof window !== 'undefined' && window.toggleDebugMode && debugLogger) {
        // New unified toggle - handles both debug mode and collision debug
        const newState = window.toggleDebugMode(debugManager || collisionDebugSystem, 'game.js-TAB-key');
        debugLogOnce = !newState; // Reset log flag when turning off, set when turning on
      } else {
        // Fallback to old method if debug-logger.js not loaded
        gameState.debugMode = !gameState.debugMode;
        console.log('Debug mode (TAB):', gameState.debugMode ? 'ON' : 'OFF');
        debugLogOnce = !gameState.debugMode; // Reset log flag when turning off
        
        // Toggle collision debug visualization using the new DebugManager
        if (debugManager) {
          debugManager.toggleCollisionDebug();
          console.log('Collision debug (TAB):', gameState.debugMode ? 'ON' : 'OFF');
        } else if (collisionDebugSystem) {
          // Fallback to old system if DebugManager not available
          collisionDebugSystem.toggle();
          console.log('Collision debug (TAB fallback):', collisionDebugSystem.enabled ? 'ON' : 'OFF');
        }
      }
    }
  });

  // Mouse event handling for settings gear and quiz
  canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Handle collision tile toggle in debug mode (ADMIN ONLY - check first, before other UI)
    if (gameState.debugMode && !currentQuiz.active && !currentChallenge.active && !currentLesson.active) {
      // Check if user is admin
      if (!isUserAdmin()) {
        console.log('⚠️ Collision toggle is restricted to admin users only');
        if (gameState && typeof gameState.showNotification === 'function') {
          gameState.showNotification('⚠️ Admin access required to modify collision boxes', '#FF6B6B');
        }
        return; // Exit early if not admin
      }
      // Convert screen coordinates to world coordinates (account for zoom)
      const zoom = camera.zoom || 1.0;
      const worldX = (mouseX / zoom) + camera.x;
      const worldY = (mouseY / zoom) + camera.y;
      
      // Get map data
      const mapData = MapRenderer.getMapData();
      if (mapData && mapData.layers) {
        const tileW = mapData.tilewidth || 16;
        const tileH = mapData.tileheight || 16;
        const excludedLayers = ['ground', 'people'];
        
        // Check which tile was clicked
        const tileX = Math.floor(worldX / tileW);
        const tileY = Math.floor(worldY / tileH);
        
        let tileToggled = false;
        
        // Check all collision layers
        for (const layer of mapData.layers) {
          if (layer.type !== 'tilelayer') continue;
          if (excludedLayers.includes(layer.name.toLowerCase())) continue;
          
          // Get tile at position using MapRenderer
          let tileId = null;
          MapRenderer.forEachTileInLayer(layer, (id, tx, ty) => {
            if (tx === tileX && ty === tileY && id) {
              tileId = id;
            }
          });
          
          if (tileId) {
            // Create unique key for this tile
            const tileKey = `${tileX},${tileY},${layer.name}`;
            
            // Check current collision state
            const hasOverride = collisionOverrides.has(tileKey);
            const currentState = hasOverride ? collisionOverrides.get(tileKey) : true; // Default to collision ON
            
            // Toggle collision state
            const newState = !currentState;
            collisionOverrides.set(tileKey, newState);
            
            console.log(`🖱️ Toggled collision at (${tileX}, ${tileY}) on layer '${layer.name}'`);
            console.log(`   Tile ID: ${tileId} | Collision: ${newState ? 'ON ✓' : 'OFF ✗'}`);
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
    
    // Handle quiz option clicks
    if (currentQuiz.active) {
      const dialogWidth = Math.min(700, canvas.width - 40);
      const dialogHeight = 350;
      const dialogX = (canvas.width - dialogWidth) / 2;
      const dialogY = (canvas.height - dialogHeight) / 2;
      const optionStartY = dialogY + 130;
      const optionHeight = 45;
      const optionPadding = 10;
      const optionX = dialogX + 30;
      const optionWidth = dialogWidth - 60;
      
      // Check for "Run from Quest" button click (upper right)
      const runButtonWidth = 150;
      const runButtonHeight = 35;
      const runButtonX = dialogX + dialogWidth - runButtonWidth - 15;
      const runButtonY = dialogY + 10;
      
      if (mouseX >= runButtonX && mouseX <= runButtonX + runButtonWidth &&
          mouseY >= runButtonY && mouseY <= runButtonY + runButtonHeight) {
        // Close quiz and allow player to run away
        currentQuiz.active = false;
        canvas.style.cursor = 'default';
        playerController.showQuestNotification('You ran away from the quest!', '#e74c3c');
        console.log('🏃 Player ran away from quiz');
        return;
      }
      
      const question = currentQuiz.questions[currentQuiz.currentQuestion];
      if (question) {
        for (let i = 0; i < question.options.length; i++) {
          const optionY = optionStartY + (i * (optionHeight + optionPadding));
          
          if (mouseX >= optionX && mouseX <= optionX + optionWidth &&
              mouseY >= optionY && mouseY <= optionY + optionHeight) {
            // Answer selected
            const isCorrect = i === question.correctAnswer;
            
            // Track answer for quest history
            currentQuiz.userAnswers.push({
              question: question.question,
              options: question.options,
              correctAnswer: question.correctAnswer,
              userAnswer: i,
              isCorrect: isCorrect
            });
            
            if (isCorrect) {
              // Correct answer
              currentQuiz.correctAnswers++;
              await playerProfile.awardExperience(30, 'Correct quiz answer!');
              await playerProfile.awardPixelCoins(20, 'Quiz bonus!');
              playerController.showQuestNotification('Correct! +30 XP, +20 Gold', '#27ae60');
            } else {
              // Wrong answer
              currentQuiz.wrongAnswers++;
              playerProfile.experience = Math.max(0, playerProfile.experience - 15);
              playerController.showQuestNotification('Wrong answer! -15 XP', '#e74c3c');
            }
            
            // Move to next question
            currentQuiz.currentQuestion++;
            
            if (currentQuiz.currentQuestion >= currentQuiz.questions.length) {
              // Quiz completed
              currentQuiz.active = false;
              canvas.style.cursor = 'default';
              
              // Check if there's a coding challenge for this quest
              const quest = window.gameMapData?.quests.find(q => q.id === currentQuiz.questId);
              if (quest) {
                const questKey = (quest.name || '').toLowerCase().replace(/\s+/g, '');
                if (questChallenges[questKey]) {
                  // Start coding challenge
                  playerController.startCodingChallenge(quest);
                } else {
                  // No challenge, complete quest directly
                  await playerController.completeQuest(quest);
                }
              }
            }
            return;
          }
        }
      }
      return;
    }
    
    // Handle coding terminal button clicks
    if (currentChallenge.active) {
      const termWidth = Math.min(700, canvas.width - 60);
      const termHeight = 450;
      const termX = (canvas.width - termWidth) / 2;
      const termY = (canvas.height - termHeight) / 2;
      const buttonY = termY + termHeight - 50;
      const buttonHeight = 35;
      const buttonWidth = 120;
      
      // Run button
      const runX = termX + 20;
      if (mouseX >= runX && mouseX <= runX + buttonWidth &&
          mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
        // Execute code
        currentChallenge.output = [];
        try {
          // Create safe console.log capture
          const originalLog = console.log;
          const capturedOutput = [];
          console.log = (...args) => {
            capturedOutput.push(args.join(' '));
          };
          
          // Execute code in try-catch
          eval(currentChallenge.code);
          
          // Restore console.log
          console.log = originalLog;
          
          // Show output
          currentChallenge.output = capturedOutput.length > 0 ? capturedOutput : ['Code executed successfully!'];
          playerController.showQuestNotification('Code executed!', '#27ae60');
        } catch (error) {
          currentChallenge.output = [`Error: ${error.message}`];
          playerController.showQuestNotification('Code error!', '#e74c3c');
        }
        return;
      }
      
      // Submit button
      const submitX = termX + buttonWidth + 40;
      if (mouseX >= submitX && mouseX <= submitX + buttonWidth &&
          mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
        // Validate and complete challenge
        const outputStr = currentChallenge.output.join(' ');
        const isValid = currentChallenge.validation(currentChallenge.code, outputStr);
        
        if (isValid) {
          // Challenge passed!
          currentChallenge.active = false;
          const reward = currentChallenge.reward;
          await playerProfile.awardExperience(reward.xp, 'Coding challenge completed!');
          await playerProfile.awardPixelCoins(reward.gold, 'Challenge bonus!');
          playerController.showQuestNotification(`Challenge Complete! +${reward.xp} XP, +${reward.gold} Gold`, '#FFD700');
          
          // Complete the quest
          const quest = window.gameMapData?.quests.find(q => q.id === currentChallenge.questId);
          if (quest) {
            await playerController.completeQuest(quest);
          }
        } else {
          // Challenge failed
          playerController.showQuestNotification("Code doesn't meet requirements. Try again!", '#e74c3c');
        }
        return;
      }
      
      // Hint button
      const hintX = termX + buttonWidth * 2 + 60;
      if (mouseX >= hintX && mouseX <= hintX + buttonWidth &&
          mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
        // Toggle hint
        currentChallenge.showHint = !currentChallenge.showHint;
        return;
      }
      
      // Run from Quest button (upper right)
      const runFromButtonWidth = 130;
      const runFromButtonHeight = 30;
      const runFromX = termX + termWidth - runFromButtonWidth - 15;
      const runFromY = termY + 45;
      if (mouseX >= runFromX && mouseX <= runFromX + runFromButtonWidth &&
          mouseY >= runFromY && mouseY <= runFromY + runFromButtonHeight) {
        // Close challenge and allow player to run away
        currentChallenge.active = false;
        playerController.showQuestNotification('You ran away from the challenge!', '#e74c3c');
        console.log('🏃 Player ran away from coding challenge');
        return;
      }
      
      return;
    }
    
    // Check if clicked on top-right gear icon
    const gearX = canvas.width - 60;
    const gearY = 20;
    const gearSize = 40;
    const gearCenterX = gearX + gearSize/2;
    const gearCenterY = gearY + gearSize/2;
    const distance = Math.sqrt(Math.pow(mouseX - gearCenterX, 2) + Math.pow(mouseY - gearCenterY, 2));
    
    if (distance <= gearSize/2) {
      gameState.showSettings = !gameState.showSettings;
      gameState.settingsHoverOption = 0; // Reset hover
      console.log('Settings toggled via gear icon:', gameState.showSettings ? 'ON' : 'OFF');
    }
    
    // Handle settings menu clicks
    if (gameState.showSettings) {
      const menuWidth = 350;
      const menuHeight = 320;
      const centerX = canvas.width / 2 - menuWidth / 2;
      const centerY = canvas.height / 2 - menuHeight / 2;
      
      // Check volume slider click
      const sliderX = centerX + 20;
      const sliderY = centerY + 80;
      const sliderWidth = menuWidth - 40;
      const sliderHeight = 10;
      
      if (mouseX >= sliderX && mouseX <= sliderX + sliderWidth &&
          mouseY >= sliderY - 10 && mouseY <= sliderY + sliderHeight + 10) {
        // Calculate new volume based on click position
        const newVolume = (mouseX - sliderX) / sliderWidth;
        gameMusicManager.setVolume(newVolume);
        return;
      }
      
      const optionY = centerY + 130;
      const lineHeight = 35;
      
      // Check which option was clicked
      if (mouseX >= centerX + 20 && mouseX <= centerX + menuWidth - 20) {
        for (let i = 0; i < 4; i++) {
          const optionTop = optionY + (i * lineHeight) - 20;
          const optionBottom = optionY + (i * lineHeight) + 5;
          
          if (mouseY >= optionTop && mouseY <= optionBottom) {
            playerController.handleSettingsOption((i + 1).toString());
            break;
          }
        }
      }
    }
  });

  // Mouse move handling for settings hover and quiz options
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Collision tile hover detection in debug mode
    if (gameState.debugMode && !currentQuiz.active && !currentChallenge.active && !currentLesson.active && !gameState.showSettings) {
      // Account for camera zoom when converting screen to world coordinates
      const zoom = camera.zoom || 1.0;
      const worldX = (mouseX / zoom) + camera.x;
      const worldY = (mouseY / zoom) + camera.y;
      
      const mapData = MapRenderer.getMapData();
      if (mapData && mapData.layers) {
        const tileW = mapData.tilewidth || 16;
        const tileH = mapData.tileheight || 16;
        const excludedLayers = ['ground', 'people'];
        
        const tileX = Math.floor(worldX / tileW);
        const tileY = Math.floor(worldY / tileH);
        
        hoveredTile = null; // Reset
        
        // Check if hovering over a collision tile
        for (const layer of mapData.layers) {
          if (layer.type !== 'tilelayer') continue;
          if (excludedLayers.includes(layer.name.toLowerCase())) continue;
          
          let tileId = null;
          MapRenderer.forEachTileInLayer(layer, (id, tx, ty) => {
            if (tx === tileX && ty === tileY && id) {
              tileId = id;
            }
          });
          
          if (tileId) {
            hoveredTile = { x: tileX, y: tileY, layer: layer.name, tileId };
            break;
          }
        }
        
        canvas.style.cursor = hoveredTile ? 'pointer' : 'default';
        return; // Don't check other hover states if in debug mode
      }
    }
    
    // Quiz hover detection
    if (currentQuiz.active) {
      const dialogWidth = Math.min(700, canvas.width - 40);
      const dialogHeight = 350;
      const dialogX = (canvas.width - dialogWidth) / 2;
      const dialogY = (canvas.height - dialogHeight) / 2;
      const optionStartY = dialogY + 130;
      const optionHeight = 45;
      const optionPadding = 10;
      const optionX = dialogX + 30;
      const optionWidth = dialogWidth - 60;
      
      currentQuiz.hoveredOption = -1;
      
      const question = currentQuiz.questions[currentQuiz.currentQuestion];
      if (question) {
        for (let i = 0; i < question.options.length; i++) {
          const optionY = optionStartY + (i * (optionHeight + optionPadding));
          
          if (mouseX >= optionX && mouseX <= optionX + optionWidth &&
              mouseY >= optionY && mouseY <= optionY + optionHeight) {
            currentQuiz.hoveredOption = i;
            canvas.style.cursor = 'pointer';
            break;
          }
        }
        
        if (currentQuiz.hoveredOption === -1) {
          canvas.style.cursor = 'default';
        }
      }
      return;
    }
    
    // Settings hover detection
    if (!gameState.showSettings) return;
    
    const menuWidth = 350;
    const menuHeight = 320;
    const centerX = canvas.width / 2 - menuWidth / 2;
    const centerY = canvas.height / 2 - menuHeight / 2;
    const optionY = centerY + 130;
    const lineHeight = 35;
    
    gameState.settingsHoverOption = 0; // Reset hover
    
    // Check which option is being hovered
    if (mouseX >= centerX + 20 && mouseX <= centerX + menuWidth - 20) {
      for (let i = 0; i < 4; i++) {
        const optionTop = optionY + (i * lineHeight) - 20;
        const optionBottom = optionY + (i * lineHeight) + 5;
        
        if (mouseY >= optionTop && mouseY <= optionBottom) {
          gameState.settingsHoverOption = i + 1;
          break;
        }
      }
    }
  });

  function resizeCanvas(){
    const navbar = document.querySelector('.navbar');
    const top = navbar ? navbar.getBoundingClientRect().height : 0;
    canvas.width = window.innerWidth;
    canvas.height = Math.max(200, window.innerHeight - top);
    camera.width = canvas.width;
    camera.height = canvas.height;
    // Set camera zoom (scale factor)
    camera.zoom = 2.0; // 2x zoom - closer to player
  }
  window.addEventListener('resize', resizeCanvas);

  async function loadMap() {
    try {
        // Use MapRenderer module to load map
        await MapRenderer.loadMap();
        
        // Get map data from renderer
        const mapData = MapRenderer.getMapData();
        
        // Initialize map properties
        const tileW = mapData.tilewidth || 16;
        const tileH = mapData.tileheight || tileW;
        
        // Initialize player after map loads - make player MUCH larger and more visible
        player = {
            x: 32,
            y: 32,
            width: tileW * 6,  // Make player 6x larger (96x96 pixels) - much more visible!
            height: tileH * 6, // Make player 6x larger (96x96 pixels)
            speed: 300 // Increased speed for better responsiveness with larger size
        };

        // Find safe spawn point (collision detection removed - using map-defined spawn points only)
        const spawn = MapRenderer.findPlayerStart();
        player.x = spawn.x;
        player.y = spawn.y;
        
        // Process NPCs and quests from map
        MapRenderer.processMapObjects();

        // Set canvas size based on map
        resizeCanvas();
        
        return true;
    } catch (error) {
        console.error('❌ Map loading failed:', error);
        throw error;
    }
}

  // forEachTileInLayer and drawMap are now in MapRenderer module

  // drawCollisionDebug and tileAt are now in MapRenderer module

  // Advanced collision detection for different entity types
  function checkEntityCollision(entity1, entity2) {
    const bounds1 = getCollisionBounds(entity1);
    const bounds2 = getCollisionBounds(entity2);
    return checkObjectCollision(bounds1, bounds2);
  }

  // Check collision with all NPCs
  function checkNPCCollisions(playerBounds) {
    if (!window.gameMapData?.npcs) return false;
    
    for (const npc of window.gameMapData.npcs) {
      const npcBounds = getCollisionBounds(npc);
      if (checkObjectCollision(playerBounds, npcBounds)) {
        return true;
      }
    }
    return false;
  }

  // Check collision with quests (they shouldn't block movement but can trigger interactions)
  function checkQuestCollisions(playerBounds) {
    if (!window.gameMapData?.quests) return [];
    
    const nearbyQuests = [];
    for (const quest of window.gameMapData.quests) {
      const questBounds = getCollisionBounds(quest);
      if (checkObjectCollision(playerBounds, questBounds)) {
        nearbyQuests.push(quest);
      }
    }
    return nearbyQuests;
  }

  // Note: Collision detection has been removed - collisions are defined in Tiled map editor

  let lastUpdateTime = 0;
  
  function update(currentTime = 0){
    const deltaTime = currentTime - lastUpdateTime || 16;
    lastUpdateTime = currentTime;
    
    if (playerController) playerController.update(deltaTime);
    if (animationManager) animationManager.update(deltaTime);
    if (debugManager) debugManager.update(player, gameState); // Add DebugManager update
    floatingTextManager.update(deltaTime);
    updateCamera();
  }

  // Cache camera calculations
  let lastCameraUpdate = 0;
  const cameraUpdateInterval = 16; // Update camera max 60fps
  
  function updateCamera(){
    const now = performance.now();
    if (now - lastCameraUpdate < cameraUpdateInterval) return;
    lastCameraUpdate = now;
    
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    // Apply zoom factor
    const zoom = camera.zoom || 1.0;
    
    // Direct camera centering - no animation, just focus on player
    camera.x = Math.round(playerCenterX - (canvas.width / zoom) / 2);
    camera.y = Math.round(playerCenterY - (canvas.height / zoom) / 2);
    
    const mapData = MapRenderer.getMapData();
    if(mapData && !mapData.infinite && mapData.width && mapData.height){
      const mapPxW = mapData.width * mapData.tilewidth;
      const mapPxH = mapData.height * (mapData.tileheight||mapData.tilewidth);
      camera.x = Math.max(0, Math.min(camera.x, Math.max(0, mapPxW - canvas.width)));
      camera.y = Math.max(0, Math.min(camera.y, Math.max(0, mapPxH - canvas.height)));
    }
  }

  // Draw collision debug overlay for all layers except 'ground' and 'people'
  let debugLogOnce = false;
  function drawCollisionDebugOverlay() {
    const mapData = MapRenderer.getMapData();
    if (!mapData || !mapData.layers) {
      if (!debugLogOnce) {
        console.warn('⚠️ No map data available for collision debug');
        debugLogOnce = true;
      }
      return;
    }
    
    const tileW = mapData.tilewidth || 16;
    const tileH = mapData.tileheight || 16;
    const excludedLayers = ['ground', 'people'];
    
    // Calculate visible tile range for culling
    const startTileX = Math.floor(camera.x / tileW) - 1;
    const startTileY = Math.floor(camera.y / tileH) - 1;
    const endTileX = Math.ceil((camera.x + canvas.width) / tileW) + 1;
    const endTileY = Math.ceil((camera.y + canvas.height) / tileH) + 1;
    
    let tilesDrawn = 0;
    let layersProcessed = [];
    
    // Draw collision overlay for each layer
    for (const layer of mapData.layers) {
      if (layer.type !== 'tilelayer') continue;
      
      const layerName = layer.name.toLowerCase();
      if (excludedLayers.includes(layerName)) {
        continue;
      }
      
      layersProcessed.push(layer.name);
      
      // Use MapRenderer's forEachTileInLayer utility
      MapRenderer.forEachTileInLayer(layer, (tileId, tx, ty) => {
        if (!tileId) return; // Skip empty tiles
        
        // Skip tiles outside visible range (culling)
        if (tx < startTileX || tx > endTileX || ty < startTileY || ty > endTileY) return;
        
        const wx = tx * tileW;
        const wy = ty * tileH;
        const screenX = Math.round(wx - camera.x);
        const screenY = Math.round(wy - camera.y);
        
        // Check collision override status
        const tileKey = `${tx},${ty},${layer.name}`;
        const hasOverride = collisionOverrides.has(tileKey);
        const collisionEnabled = hasOverride ? collisionOverrides.get(tileKey) : true;
        
        // Check if this is the hovered tile
        const isHovered = hoveredTile && hoveredTile.x === tx && hoveredTile.y === ty && hoveredTile.layer === layer.name;
        
        if (isHovered) {
          // Draw yellow highlight for hovered tile
          ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
          ctx.fillRect(screenX, screenY, tileW, tileH);
          ctx.strokeStyle = 'rgba(255, 255, 0, 1.0)';
          ctx.lineWidth = 3;
          ctx.strokeRect(screenX, screenY, tileW, tileH);
        } else if (!collisionEnabled) {
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
          // Draw semi-transparent green overlay for tiles with collision
          ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
          ctx.fillRect(screenX, screenY, tileW, tileH);
          
          // Draw border
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, tileW, tileH);
        }
        
        tilesDrawn++;
      });
    }
    
    // Log once when first enabled
    if (!debugLogOnce) {
      debugLogOnce = true;
      if (tilesDrawn === 0) {
        console.warn('⚠️ No collision tiles found!');
        console.log('Available layers:', mapData.layers.map(l => l.name + ' (' + l.type + ')'));
        console.log('Layers processed:', layersProcessed);
      } else {
        console.log(`✅ Collision debug active - showing ${tilesDrawn} tiles from layers:`, layersProcessed);
      }
    }
    
  }

  function render(){
    // Use fillRect for better performance than clearRect
    ctx.fillStyle = '#000000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    
    // Apply camera zoom
    const zoom = camera.zoom || 1.0;
    ctx.save();
    ctx.scale(zoom, zoom);
    
    MapRenderer.drawMap(ctx, camera, canvas);
    
    // Draw player sprite with new animation system
    if (animationManager && animationManager.getCurrentSprite()) {
      drawAnimatedPlayer();
    } else {
      // Use the enhanced fallback player drawing
      drawFallbackPlayer();
    }
    
    // Draw NPCs, quests, and rewards
    MapRenderer.drawMapObjects(ctx, camera, canvas, gameState, player);
    
    // Draw collision debug overlay if debug mode is enabled
    if (gameState.debugMode) {
      drawCollisionDebugOverlay();
      
      // Draw player sprite bounds (full size) in light red
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        player.x - camera.x,
        player.y - camera.y,
        player.width,
        player.height
      );
      
      // Draw actual collision hitbox (reduced size) in bright red
      const hitboxInset = 30; // Must match the value in checkCollisionAtPosition
      const hitboxX = player.x + hitboxInset;
      const hitboxY = player.y + hitboxInset;
      const hitboxWidth = player.width - (hitboxInset * 2);
      const hitboxHeight = player.height - (hitboxInset * 2);
      
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hitboxX - camera.x,
        hitboxY - camera.y,
        hitboxWidth,
        hitboxHeight
      );
      
      // Draw player center point
      ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(
        player.x - camera.x + player.width / 2,
        player.y - camera.y + player.height / 2,
        4,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    
    ctx.restore(); // Restore scale before drawing HUD
    
    // Draw collision debug indicator (after ctx.restore so it's not affected by zoom)
    if (gameState.debugMode) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.font = 'bold 14px Arial';
      const text = 'Debug Mode: ON (TAB/C to toggle)';
      ctx.strokeText(text, 10, canvas.height - 10);
      ctx.fillText(text, 10, canvas.height - 10);
      
      // Draw hovered tile info
      if (hoveredTile) {
        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, canvas.height - 90, 250, 70);
        
        ctx.fillStyle = 'rgba(255, 255, 0, 1.0)';
        ctx.fillText(`Hovered Tile:`, 15, canvas.height - 75);
        ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.fillText(`  Position: (${hoveredTile.x}, ${hoveredTile.y})`, 15, canvas.height - 60);
        ctx.fillText(`  Layer: ${hoveredTile.layer}`, 15, canvas.height - 45);
        ctx.fillText(`  Tile ID: ${hoveredTile.tileId}`, 15, canvas.height - 30);
      }
    }
    
    drawHUD();
    
    // Draw lesson dialogue if active
    if (currentLesson.active) {
      drawLessonDialogue();
    }
    
    // Draw quiz dialogue if active
    if (currentQuiz.active) {
      drawQuizDialogue();
    }
    
    // Draw coding challenge terminal if active
    if (currentChallenge.active) {
      drawCodingTerminal();
    }
    
    // Draw Settings Menu
    drawSettings();
    
    // Draw floating text
    floatingTextManager.render(ctx);
    
    // Draw quest objective arrow
    drawQuestObjectiveArrow();
    
    // Draw top-right gear icon
    drawGearIcon();
    
    if(gameState.debugMode){ 
      // Player bounding box
      ctx.strokeStyle='rgba(255,0,0,0.9)'; 
      ctx.strokeRect(Math.round(player.x-camera.x), Math.round(player.y-camera.y), player.width, player.height);
      
      // Camera center crosshair
      ctx.strokeStyle = 'rgba(0,255,0,0.8)';
      ctx.lineWidth = 2;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY);
      ctx.lineTo(centerX + 10, centerY);
      ctx.moveTo(centerX, centerY - 10);
      ctx.lineTo(centerX, centerY + 10);
      ctx.stroke();
      
      // Player center indicator
      const playerScreenX = Math.round(player.x - camera.x + player.width / 2);
      const playerScreenY = Math.round(player.y - camera.y + player.height / 2);
      ctx.fillStyle = 'rgba(255,255,0,0.8)';
      ctx.beginPath();
      ctx.arc(playerScreenX, playerScreenY, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText(`Pos: ${Math.round(player.x)}, ${Math.round(player.y)}`, 10, 20);
      ctx.fillText(`Cam: ${Math.round(camera.x)}, ${Math.round(camera.y)}`, 10, 35);
      ctx.fillText(`Animation: ${gameState.currentAnimation}`, 10, 50);
      ctx.fillText(`Canvas: ${canvas.width}x${canvas.height}`, 10, 65);
      ctx.fillText(`Player on screen: ${playerScreenX}, ${playerScreenY}`, 10, 80);
      ctx.fillText(`Center offset: ${playerScreenX - centerX}, ${playerScreenY - centerY}`, 10, 95);
      ctx.fillText(`FPS: ${getFPS()}`, 10, 110);
      ctx.fillText(`Controls: WASD=move, E=interact, F=collect, P=stats, M=settings`, 10, 125);
      ctx.fillText(`Debug: C=debug`, 10, 140);
      
      // Profile information
      ctx.fillText(`Profile:`, 10, 170);
      ctx.fillText(`  Level: ${playerProfile.level} (${playerProfile.experience} XP)`, 10, 185);
      ctx.fillText(`  PixelCoins: ${playerProfile.pixelCoins}`, 10, 200);
      ctx.fillText(`  Badges: ${playerProfile.badges.length}`, 10, 215);
      ctx.fillText(`  Rewards: ${gameState.collectedRewards.size}`, 10, 230);
    }
  }

  // drawTileFromGid is now in MapRenderer module

  function drawLessonDialogue() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dialog box dimensions (increased height for code panel)
    const dialogWidth = Math.min(600, canvas.width - 40);
    const dialogHeight = 280;
    const dialogX = (canvas.width - dialogWidth) / 2;
    const dialogY = canvas.height - dialogHeight - 80;
    
    // NPC image area (left side)
    const imageSize = 80;
    const imageX = dialogX + 15;
    const imageY = dialogY + 35;
    
    // Text area (right side)
    const textX = imageX + imageSize + 20;
    const textWidth = dialogWidth - imageSize - 60;
    
    // Background
    ctx.fillStyle = 'rgba(20, 30, 50, 0.95)';
    ctx.fillRect(dialogX, dialogY, dialogWidth, dialogHeight);
    
    // Border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.strokeRect(dialogX, dialogY, dialogWidth, dialogHeight);
    
    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(currentLesson.title, dialogX + dialogWidth/2, dialogY + 25);
    
    // Progress indicator
    const progress = `${currentLesson.currentPart + 1} / ${currentLesson.parts.length}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(progress, dialogX + dialogWidth - 15, dialogY + 25);
    
    // Draw NPC image if loaded
    if (currentLesson.npcImage && currentLesson.npcImage.complete) {
      ctx.fillStyle = 'rgba(40, 50, 70, 0.8)';
      ctx.fillRect(imageX - 5, imageY - 5, imageSize + 10, imageSize + 10);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.strokeRect(imageX - 5, imageY - 5, imageSize + 10, imageSize + 10);
      ctx.drawImage(currentLesson.npcImage, imageX, imageY, imageSize, imageSize);
    } else {
      // Placeholder
      ctx.fillStyle = 'rgba(40, 50, 70, 0.8)';
      ctx.fillRect(imageX, imageY, imageSize, imageSize);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.strokeRect(imageX, imageY, imageSize, imageSize);
      ctx.fillStyle = '#FFD700';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('NPC', imageX + imageSize/2, imageY + imageSize/2 + 5);
    }
    
    // Get current part (support both string and object format) with safety checks
    const playerName = playerProfile.inGameName || 'Adventurer';
    const currentPart = currentLesson.parts && currentLesson.parts[currentLesson.currentPart];
    
    // Safety check for undefined parts
    if (!currentPart) {
      console.warn('Current lesson part is undefined');
      return;
    }
    
    const isObject = typeof currentPart === 'object' && currentPart !== null;
    const currentText = (isObject ? (currentPart.text || '') : (currentPart || '')).replace(/{name}/g, playerName);
    const currentCode = isObject ? currentPart.code : null;
    
    // Adjust layout if code is present
    const hasCode = !!currentCode;
    const textAreaHeight = hasCode ? 80 : 180;
    const codeAreaHeight = hasCode ? 100 : 0;
    
    // Draw dialogue text
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // Word wrap for dialogue text (with safety check)
    const words = (currentText || '').split(' ');
    let line = '';
    let y = dialogY + 50;
    const lineHeight = 18;
    const maxLines = hasCode ? 4 : 10;
    let lineCount = 0;
    
    for (let i = 0; i < words.length && lineCount < maxLines; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > textWidth && i > 0) {
        ctx.fillText(line, textX, y);
        line = words[i] + ' ';
        y += lineHeight;
        lineCount++;
      } else {
        line = testLine;
      }
    }
    if (lineCount < maxLines) {
      ctx.fillText(line, textX, y);
    }
    
    // Draw code panel if code exists
    if (hasCode) {
      const codeX = dialogX + 15;
      const codeY = dialogY + 130;
      const codeWidth = dialogWidth - 30;
      const codeHeight = 120;
      
      // Code panel background (dark terminal style)
      ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
      ctx.fillRect(codeX, codeY, codeWidth, codeHeight);
      
      // Code panel border
      ctx.strokeStyle = '#4A90E2';
      ctx.lineWidth = 2;
      ctx.strokeRect(codeX, codeY, codeWidth, codeHeight);
      
      // Code panel header
      ctx.fillStyle = 'rgba(74, 144, 226, 0.3)';
      ctx.fillRect(codeX, codeY, codeWidth, 20);
      ctx.fillStyle = '#4A90E2';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('💻 Code Example', codeX + 8, codeY + 14);
      
      // Draw code with basic syntax highlighting
      ctx.save(); // Save context state
      
      // Create clipping region to prevent overflow
      ctx.beginPath();
      ctx.rect(codeX, codeY, codeWidth, codeHeight);
      ctx.clip();
      
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      const codeLines = (currentCode || '').split('\n');
      let codeLineY = codeY + 35;
      const maxCodeWidth = codeWidth - 20; // Leave padding
      
      for (let i = 0; i < codeLines.length && i < 5; i++) {
        let codeLine = codeLines[i];
        
        // Truncate line if too long
        ctx.font = '11px monospace';
        while (ctx.measureText(codeLine).width > maxCodeWidth && codeLine.length > 0) {
          codeLine = codeLine.slice(0, -1);
        }
        
        // Simple syntax highlighting
        if (codeLine.trim().startsWith('//')) {
          // Comments in green
          ctx.fillStyle = '#6A9955';
          ctx.fillText(codeLine, codeX + 10, codeLineY);
        } else if (codeLine.includes('function') || codeLine.includes('const') || codeLine.includes('let') || codeLine.includes('var')) {
          // Keywords in purple/blue
          const parts = codeLine.split(/\\b(function|const|let|var|return)\\b/);
          let xOffset = codeX + 10;
          for (const part of parts) {
            if (xOffset + ctx.measureText(part).width > codeX + codeWidth - 10) break; // Stop if overflow
            
            if (['function', 'const', 'let', 'var', 'return'].includes(part)) {
              ctx.fillStyle = '#569CD6';
              ctx.fillText(part, xOffset, codeLineY);
            } else {
              ctx.fillStyle = '#D4D4D4';
              ctx.fillText(part, xOffset, codeLineY);
            }
            xOffset += ctx.measureText(part).width;
          }
        } else {
          // Default code color
          ctx.fillStyle = '#D4D4D4';
          ctx.fillText(codeLine, codeX + 10, codeLineY);
        }
        
        codeLineY += 14;
      }
      
      ctx.restore(); // Restore context state (removes clipping)
    }
    
    // Instructions
    ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    const isLastPart = currentLesson.currentPart >= currentLesson.parts.length - 1;
    const instruction = isLastPart ? 'Press Enter to complete' : 'Press Enter to continue';
    ctx.fillText(instruction, dialogX + dialogWidth/2, dialogY + dialogHeight - 15);
  }

  function drawQuizDialogue() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dialog box dimensions
    const dialogWidth = Math.min(700, canvas.width - 40);
    const dialogHeight = 350;
    const dialogX = (canvas.width - dialogWidth) / 2;
    const dialogY = (canvas.height - dialogHeight) / 2;
    
    // Background
    ctx.fillStyle = 'rgba(20, 30, 50, 0.95)';
    ctx.fillRect(dialogX, dialogY, dialogWidth, dialogHeight);
    
    // Border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.strokeRect(dialogX, dialogY, dialogWidth, dialogHeight);
    
    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(currentQuiz.title, dialogX + dialogWidth/2, dialogY + 30);
    
    // Progress indicator
    const progress = `Question ${currentQuiz.currentQuestion + 1} / ${currentQuiz.questions.length}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px Arial';
    ctx.fillText(progress, dialogX + dialogWidth/2, dialogY + 55);
    
    // Current question
    const question = currentQuiz.questions[currentQuiz.currentQuestion];
    if (!question) return;
    
    // Question text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(question.question, dialogX + dialogWidth/2, dialogY + 90);
    
    // Answer options
    const optionStartY = dialogY + 130;
    const optionHeight = 45;
    const optionPadding = 10;
    
    question.options.forEach((option, index) => {
      const optionY = optionStartY + (index * (optionHeight + optionPadding));
      const optionX = dialogX + 30;
      const optionWidth = dialogWidth - 60;
      
      const isHovered = currentQuiz.hoveredOption === index;
      
      // Option background
      ctx.fillStyle = isHovered ? 'rgba(74, 144, 226, 0.3)' : 'rgba(40, 50, 70, 0.8)';
      ctx.fillRect(optionX, optionY, optionWidth, optionHeight);
      
      // Option border
      ctx.strokeStyle = isHovered ? '#FFD700' : '#4A90E2';
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.strokeRect(optionX, optionY, optionWidth, optionHeight);
      
      // Option letter (A, B, C, D)
      ctx.fillStyle = isHovered ? '#FFD700' : '#4A90E2';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'left';
      const letter = String.fromCharCode(65 + index); // A, B, C, D
      ctx.fillText(`${letter}.`, optionX + 15, optionY + 28);
      
      // Option text
      ctx.fillStyle = isHovered ? '#FFD700' : '#ffffff';
      ctx.font = isHovered ? 'bold 14px Arial' : '14px Arial';
      ctx.fillText(option, optionX + 50, optionY + 28);
    });
    
    // Run from Quest button (upper right)
    const runButtonWidth = 150;
    const runButtonHeight = 35;
    const runButtonX = dialogX + dialogWidth - runButtonWidth - 15;
    const runButtonY = dialogY + 10;
    
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(runButtonX, runButtonY, runButtonWidth, runButtonHeight);
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    ctx.strokeRect(runButtonX, runButtonY, runButtonWidth, runButtonHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏃 Run from Quest', runButtonX + runButtonWidth/2, runButtonY + 22);
    
    // Instructions
    ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Hover and click to select your answer', dialogX + dialogWidth/2, dialogY + dialogHeight - 20);
  }

  function drawCodingTerminal() {
    // Safety check
    if (!currentChallenge || !currentChallenge.active) return;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Terminal dimensions
    const termWidth = Math.min(700, canvas.width - 60);
    const termHeight = 450;
    const termX = (canvas.width - termWidth) / 2;
    const termY = (canvas.height - termHeight) / 2;
    
    // Terminal background (dark like VS Code)
    ctx.fillStyle = 'rgba(30, 30, 30, 0.98)';
    ctx.fillRect(termX, termY, termWidth, termHeight);
    
    // Terminal border
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 3;
    ctx.strokeRect(termX, termY, termWidth, termHeight);
    
    // Title bar
    ctx.fillStyle = 'rgba(74, 144, 226, 0.3)';
    ctx.fillRect(termX, termY, termWidth, 35);
    ctx.fillStyle = '#4A90E2';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`💻 ${currentChallenge.title || 'Coding Challenge'}`, termX + 15, termY + 23);
    
    // Description area
    const descY = termY + 50;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    
    // Word wrap description (with safety check)
    const description = currentChallenge.description || 'Complete the coding challenge';
    const words = description.split(' ');
    let line = '';
    let y = descY;
    const maxWidth = termWidth - 40;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, termX + 20, y);
        line = words[i] + ' ';
        y += 18;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, termX + 20, y);
    
    // Code editor area
    const editorY = termY + 120;
    const editorHeight = 200;
    
    // Editor background
    ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
    ctx.fillRect(termX + 15, editorY, termWidth - 30, editorHeight);
    
    // Editor border
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.strokeRect(termX + 15, editorY, termWidth - 30, editorHeight);
    
    // Line numbers and code (with safety check)
    ctx.font = '13px monospace';
    const code = currentChallenge.code || '// Write your code here\n';
    const codeLines = code.split('\n');
    let codeY = editorY + 25;
    let lastLineY = codeY;
    let lastLineText = '';
    
    for (let i = 0; i < codeLines.length; i++) {
      // Line number
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'right';
      ctx.fillText((i + 1).toString(), termX + 40, codeY);
      
      // Code line
      ctx.fillStyle = '#D4D4D4';
      ctx.textAlign = 'left';
      ctx.fillText(codeLines[i], termX + 50, codeY);
      
      // Track last line for cursor
      lastLineY = codeY;
      lastLineText = codeLines[i];
      
      codeY += 18;
    }
    
    // Draw blinking cursor at end of last line
    const cursorBlink = Math.floor(Date.now() / 500) % 2; // Blink every 500ms
    if (cursorBlink === 0) {
      ctx.fillStyle = '#FFD700';
      const cursorX = termX + 50 + ctx.measureText(lastLineText).width;
      ctx.fillRect(cursorX, lastLineY - 12, 2, 14);
    }
    
    // Output area
    const outputY = editorY + editorHeight + 15;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('OUTPUT:', termX + 20, outputY);
    
    // Output text (with safety check)
    ctx.fillStyle = '#00FF00';
    ctx.font = '12px monospace';
    let outY = outputY + 20;
    const output = currentChallenge.output || [];
    for (let i = 0; i < output.length && i < 3; i++) {
      ctx.fillText(output[i], termX + 20, outY);
      outY += 16;
    }
    
    // Buttons
    const buttonY = termY + termHeight - 50;
    const buttonHeight = 35;
    const buttonWidth = 120;
    
    // Run button
    const runX = termX + 20;
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(runX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.strokeRect(runX, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('▶ Run Code', runX + buttonWidth/2, buttonY + 22);
    
    // Submit button
    const submitX = termX + buttonWidth + 40;
    ctx.fillStyle = '#3498db';
    ctx.fillRect(submitX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#5dade2';
    ctx.lineWidth = 2;
    ctx.strokeRect(submitX, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('✓ Submit', submitX + buttonWidth/2, buttonY + 22);
    
    // Hint button
    const hintX = termX + buttonWidth * 2 + 60;
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(hintX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(hintX, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('💡 Hint', hintX + buttonWidth/2, buttonY + 22);
    
    // Show hint if requested
    if (currentChallenge.showHint) {
      ctx.fillStyle = '#f39c12';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Hint: ${currentChallenge.hint}`, termX + 20, buttonY - 10);
    }
    
    // Run from Quest button (upper right)
    const runFromButtonWidth = 130;
    const runFromButtonHeight = 30;
    const runFromX = termX + termWidth - runFromButtonWidth - 15;
    const runFromY = termY + 45;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(runFromX, runFromY, runFromButtonWidth, runFromButtonHeight);
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    ctx.strokeRect(runFromX, runFromY, runFromButtonWidth, runFromButtonHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏃 Run Away', runFromX + runFromButtonWidth/2, runFromY + 19);
    
    // Instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Type to edit code | ENTER for new line | BACKSPACE to delete', termX + termWidth/2, termY + termHeight - 10);
  }

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

  function drawQuestObjectiveArrow() {
    if (!questObjectiveArrow.active || !player) return;
    
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    // Calculate direction to target
    const dx = questObjectiveArrow.targetX - playerCenterX;
    const dy = questObjectiveArrow.targetY - playerCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Don't show arrow if very close to target
    if (distance < 50) return;
    
    // Normalize direction
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Arrow position (offset from player)
    const arrowDistance = 40;
    const arrowX = playerCenterX + dirX * arrowDistance - camera.x;
    const arrowY = playerCenterY + dirY * arrowDistance - camera.y;
    
    // Calculate arrow angle
    const angle = Math.atan2(dy, dx);
    
    // Draw arrow
    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);
    
    // Arrow body
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-5, -8);
    ctx.lineTo(-5, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Pulsing effect
    const pulse = Math.sin(Date.now() / 200) * 0.2 + 1;
    ctx.globalAlpha = pulse;
    
    // Distance text
    ctx.rotate(-angle);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(`${Math.floor(distance)}m`, 0, -15);
    ctx.fillText(`${Math.floor(distance)}m`, 0, -15);
    
    ctx.restore();
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
    const menuWidth = 350;
    const menuHeight = 320;
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
    
    // Volume Control Section
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Music Volume', centerX + 20, centerY + 70);
    
    // Volume slider background
    const sliderX = centerX + 20;
    const sliderY = centerY + 80;
    const sliderWidth = menuWidth - 40;
    const sliderHeight = 10;
    
    ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.fillRect(sliderX, sliderY, sliderWidth, sliderHeight);
    
    // Volume slider fill
    const volumePercent = gameMusicManager.getVolume();
    ctx.fillStyle = '#4A90E2';
    ctx.fillRect(sliderX, sliderY, sliderWidth * volumePercent, sliderHeight);
    
    // Volume slider handle
    const handleX = sliderX + (sliderWidth * volumePercent);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(handleX, sliderY + sliderHeight/2, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Volume percentage text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(volumePercent * 100) + '%', centerX + menuWidth/2, sliderY + sliderHeight/2 + 4);
    
    // Menu options
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    
    const optionY = centerY + 130;
    const lineHeight = 35;
    
    const options = [
      { text: 'Save Game', color: '#00FF00' },
      { text: 'Load Game', color: '#00BFFF' },
      { text: 'Delete Save', color: '#FF6B6B' },
      { text: 'Exit Game', color: '#FF4444' }
    ];
    
    // Draw each option with hover effect
    for (let i = 0; i < options.length; i++) {
      const isHovered = gameState.settingsHoverOption === i + 1;
      const yPos = optionY + (i * lineHeight);
      
      // Draw hover background
      if (isHovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(centerX + 10, yPos - 20, menuWidth - 20, 25);
      }
      
      // Draw option text
      ctx.fillStyle = isHovered ? '#FFFFFF' : options[i].color;
      ctx.fillText(options[i].text, centerX + 20, yPos);
      
      // Draw arrow for hovered option
      if (isHovered) {
        ctx.fillStyle = '#FFD700';
        ctx.fillText('→', centerX + 250, yPos);
      }
    }
    
    // Instructions
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Hover and click to select option', centerX + menuWidth/2, centerY + menuHeight - 40);
    ctx.fillText('Press ESC, M, or click gear to close', centerX + menuWidth/2, centerY + menuHeight - 20);
    
    // Reset text alignment
    ctx.textAlign = 'left';
  }

  // drawMapObjects is now in MapRenderer module

  function drawAnimatedPlayer(){
    if (!animationManager) {
      console.warn('🚫 AnimationManager not available, using fallback');
      drawFallbackPlayer();
      return;
    }
    
    const frameData = animationManager.getFrameData();
    if (!frameData) {
      console.warn('🚫 No frame data available, using fallback');
      drawFallbackPlayer();
      return;
    }
    
    const { sprite, frameWidth, frameHeight, sourceX, sourceY } = frameData;
    
    // Validate frame data
    if (frameWidth <= 0 || frameHeight <= 0) {
      console.warn('🚫 Invalid frame dimensions, using fallback');
      drawFallbackPlayer();
      return;
    }
    
    // Calculate screen position
    const screenX = Math.round(player.x - camera.x);
    const screenY = Math.round(player.y - camera.y);
    
    // Scale down the sprite to fit the map better
    // Original frame is 160x160 (480/3), scale it down to ~48x48
    const scale = 0.3; // 30% of original size (160 * 0.3 = 48)
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
      console.warn('🚫 Error drawing sprite, using fallback:', error);
      ctx.restore();
      drawFallbackPlayer();
      return;
    }
    
    ctx.restore();
    
    // Sprite debug logging removed for performance
  }

  function drawFallbackPlayer() {
    // Fallback player drawing when sprites fail to load - make it much more visible!
    const screenX = Math.round(player.x - camera.x);
    const screenY = Math.round(player.y - camera.y);
    
    // Draw main body with gradient effect
    const bodyColor = gameState.currentAnimation === 'walk' ? '#00ff00' : '#00cc00';
    const borderColor = gameState.currentAnimation === 'attack' ? '#ff0000' : '#004400';
    
    // Draw border/outline
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
    
    // Add detailed face
    ctx.fillStyle = '#000000';
    const eyeSize = Math.max(4, player.width / 12);
    const eyeY = screenY + player.height / 3;
    
    // Eyes with better positioning
    ctx.fillRect(screenX + player.width / 3, eyeY, eyeSize, eyeSize);
    ctx.fillRect(screenX + 2 * player.width / 3 - eyeSize, eyeY, eyeSize, eyeSize);
    
    // Mouth
    const mouthY = screenY + 2 * player.height / 3;
    const mouthWidth = player.width / 3;
    const mouthHeight = Math.max(2, player.height / 20);
    ctx.fillRect(screenX + player.width / 3, mouthY, mouthWidth, mouthHeight);
    
    // Direction indicator (arrow)
    ctx.fillStyle = '#ffff00';
    const arrowSize = player.width / 8;
    if (gameState.playerDirection === 'left') {
      // Left arrow
      ctx.beginPath();
      ctx.moveTo(screenX + arrowSize, screenY + player.height / 2);
      ctx.lineTo(screenX + arrowSize * 2, screenY + player.height / 2 - arrowSize);
      ctx.lineTo(screenX + arrowSize * 2, screenY + player.height / 2 + arrowSize);
      ctx.closePath();
      ctx.fill();
    } else {
      // Right arrow
      ctx.beginPath();
      ctx.moveTo(screenX + player.width - arrowSize, screenY + player.height / 2);
      ctx.lineTo(screenX + player.width - arrowSize * 2, screenY + player.height / 2 - arrowSize);
      ctx.lineTo(screenX + player.width - arrowSize * 2, screenY + player.height / 2 + arrowSize);
      ctx.closePath();
      ctx.fill();
    }
    
    // Add name label above player
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.font = `${Math.max(12, player.width / 8)}px Arial`;
    ctx.textAlign = 'center';
    const labelText = playerProfile.playerName || 'Player';
    const labelX = screenX + player.width / 2;
    const labelY = screenY - 10;
    ctx.strokeText(labelText, labelX, labelY);
    ctx.fillText(labelText, labelX, labelY);
    ctx.textAlign = 'left'; // Reset alignment
  }

  // Optimized frame rate control for better performance
  let lastFrameTime = 0;
  let frameCount = 0;
  let fpsDisplay = 0;
  const targetFPS = 60; // Target 60 FPS for smooth gameplay
  const frameInterval = 1000 / targetFPS;

  function loop(currentTime){ 
    // Request next frame first for better performance
    requestAnimationFrame(loop);
    
    // Frame rate limiting
    const deltaTime = currentTime - lastFrameTime;
    if (deltaTime < frameInterval) {
      return; // Skip this frame to maintain target FPS
    }
    
    // Update game state
    update(currentTime); 
    
    // Render only if game is ready
    if (gameState.gameReady) {
      render();
    }
    
    // FPS monitoring (reduced frequency)
    frameCount++;
    if (frameCount % 120 === 0) { // Check every 120 frames instead of 60
      fpsDisplay = Math.round(1000 / deltaTime);
    }
    
    lastFrameTime = currentTime - (deltaTime % frameInterval);
  }
  
  // Add FPS display to debug info
  function getFPS() {
    return fpsDisplay;
  }

  // findPlayerStart is now in MapRenderer module

  function hideLoading(){ 
    const el = document.getElementById('loading-screen'); 
    if(el) {
      el.style.opacity = '0';
      setTimeout(() => el.style.display='none', 300);
    }
  }
  
  function updateLoadingProgress(message, progress = null) {
    const loading = document.getElementById('loading-screen');
    if (!loading) return;
    
    const text = loading.querySelector('p');
    if (text) text.textContent = message;
    
    if (progress !== null) {
      let progressBar = loading.querySelector('.progress-bar');
      if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.cssText = `
          width: 200px; height: 4px; background: rgba(255,255,255,0.3); 
          border-radius: 2px; margin: 10px auto; overflow: hidden;
        `;
        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        fill.style.cssText = `
          height: 100%; background: #4CAF50; width: 0%; 
          transition: width 0.3s ease;
        `;
        progressBar.appendChild(fill);
        loading.appendChild(progressBar);
      }
      const fill = progressBar.querySelector('.progress-fill');
      if (fill) fill.style.width = progress + '%';
    }
  }

  // Auto-load saved game state on startup
  async function autoLoadGameState() {
    try {
        console.log('📥 Auto-loading saved game state from player account...');
        
        const response = await fetch('/game/load', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          // Check if it's an authentication error
          if (response.status === 401) {
            console.error('❌ Authentication required - redirecting to login');
            window.location.href = '/auth/login';
            return false;
          }
          
          console.log('ℹ️ No saved game found, starting fresh');
          return false; // No saved game, start fresh
        }
        
        const result = await response.json();
        
        if (!result || !result.success) {
          console.log('ℹ️ No saved game found, starting fresh');
          return false;
        }
        
        const saveData = result.data;
        console.log('✅ Found saved game data:', saveData);
        console.log('📍 Received playerPosition:', saveData.playerPosition);
        
        // Restore player profile data
        if (saveData.playerName) playerProfile.playerName = saveData.playerName;
        if (saveData.inGameName) playerProfile.inGameName = saveData.inGameName;
        if (typeof saveData.pixelCoins === 'number') playerProfile.pixelCoins = saveData.pixelCoins;
        if (typeof saveData.experience === 'number') playerProfile.experience = saveData.experience;
        if (typeof saveData.level === 'number') playerProfile.level = saveData.level;
        if (Array.isArray(saveData.badges)) playerProfile.badges = saveData.badges;
        if (Array.isArray(saveData.achievements)) playerProfile.achievements = saveData.achievements;
        if (saveData.gameStats) playerProfile.gameStats = saveData.gameStats;
        
        // Restore player position only if it's a valid saved position
        if (saveData.playerPosition && player) {
          const savedX = Number(saveData.playerPosition.x);
          const savedY = Number(saveData.playerPosition.y);
          
          // Check if we have valid coordinates
          if (!isNaN(savedX) && !isNaN(savedY)) {
            player.x = savedX;
            player.y = savedY;
            console.log('📍 Restored player position:', { x: player.x, y: player.y });
          } else {
            console.log('📍 Invalid saved position, will use spawn point instead');
            return false; // Treat as no saved game to use spawn point
          }
        } else {
          console.log('📍 No saved position found, will use spawn point instead');
          return false; // No position saved, use spawn point
        }
        
        // Restore game state
        if (Array.isArray(saveData.collectedRewards)) {
          gameState.collectedRewards = new Set(saveData.collectedRewards);
        }
        if (Array.isArray(saveData.activeQuests)) {
          gameState.activeQuests = new Set(saveData.activeQuests);
        }
        if (Array.isArray(saveData.completedQuests)) {
          gameState.completedQuests = new Set(saveData.completedQuests);
        }
        if (Array.isArray(saveData.interactedNPCs)) {
          gameState.interactedNPCs = new Set(saveData.interactedNPCs);
        }
        if (saveData.questProgress) {
          gameState.questProgress = saveData.questProgress;
        }
        if (saveData.playerDirection) {
          gameState.playerDirection = saveData.playerDirection;
        }
        if (saveData.currentAnimation) {
          gameState.currentAnimation = saveData.currentAnimation;
        }
        
        // Note: Collision overrides are now loaded globally at game start, not per-user
        
        console.log('✅ Game state restored from player account');
        console.log('📊 Restored stats:', {
          level: playerProfile.level,
          xp: playerProfile.experience,
          coins: playerProfile.pixelCoins,
          position: { x: player.x, y: player.y },
          rewards: gameState.collectedRewards.size,
          quests: gameState.activeQuests.size
        });
        
        return true; // Successfully loaded saved game
      } catch (error) {
        console.error('❌ Failed to auto-load game state:', error);
        return false; // Failed to load
      }
    }

    async function start() {
    try {
        console.log('🎮 Starting game initialization...');
        
        // Show loading screen
        updateLoadingProgress('Initializing game systems...', 10);
        
        // Initialize animation manager first
        animationManager = new AnimationManager();
        console.log('Animation manager initialized');
        
        // Show loading screen
        updateLoadingProgress('Loading map...', 20);
        
        // Load map and wait for completion
        await loadMap();
        console.log('Map loaded successfully');
        
        // Initialize collision debug system for canvas-based game
        updateLoadingProgress('Setting up collision debug...', 50);
        try {
          // Check if CollisionDebugSystem or DebugManager is available from collision-debug-new.js
          if (typeof window.DebugManager === 'function') {
            console.log('🔧 Initializing DebugManager for collision debugging...');
            
            // Create a canvas-compatible pseudo-scene for DebugManager
            const pseudoScene = {
              add: {
                graphics: () => ({
                  clear: () => {},
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
                  collision: !['ground', 'people'].includes(layer.name.toLowerCase())
                }));

              debugManager.setupCollisionDebug(debugLayers, {
                excludeLayers: ['ground', 'people'],
                player: player,
                autoEnable: false
              });

              console.log(`✅ DebugManager initialized for ${debugLayers.length} layers`);
            }
          } else {
            console.log('⚠️ DebugManager not available - collision debug will be limited');
            console.log('💡 Load collision-debug-new.js before game.js to enable full collision debugging');
          }
        } catch (error) {
          console.warn('⚠️ Failed to initialize DebugManager:', error);
          console.log('Collision debugging will still work via drawCollisionDebugOverlay()');
        }
        
        updateLoadingProgress('Loading player sprites...', 60);
        
        // Wait for sprites to load with timeout
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 50; // 5 seconds timeout
          
          const checkSprites = () => {
            attempts++;
            
            if (animationManager && animationManager.sprites && Object.keys(animationManager.sprites).length >= 2) {
              console.log('✅ Sprites loaded successfully:', Object.keys(animationManager.sprites));
              resolve();
            } else if (attempts >= maxAttempts) {
              console.warn('⚠️ Sprite loading timeout, continuing with fallback');
              resolve(); // Continue anyway
            } else {
              setTimeout(checkSprites, 100);
            }
          };
          checkSprites();
        });
        
        updateLoadingProgress('Initializing controllers...', 80);
        
        // Initialize controllers
        playerController = new PlayerController();
        
        // Initialize player profile
        await playerProfile.loadProfile();
        
        // Start tracking play time
        playerProfile.startPlayTimeTracking();
        console.log('⏱️ Play time tracking started');
        
        updateLoadingProgress('Loading saved game...', 90);
        
        // Load global collision overrides (shared across all users)
        console.log('🔧 Loading global collision overrides...');
        await loadCollisionOverridesGlobally();
        
        // Auto-load saved game state from player account
        console.log('🔄 Attempting to load saved game...');
        const hasSavedGame = await autoLoadGameState();
        console.log('📊 Has saved game?', hasSavedGame);
        
        // If no saved game, use spawn point and reset prologue
        if (!hasSavedGame) {
            console.log('🎯 No saved game, finding spawn point...');
            const spawn = MapRenderer.findPlayerStart();
            console.log('📍 Spawn point found:', spawn);
            player.x = spawn.x;
            player.y = spawn.y;
            console.log('🎮 New game - player position set to spawn point:', {x: player.x, y: player.y});
            
            // Reset prologue for new game
            resetPrologue();
            console.log('🔄 Prologue reset for new game');
        } else {
            console.log('💾 Loaded saved game, player position:', {x: player.x, y: player.y});
        }
        
        // Update game state
        gameState.player = player;
        gameState.gameReady = true;
        
        console.log('✅ Game initialized:', {
            mapLoaded: !!MapRenderer.getMapData(),
            tilesetsLoaded: Object.keys(MapRenderer.getTilesetImages()).length,
            playerPos: { x: player.x, y: player.y },
            playerSpritesLoaded: animationManager && Object.keys(animationManager.sprites).length > 0
        });
        
        // Log user role and collision debug permissions
        const userRole = window.gameData?.user?.role || 'player';
        console.log('👤 User role:', userRole);
        if (userRole === 'admin') {
          console.log('🔧 Collision debugging: ENABLED (Admin access)');
        } else {
          console.log('🔒 Collision debugging: VIEW ONLY (Admin required to modify)');
        }

        updateLoadingProgress('Game ready!', 100);
        
        // Hide loading screen and check for prologue
        setTimeout(() => {
          hideLoading();
          
          console.log('🔍 Checking prologue conditions:');
          console.log('  - hasSavedGame:', hasSavedGame);
          console.log('  - shouldPlayPrologue():', shouldPlayPrologue());
          console.log('  - localStorage prologue key:', localStorage.getItem(PROLOGUE_PLAYED_KEY));
          
          // Initialize game music
          gameMusicManager.init();
          
          // Load character avatar
          loadCharacterAvatar();
          
          // Play prologue video for new games only
          if (!hasSavedGame && shouldPlayPrologue()) {
            console.log('🎬 New game detected - playing prologue');
            playPrologueVideo(() => {
              // Start game loop and music after prologue
              gameMusicManager.play();
              requestAnimationFrame(loop);
            });
          } else {
            console.log('⏭️ Skipping prologue - hasSavedGame:', hasSavedGame, 'shouldPlayPrologue:', shouldPlayPrologue());
            // Start game loop and music immediately
            gameMusicManager.play();
            requestAnimationFrame(loop);
          }
        }, 500);
        
    } catch(err) {
        console.error('❌ Start failed:', err);
        updateLoadingProgress('Failed to load game: ' + err.message, 0);
    }
  }

  // Removed old loadPlayerSprite function - now handled by AnimationManager

  // processMapObjects is now in MapRenderer module

  // Save play time before page unload
  window.addEventListener('beforeunload', () => {
    // Don't save if we're deleting the save data
    if (window.deletingSave) {
      console.log('⏭️ Skipping auto-save because save is being deleted');
      return;
    }
    
    if (playerProfile) {
      playerProfile.stopPlayTimeTracking();
      // Save one last time before leaving
      playerProfile.saveToServer();
    }
  });

  // Start the game
  start();

})();