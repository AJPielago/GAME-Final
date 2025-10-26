// CollisionDebugSystem is now in collision-debug.js

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
        this.gameReady = false;
        this.assetsLoaded = false;
    }
}

// Lightweight debug logger: only prints when gameState.debugMode is true
function dlog(...args) {
    try {
        // If an explicit verbose flag was set, always print
        if (typeof window !== 'undefined' && window.__VERBOSE_LOGGING_ENABLED) {
            console.log(...args);
            return;
        }
        // Rate-limited debug logging to avoid per-frame spam. If the developer
        // explicitly enabled verbose logging (or set persistent DEBUG_LOGS) we
        // bypass the rate limit to allow full chatty output.
        const hasGameState = (typeof gameState !== 'undefined' && gameState);
        const persisted = (typeof localStorage !== 'undefined' && localStorage.getItem && localStorage.getItem('DEBUG_LOGS') === '1');

    // Only explicit verbose opt-in bypasses the throttle; persisted DEBUG_LOGS
    // will NOT bypass throttling to avoid per-frame spam.
    const bypassThrottle = false;

        // Basic global throttle state (ms)
        if (typeof window !== 'undefined') {
            if (typeof window.__dlogLastTs === 'undefined') window.__dlogLastTs = 0;
            if (typeof window.__dlogSuppressedCount === 'undefined') window.__dlogSuppressedCount = 0;
            // Increase default rate limit to avoid per-frame chatter
            if (typeof window.__dlogRateLimitMs === 'undefined') window.__dlogRateLimitMs = 1000; // 1000ms default
            if (typeof window.__dlogLastMsg === 'undefined') window.__dlogLastMsg = null;
            if (typeof window.__dlogLastMsgTs === 'undefined') window.__dlogLastMsgTs = 0;
        }

        const now = Date.now();

        // Build a simple message key to detect repeated identical logs
        let msgKey = '';
        try {
            msgKey = args.length === 1 ? (typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0])) : JSON.stringify(args);
        } catch (e) {
            try { msgKey = args.map(a => String(a)).join(' '); } catch (e2) { msgKey = String(args); }
        }

        // Suppress repeated identical messages occurring rapidly (3s window)
        const dedupeWindowMs = 3000;

        // Only print if runtime debug mode is active (when available) or persisted flag
        if (hasGameState ? gameState.debugMode : persisted) {
            // If the message is identical to the last one and within the dedupe window, suppress it
            if (msgKey && window.__dlogLastMsg === msgKey && (now - window.__dlogLastMsgTs) < dedupeWindowMs) {
                window.__dlogSuppressedCount = (window.__dlogSuppressedCount || 0) + 1;
                return;
            }

            // Otherwise apply simple rate limit as a fallback
            if (now - window.__dlogLastTs < window.__dlogRateLimitMs) {
                window.__dlogSuppressedCount = (window.__dlogSuppressedCount || 0) + 1;
                // Update last message info so repeated messages are tracked
                window.__dlogLastMsg = msgKey;
                window.__dlogLastMsgTs = now;
                return;
            }

            // If we reach here, enough time passed - flush suppressed count then log
            if (window.__dlogSuppressedCount > 0) {
                console.log(`(suppressed ${window.__dlogSuppressedCount} messages)`);
                window.__dlogSuppressedCount = 0;
            }
            console.log(...args);
            window.__dlogLastTs = now;
            window.__dlogLastMsg = msgKey;
            window.__dlogLastMsgTs = now;
        }
    } catch (e) {
        // ignore - defensive
    }
}

// Throttled debug logger: prints a message for a given key at most once per intervalMs
const __dlogThrottleMap = new Map();
function dlogOncePer(key, intervalMs, ...args) {
    try {
        const now = Date.now();
        const last = __dlogThrottleMap.get(key) || 0;
        if (now - last >= intervalMs) {
            __dlogThrottleMap.set(key, now);
            // Follow same visibility rules as dlog: explicit verbose opt-in, runtime gameState.debugMode, or persisted DEBUG_LOGS
            try {
                if (typeof window !== 'undefined' && window.__VERBOSE_LOGGING_ENABLED) { console.log(...args); return; }
            } catch (e) {}

            const hasGameState = (typeof gameState !== 'undefined' && gameState);
            const persisted = (typeof localStorage !== 'undefined' && localStorage.getItem && localStorage.getItem('DEBUG_LOGS') === '1');
            if (hasGameState) {
                if (gameState.debugMode) console.log(...args);
            } else {
                if (persisted) console.log(...args);
            }
        }
    } catch (e) {
        // ignore
    }
}

// Log only when the message content changes (useful for state-based logs)
const __dlogOnChangeMap = new Map();
function dlogOnChange(key, ...args) {
    try {
        const now = Date.now();
        let payload;
        try { payload = args.length === 1 ? args[0] : JSON.stringify(args); } catch (e) { payload = args.join(' '); }
        const prev = __dlogOnChangeMap.get(key);
        if (prev && prev.payload === payload) return; // unchanged
        __dlogOnChangeMap.set(key, { payload, ts: now });
        dlog(...args);
    } catch (e) {}
}

// Helper to toggle persistent debug logging from the browser console
if (typeof window !== 'undefined') {
    window.setDebugLogs = function(enabled) {
        try {
            if (enabled) localStorage.setItem('DEBUG_LOGS', '1'); else localStorage.removeItem('DEBUG_LOGS');
            console.log('Persistent DEBUG_LOGS set to', !!enabled);
        } catch (e) {
            console.warn('Unable to set DEBUG_LOGS in localStorage', e);
        }
    };
    // Explicit verbose logging opt-in for very chatty debug logs (off by default)
    window.__VERBOSE_LOGGING_ENABLED = false;
    window.enableVerboseLogs = function(enabled) {
        window.__VERBOSE_LOGGING_ENABLED = !!enabled;
        console.log('Verbose logging enabled:', !!enabled);
    };
}

// Animation Manager
class AnimationManager {
    constructor(scene) {
        this.scene = scene;
        this.animations = new Map();
        this.currentAnimation = null;
        this.lastAnimation = null;
    }
    
    createAnimations() {
        console.log('Creating animations...');
        
        // Clear any existing animations
        this.animations.clear();
        
        // Get the texture keys to verify what's loaded
        const textureKeys = this.scene.textures.getTextureKeys();
        console.log('Available textures:', textureKeys);
        
        // Animation configuration with expected frame counts
        const animConfig = {
            idle: {
                key: 'idle',
                frameRate: 6,
                repeat: -1,
                yoyo: false,
                repeatDelay: 1000,
                expectedFrames: 7
            },
            walk: {
                key: 'walk',
                frameRate: 8,
                repeat: -1,
                yoyo: false,
                expectedFrames: 8
            },
            attack: {
                key: 'attack',
                frameRate: 10,
                repeat: 0,
                expectedFrames: 6
            },
            hurt: {
                key: 'hurt',
                frameRate: 8,
                repeat: 2,
                yoyo: true,
                expectedFrames: 4
            }
        };
        
        // Create each animation
        let success = true;
        Object.entries(animConfig).forEach(([key, anim]) => {
            try {
                // Check if the texture exists
                if (!this.scene.textures.exists(key)) {
                    console.error(`Texture '${key}' not found! Please check that images/characters/player/${key}.png exists.`);
                    success = false;
                    return;
                }
                
                // Get frame count from texture
                const texture = this.scene.textures.get(key);
                const frameCount = texture.frameTotal;
                
                if (frameCount === 0) {
                    console.error(`No frames found in texture '${key}'! Check sprite sheet format and dimensions.`);
                    success = false;
                    return;
                }
                
                if (frameCount !== anim.expectedFrames) {
                    console.warn(`Frame count mismatch for '${key}': found ${frameCount}, expected ${anim.expectedFrames}`);
                }
                
                console.log(`Using texture '${key}' with ${frameCount} frames`);
                
                // Generate frames for this animation
                anim.frames = this.scene.anims.generateFrameNumbers(key, { 
                    start: 0,
                    end: frameCount - 1
                });
                
                // Remove any existing animation with this key
                if (this.scene.anims.exists(key)) {
                    this.scene.anims.remove(key);
                }
                
                // Create the animation
                const animInstance = this.scene.anims.create(anim);
                if (!animInstance) {
                    throw new Error(`Failed to create animation '${key}'`);
                }
                
                this.animations.set(key, anim);
                console.log(`✓ Created animation: ${key} with ${frameCount} frames`);
                
            } catch (error) {
                console.error(`Error creating animation '${key}':`, error);
                success = false;
            }
        });
        
        if (success) {
            console.log('✓ All character animations created successfully:', [...this.animations.keys()].join(', '));
        } else {
            console.error('✗ Failed to create some animations. Please ensure:');
            console.error('  1. Character sprite files exist at: images/characters/player/');
            console.error('  2. Files are named: idle.png, walk.png, attack.png, hurt.png');
            console.error('  3. Sprites are 96x96 pixels per frame');
            console.error('  4. Frame counts are: idle(7), walk(8), attack(6), hurt(4)');
        }
        
        return success;
    }
    
    playAnimation(sprite, key, force = false) {
        // Safety checks
        if (!sprite || !sprite.anims) {
            console.warn(`[Animation] Invalid sprite or sprite.anims for animation '${key}'`);
            return null;
        }
        
        // Handle empty key (stop animation)
        if (!key) {
            console.log('[Animation] Empty key provided, stopping animation');
            if (sprite.anims.isPlaying) {
                sprite.anims.stop();
            }
            this.currentAnimation = null;
            return null;
        }
        
        // Don't restart the same animation unless forced
        if (!force && this.currentAnimation === key && sprite.anims.isPlaying) {
            if (gameState.debugMode) console.log(`[Animation] '${key}' is already playing`);
            return sprite.anims.currentAnim;
        }
        
        // Check if animation exists
        if (!this.scene.anims.exists(key)) {
            console.warn(`[Animation] Animation '${key}' not found in Phaser's animation manager`);
            
            // Try to recreate animations
            console.log('[Animation] Attempting to recreate animations...');
            this.createAnimations();
            
            // Check again after recreation
            if (!this.scene.anims.exists(key)) {
                console.error(`[Animation] Failed to create animation '${key}'`);
                return null;
            }
        }
        
        // Update animation state
        this.lastAnimation = this.currentAnimation;
        this.currentAnimation = key;
        
        // Clean up previous listeners
        sprite.off('animationcomplete');
        sprite.off('animationrepeat');
        
        // Stop current animation if any
        if (sprite.anims.isPlaying) {
            sprite.anims.stop();
        }
        
        // Play the animation with error handling
        let playedAnim;
        try {
            // Ensure the sprite has a valid texture
            if (!sprite.texture || !sprite.texture.key) {
                console.error('[Animation] Sprite has no texture:', sprite);
                return null;
            }
            
            console.log(`[Animation] Playing '${key}' animation...`);
            
            // Play the animation
            playedAnim = sprite.anims.play(key, force);
            if (!playedAnim) {
                throw new Error('Animation.play() returned null');
            }
            
            // Verify animation is actually playing
            if (!sprite.anims.isPlaying) {
                console.warn(`[Animation] Animation '${key}' didn't start playing`);
                // Force restart
                sprite.anims.restart();
            }
            
            // Set up completion handler for non-looping animations
            const animationSettings = this.animations.get(key);
            if (animationSettings && animationSettings.repeat === 0) {
                sprite.once('animationcomplete', (animation) => {
                    if (gameState.debugMode) console.log(`[Animation] '${key}' completed`);
                    
                    if (this.currentAnimation === key) {
                        if (key !== 'idle' && key !== 'walk') {
                            // Auto-return to appropriate state
                            const nextAnim = gameState.isMoving ? 'walk' : 'idle';
                            if (this.scene.anims.exists(nextAnim)) {
                                setTimeout(() => {
                                    this.playAnimation(sprite, nextAnim);
                                }, 50);
                            }
                        }
                    }
                });
            }
            
            console.log(`[Animation] Successfully playing: ${key}`);
            return playedAnim;
            
        } catch (playError) {
            console.error(`[Animation] Error playing animation '${key}':`, playError);
            
            // Reset animation state on error
            this.currentAnimation = this.lastAnimation;
            
            return null;
        }
    }
    
    getCurrentAnimation() {
        return this.currentAnimation;
    }
    
    isPlaying(key) {
        return this.currentAnimation === key;
    }
}

// Player Controller
class PlayerController {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.speed = 160;
        this.isAttacking = false;
        this.lastMovementState = false;
        
        this.hadMovement = false;
        this.keys = {
            up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            up2: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
            down2: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            left2: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
            right2: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
            attack: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            debug: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB)
        };
        
        // Scene-level handler will manage TAB; avoid per-key binding to prevent double toggles
        
        dlog('Player input configured');
    }
    
    update() {
        // Reset movement tracking at start of update
        this.hadMovement = false;

        // Only log player controller update when there's actual input or state change
        if (Object.values(this.keys).some(key => key.isDown) || this.isAttacking) {
            dlogOncePer('player-controller-update', 1000, '🎮🎮🎮 PLAYER CONTROLLER UPDATE CALLED!!! 🎮🎮🎮');
        }
        if (!this.player?.body) {
            // More detailed debugging for missing physics body
            if (!this.player) {
                console.error('PlayerController: No player object!');
            } else if (!this.player.body) {
                console.error('PlayerController: Player exists but has no physics body!', {
                    playerExists: !!this.player,
                    playerType: this.player.constructor.name,
                    hasPhysics: !!this.player.physics,
                    bodyExists: !!this.player.body
                });
                
                // Try to log first few keys for debugging
                const firstKey = Object.values(this.keys)[0];
                if (firstKey) {
                    console.log('Keys are working - first key state:', firstKey.isDown);
                }
            }
            return;
        }
        
        // Debug input logging
        if (gameState.debugMode) {
            const activeKeys = [];
            for (const [keyName, keyObj] of Object.entries(this.keys)) {
                if (keyObj.isDown) {
                    activeKeys.push(keyName);
                }
            }
            // Only log active keys when they change
            const currentKeyState = activeKeys.join(',');
            if (currentKeyState !== this._lastKeyState) {
                this._lastKeyState = currentKeyState;
                if (activeKeys.length > 0) {
                    dlogOnChange('active-keys', 'Active keys:', activeKeys.join(', '));
                }
            }
        }
        
        // Debug toggle handled at scene level
        
        if (Phaser.Input.Keyboard.JustDown(this.keys.attack) && !this.isAttacking) {
            this.handleAttack();
            return;
        }
        
        if (this.isAttacking) return;
        
        dlogOnChange('calling-handleMovement', '🔥 CALLING handleMovement()'); // EXTREME DEBUG (only on change)
        this.handleMovement();
        // Log movement finish if we had any movement
        if (this.hadMovement) {
            dlogOnChange('handleMovementFinished', '✅ handleMovement() FINISHED');
        }
    }
    
    handleMovement() {
        // Check for key presses
        const anyKeyPressed = Object.values(this.keys).some(key => key.isDown);
        
        if (anyKeyPressed) {
            dlogOnChange('handle-movement', '💥💥 HANDLE MOVEMENT CALLED!!! 💥💥');
            this.hadMovement = true;
        }
        
        // Don't process movement during attack or hurt states
        if (this.isAttacking) {
            console.log('❌ Movement blocked - attacking');
            return;
        }
        
        // Get input state
        const isUpPressed = this.keys.up.isDown || this.keys.up2.isDown;
        const isDownPressed = this.keys.down.isDown || this.keys.down2.isDown;
        const isLeftPressed = this.keys.left.isDown || this.keys.left2.isDown;
        const isRightPressed = this.keys.right.isDown || this.keys.right2.isDown;
        
    // Only log key states when they change
    const currentKeyStates = {
            W: this.keys.up.isDown,
            S: this.keys.down.isDown,
            A: this.keys.left.isDown,
            D: this.keys.right.isDown,
            UP: this.keys.up2.isDown,
            DOWN: this.keys.down2.isDown,
            LEFT: this.keys.left2.isDown,
            RIGHT: this.keys.right2.isDown
    };
    
    // Compare with previous state
    if (!this.lastKeyStates || JSON.stringify(currentKeyStates) !== JSON.stringify(this.lastKeyStates)) {
        dlogOnChange('raw-key-states', '🔍 RAW KEY STATES:', currentKeyStates);
        this.lastKeyStates = {...currentKeyStates};
    }
        
        // Calculate movement vector
        let velocityX = 0;
        let velocityY = 0;
        
        if (isLeftPressed) velocityX = -1;
        if (isRightPressed) velocityX = 1;
        if (isUpPressed) velocityY = -1;
        if (isDownPressed) velocityY = 1;
        
        // Normalize diagonal movement
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707; // 1/sqrt(2)
            velocityY *= 0.707;
        }
        
        // Apply speed
        velocityX *= this.speed;
        velocityY *= this.speed;
        
        // Update movement state
        const nowMoving = (velocityX !== 0 || velocityY !== 0);
        const movementStateChanged = (nowMoving !== this.lastMovementState);
        
        // Update game state
        gameState.isMoving = nowMoving;
        
        // Flip sprite based on movement direction
        if (velocityX !== 0) {
            this.player.setFlipX(velocityX < 0);
        }
        
        // Apply velocity to physics body
        this.player.body.setVelocity(velocityX, velocityY);
        
        // Only change animation if movement state changed or we need to set initial state
        if (movementStateChanged || !this.player.anims.currentAnim) {
            const animationManager = this.scene.animationManager;
            const currentAnim = this.player.anims.currentAnim?.key;
            
            // Don't override attack or hurt animations
            if (currentAnim === 'attack' || currentAnim === 'hurt') {
                this.lastMovementState = nowMoving;
                return;
            }
            
            // Play appropriate animation based on movement state
            if (nowMoving) {
                if (gameState.debugMode) console.log('[Movement] Starting walk animation');
                animationManager.playAnimation(this.player, 'walk');
            } else {
                if (gameState.debugMode) console.log('[Movement] Starting idle animation');
                animationManager.playAnimation(this.player, 'idle');
            }
        }
        
        this.lastMovementState = nowMoving;
    }
    
    handleAttack() {
        if (this.isAttacking) {
            if (gameState.debugMode) console.log('[Attack] Attack already in progress');
            return;
        }
        
        const currentAnim = this.player.anims.currentAnim?.key;
        if (currentAnim === 'hurt') {
            if (gameState.debugMode) console.log('[Attack] Cannot attack while hurt');
            return;
        }
        
        
        console.log('[Attack] Starting attack sequence...');
        
        this.isAttacking = true;
        gameState.isAttacking = true;
        
        // Stop movement
        this.player.body.setVelocity(0, 0);
        
        // Store current movement state
        const wasMoving = gameState.isMoving;
        
        // Play attack animation with force
        const attackAnim = this.scene.animationManager.playAnimation(this.player, 'attack', true);
        
        if (!attackAnim) {
            console.error('[Attack] Failed to start attack animation');
            this.isAttacking = false;
            gameState.isAttacking = false;
            return;
        }
        
        console.log('[Attack] Attack animation started successfully');
        
        // Set up completion handler
        const onAttackComplete = (animation) => {
            if (animation.key === 'attack') {
                console.log('[Attack] Attack animation completed');
                this.isAttacking = false;
                gameState.isAttacking = false;
                
                // Remove this specific listener
                this.player.off('animationcomplete', onAttackComplete);
                
                // Return to appropriate state
                const nextAnim = wasMoving ? 'walk' : 'idle';
                console.log(`[Attack] Returning to ${nextAnim} animation`);
                
                setTimeout(() => {
                    if (this.scene.animationManager && !this.isAttacking) {
                        this.scene.animationManager.playAnimation(this.player, nextAnim, true);
                    }
                }, 100);
            }
        };
        
        // Add the completion listener
        this.player.on('animationcomplete', onAttackComplete);
        
        // Safety timeout in case animation doesn't complete
        setTimeout(() => {
            if (this.isAttacking) {
                console.warn('[Attack] Attack timeout - forcing completion');
                this.player.off('animationcomplete', onAttackComplete);
                this.isAttacking = false;
                gameState.isAttacking = false;
                
                const nextAnim = gameState.isMoving ? 'walk' : 'idle';
                this.scene.animationManager.playAnimation(this.player, nextAnim, true);
            }
        }, 2000); // 2 second timeout
    }
}

// Map Manager
class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.map = null;
        this.layers = [];
        this.tilesets = [];
    }
    
    createMap() {
        console.group('Map Loading');
        try {
            console.log('Checking if map exists in cache...');
            if (!this.scene.cache.tilemap.exists('map')) {
                console.warn('Map not found in cache, creating fallback world');
                console.groupEnd();
                this.createFallbackWorld();
                return;
            }
            
            console.log('Creating tilemap from cache...');
            this.map = this.scene.make.tilemap({ key: 'map' });
            
            if (!this.map) {
                console.error('Failed to create tilemap');
                console.groupEnd();
                this.createFallbackWorld();
                return;
            }
            
            console.log('Tilemap created successfully:', this.map);
            console.log('Map dimensions:', {
                width: this.map.width,
                height: this.map.height,
                tileWidth: this.map.tileWidth,
                tileHeight: this.map.tileHeight,
                layers: this.map.layers ? this.map.layers.length : 0
            });
            
            console.log('Adding tilesets...');
            this.addTilesets();
            
            console.log('Creating layers...');
            this.createLayers();
            
            console.log('Setting world bounds...');
            this.setWorldBounds();
            
            console.log('Map loaded successfully');
            console.groupEnd();
            
        } catch (error) {
            console.error('Error creating map:', error);
            console.groupEnd();
            this.createFallbackWorld();
        }
    }
    
    addTilesets() {
        try {
            // Define tilesets with their properties from the map
            const tilesetMappings = [
                { 
                    name: 'tiles', 
                    textureKey: 'tiles',
                    firstgid: 1,
                    columns: 13,
                    tileWidth: 32,
                    tileHeight: 32
                },
                { 
                    name: 'assets', 
                    textureKey: 'assets',
                    firstgid: 157,
                    columns: 16,
                    tileWidth: 32,
                    tileHeight: 32
                },
                { 
                    name: 'S_Attack', 
                    textureKey: 'S_Attack',
                    firstgid: 589,
                    columns: 18,
                    tileWidth: 32,
                    tileHeight: 32
                }
            ];
            
            tilesetMappings.forEach(mapping => {
                if (this.scene.textures.exists(mapping.textureKey)) {
                    // Add tileset with full configuration
                    const tileset = this.map.addTilesetImage(
                        mapping.name, 
                        mapping.textureKey,
                        mapping.tileWidth,
                        mapping.tileHeight,
                        0, 0, // margin, spacing
                        mapping.firstgid
                    );
                    
                    if (tileset) {
                        this.tilesets.push(tileset);
                        console.log(`✓ Added tileset: ${mapping.name} (firstgid: ${mapping.firstgid}, columns: ${mapping.columns})`);
                    }
                } else {
                    console.warn(`Texture not found: ${mapping.textureKey}`);
                }
            });
            
        } catch (error) {
            console.error('Error adding tilesets:', error);
        }
    }
    
    createLayers() {
        if (this.tilesets.length === 0) {
            console.warn('No tilesets available for layer creation');
            return;
        }
        
        const layerDefinitions = [
            { name: 'Ground', depth: 0, collision: false },
            { name: 'Bridges', depth: 5, collision: false },
            { name: 'Logs', depth: 10, collision: true },
            { name: 'Fences', depth: 15, collision: true },
            { name: 'enemy', depth: 17, collision: true, interactive: true },
            { name: 'Trees', depth: 20, collision: true },
            { name: 'invi', depth: 25, collision: true, invisible: true }
        ];
        
        layerDefinitions.forEach(layerDef => {
            try {
                const mapLayerMeta = this.map.layers.find(l => l.name === layerDef.name);
                if (!mapLayerMeta) {
                    console.warn(`Layer '${layerDef.name}' not found in map`);
                    return;
                }

                // Some TMJ maps (especially infinite maps) include startx/starty or x/y
                // values indicating the chunk offset in tiles. Convert those to pixel
                // offsets so Phaser places the created layer at the intended world coords.
                const tileWidth = this.map.tileWidth || this.map.tilewidth || 32;
                const tileHeight = this.map.tileHeight || this.map.tileheight || 32;

                // Calculate layer offset based on chunk positioning for infinite maps
                let offsetX = 0;
                let offsetY = 0;
                const isInfinite = !!this.map.infinite;

                // For infinite maps, use chunk positioning (chunks already include startx/starty)
                if (isInfinite && mapLayerMeta.chunks && mapLayerMeta.chunks.length > 0) {
                    // Find the minimum chunk coordinates to ensure proper alignment
                    const minChunkX = Math.min(...mapLayerMeta.chunks.map(c => c.x));
                    const minChunkY = Math.min(...mapLayerMeta.chunks.map(c => c.y));
                    
                    // chunk.x and chunk.y are already in TILE coordinates, not chunk coordinates
                    // They already account for startx/starty, so don't add them again
                    offsetX = minChunkX * tileWidth;
                    offsetY = minChunkY * tileHeight;
                    
                    console.log(`Layer '${layerDef.name}' chunk-based offset: (${offsetX}, ${offsetY})`);
                } else {
                    // For non-infinite maps, use startx/starty or x/y
                    const layerStartX = (typeof mapLayerMeta.startx !== 'undefined') ? mapLayerMeta.startx : (typeof mapLayerMeta.x !== 'undefined' ? mapLayerMeta.x : 0);
                    const layerStartY = (typeof mapLayerMeta.starty !== 'undefined') ? mapLayerMeta.starty : (typeof mapLayerMeta.y !== 'undefined' ? mapLayerMeta.y : 0);
                    
                    offsetX = layerStartX * tileWidth;
                    offsetY = layerStartY * tileHeight;
                    
                    console.log(`Layer '${layerDef.name}' startx/starty offset: (${offsetX}, ${offsetY})`);
                }

                console.log(`Creating layer ${layerDef.name}:`);
                console.log('- Using tilesets:', this.tilesets.map(t => ({ name: t.name, firstgid: t.firstgid, imageWidth: t.image ? t.image.width : 'N/A', imageHeight: t.image ? t.image.height : 'N/A' })));
                console.log(`- Calculated offset: (${offsetX}, ${offsetY})`);
                
                // Special debugging for enemy layer
                if (layerDef.name === 'enemy') {
                    console.log('🔍 ENEMY LAYER DEBUG:');
                    console.log('- Enemy tiles should use IDs 607, 608, 609 (firstgid 589 + local IDs 18, 19, 20)');
                    console.log('- S_Attack tileset available:', this.scene.textures.exists('S_Attack'));
                    console.log('- Available tilesets:', this.tilesets.map(t => `${t.name} (firstgid: ${t.firstgid})`));
                    console.log('- Raw layer data:', { startx: mapLayerMeta.startx, starty: mapLayerMeta.starty, x: mapLayerMeta.x, y: mapLayerMeta.y });
                    console.log('- Calculated offset before adjustment:', offsetX, offsetY);
                    
                    // DISABLE offset for enemy layer - let Phaser handle chunk positioning automatically
                    offsetX = 0;
                    offsetY = 0;
                    console.log('- Enemy layer offset DISABLED - using (0, 0) to let Phaser handle chunk positioning');
                    console.log('- Enemy chunk data:', mapLayerMeta.chunks ? mapLayerMeta.chunks.map(c => ({ x: c.x, y: c.y, width: c.width, height: c.height })) : 'No chunks');
                }
                
                // Create layer without offset first, then position it
                const layer = this.map.createLayer(layerDef.name, this.tilesets);
                
                if (layer && (offsetX !== 0 || offsetY !== 0)) {
                    // Set the layer position after creation
                    layer.setPosition(offsetX, offsetY);
                    console.log(`- Layer repositioned to: (${offsetX}, ${offsetY})`);
                }
                if (layer) {
                    // Debug layer properties
                    console.log(`- Layer created successfully`);
                    console.log(`- Layer dimensions: ${layer.width}x${layer.height}`);
                    console.log(`- Layer tileset:`, layer.tileset);
                    console.log(`- Layer position: (${layer.x}, ${layer.y})`);
                    
                    // For Logs, Bridges, and enemy layers, verify chunk positioning
                    if (layerDef.name === 'Logs' || layerDef.name === 'Bridges' || layerDef.name === 'enemy') {
                        if (mapLayerMeta.chunks && Array.isArray(mapLayerMeta.chunks)) {
                            console.log(`${layerDef.name} layer chunks:`, mapLayerMeta.chunks.map(c => ({
                                x: c.x,
                                y: c.y,
                                width: c.width,
                                height: c.height,
                                nonEmptyTiles: c.data.filter(id => id !== 0).length
                            })));
                        } else {
                            console.log(`${layerDef.name} layer has no chunks property (not an infinite layer or missing data).`);
                        }
                    }
                    
                    // Check if the layer has any tiles and their positions
                    let tileCount = 0;
                    let tilePositions = [];
                    layer.forEachTile(tile => {
                        if (tile && tile.index !== -1) {
                            tileCount++;
                            if (layerDef.name === 'Logs' || layerDef.name === 'Bridges' || layerDef.name === 'enemy') {
                                tilePositions.push(`(${tile.x},${tile.y})=${tile.index}`);
                            }
                        }
                    });
                    console.log(`- Tile count: ${tileCount}`);
                    if (tilePositions.length > 0) {
                        console.log(`- Tile positions: ${tilePositions.join(', ')}`);
                    }
                    // Ensure layer is visible and at the intended depth
                    try { layer.setDepth(layerDef.depth); } catch (e) {}
                    try { layer.setVisible(!layerDef.invisible); } catch (e) {}
                    try { layer.setAlpha(1); } catch (e) {}

                    if (layerDef.name === 'Logs' || layerDef.name === 'Bridges') {
                        console.log(`Detailed info for ${layerDef.name} layer:`);
                        console.log(`- Layer visible:`, layer.visible);
                        console.log(`- Layer alpha:`, layer.alpha);
                        console.log(`- Layer position:`, layer.x, layer.y);
                        console.log(`- Layer dimensions:`, layer.width, 'x', layer.height);
                        console.log(`- Layer world position: (${layer.x}, ${layer.y})`);
                        
                        // Add visual debug marker for this layer
                        const debugGraphics = this.scene.add.graphics();
                        const debugColor = layerDef.name === 'Logs' ? 0xff0000 : 0x00ff00;
                        debugGraphics.lineStyle(4, debugColor, 1);
                        debugGraphics.strokeRect(layer.x, layer.y, layer.width, layer.height);
                        debugGraphics.setDepth(1000);
                        
                        // Add text label
                        const label = this.scene.add.text(layer.x + 10, layer.y + 10, 
                            `${layerDef.name}\n(${layer.x}, ${layer.y})`, 
                            { fontSize: '16px', fill: '#ffffff', backgroundColor: '#000000' }
                        );
                        label.setDepth(1001);
                    }
                    
                    // Special debug info for enemy layer (without visual markers)
                    if (layerDef.name === 'enemy') {
                        console.log(`Detailed info for ${layerDef.name} layer:`);
                        console.log(`- Layer visible:`, layer.visible);
                        console.log(`- Layer alpha:`, layer.alpha);
                        console.log(`- Layer position:`, layer.x, layer.y);
                        console.log(`- Layer dimensions:`, layer.width, 'x', layer.height);
                        console.log(`- Layer world position: (${layer.x}, ${layer.y})`);
                    }
                    
                    if (layerDef.name === 'Logs' || layerDef.name === 'Bridges' || layerDef.name === 'enemy') {
                        
                        // Check some tiles in the layer
                        let tileFoundCount = 0;
                        layer.forEachTile(tile => {
                            if (tile.index !== -1) {
                                tileFoundCount++;
                                if (tileFoundCount <= 5) {
                                    const actualWorldX = tile.pixelX + layer.x;
                                    const actualWorldY = tile.pixelY + layer.y;
                                    console.log(`- Found tile at (${tile.x}, ${tile.y}) with index ${tile.index}`);
                                    console.log(`  - Tile pixel pos: (${tile.pixelX}, ${tile.pixelY})`);
                                    console.log(`  - Layer offset: (${layer.x}, ${layer.y})`);
                                    console.log(`  - Final world pos: (${actualWorldX}, ${actualWorldY})`);
                                }
                            }
                        });
                        console.log(`- Total tiles found: ${tileFoundCount}`);
                    }
                    
                    if (layerDef.invisible) {
                        console.log(`✓ Created INVISIBLE layer: ${layerDef.name} (depth: ${layerDef.depth})`);
                    } else {
                        console.log(`✓ Created layer: ${layerDef.name} (depth: ${layerDef.depth})`);
                    }

                    if (layerDef.collision) {
                        // For maps without tile properties, set collision by index > 0
                        try { layer.setCollisionBetween(1, 100000); } catch (_) {}
                        console.log(`  - Collision enabled for layer: ${layerDef.name}`);
                    }

                    // Diagnostic: report tileset names and tile count for this layer.
                    try {
                        const availableTilesets = (this.tilesets || []).map(t => t.name || t.firstgid || '<unknown>');
                        console.log(`  - Tilesets used for map: ${availableTilesets.join(', ')}`);

                        // Count non-empty tiles in this layer
                        let tileCount = 0;
                        try {
                            layer.forEachTile((tile) => { if (tile && tile.index > 0) tileCount++; });
                        } catch (e) {
                            // For safety in some Phaser versions
                            try {
                                const data = layer.layer && layer.layer.data;
                                if (Array.isArray(data)) {
                                    data.forEach(row => row.forEach(tile => { if (tile && tile.index > 0) tileCount++; }));
                                }
                            } catch (e2) {}
                        }

                        console.log(`  - Non-empty tiles in layer '${layerDef.name}': ${tileCount}`);
                        if (tileCount === 0 && !layerDef.invisible) {
                            console.warn(`Layer '${layerDef.name}' has 0 tiles - it may appear invisible. Check tileset mapping and tiles indices.`);
                        }
                    } catch (e) {
                        console.warn('Layer diagnostics failed:', e);
                    }

                    this.layers.push({
                        name: layerDef.name,
                        layer: layer,
                        depth: layerDef.depth,
                        collision: layerDef.collision,
                        invisible: layerDef.invisible || false
                    });
                }
            } catch (error) {
                console.warn(`Failed to create layer ${layerDef.name}:`, error);
            }
        });
        
        this.layers.sort((a, b) => a.depth - b.depth);
    }
    
    setWorldBounds() {
        if (this.map) {
            const width = this.map.widthInPixels;
            const height = this.map.heightInPixels;
            this.scene.physics.world.setBounds(0, 0, width, height);
            this.scene.cameras.main.setBounds(0, 0, width, height);
            console.log(`World bounds set: ${width}x${height}`);
        } else {
            this.scene.physics.world.setBounds(0, 0, 1600, 1200);
            this.scene.cameras.main.setBounds(0, 0, 1600, 1200);
        }
    }
    
    createFallbackWorld() {
        console.log('Creating fallback world...');
        
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0x2d5a27);
        graphics.fillRect(0, 0, 1600, 1200);
        
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(64, 1536);
            const y = Phaser.Math.Between(64, 1136);
            const size = Phaser.Math.Between(32, 96);
            const color = Phaser.Math.Between(0x1a4a1a, 0x4a7c4a);
            
            const rect = this.scene.add.rectangle(x, y, size, size, color);
            rect.setStrokeStyle(2, 0x0f2f0f);
        }
        
        this.scene.physics.world.setBounds(0, 0, 1600, 1200);
        this.scene.cameras.main.setBounds(0, 0, 1600, 1200);
        
        console.log('Fallback world created');
    }
    
    setupCollisions(player) {
        console.log('Setting up collisions with debug system...');
        console.log('Total layers:', this.layers.length);
        
        this.layers.forEach((layerData, index) => {
            console.group(`Layer ${index}: ${layerData.name}`);
            console.log('Has collision:', layerData.collision);
            console.log('Layer object:', layerData.layer);
            
            if (layerData.collision && layerData.layer) {
                console.log(`Setting up collision for layer: ${layerData.name}`);
                
                // Special handling for enemy layer - use custom proximity detection
                if (layerData.name === 'enemy') {
                    console.log('🎯 Setting up INTERACTIVE enemy layer with proximity detection');
                    
                    // Store reference to enemy layer for proximity checking
                    this.enemyLayer = layerData.layer;
                    
                    // We'll handle enemy interaction in the update loop instead of overlap
                    console.log(`✅ Enemy proximity detector setup for layer: ${layerData.name}`);
                } else {
                    // Regular solid collision for other layers
                    const collider = this.scene.physics.add.collider(player, layerData.layer);
                    
                    if (collider) {
                        collider.layerName = layerData.name;
                        console.log(`Collider created for layer: ${layerData.name}`);
                    }
                }
                
                // Setup collision debug for this layer using the reusable DebugManager
                if (this.scene.debugManager) {
                    console.log('Setting up collision debug for layer:', layerData.name);
                    this.scene.debugManager.setupCollisionDebug([layerData], {
                        excludeLayers: ['Bridges', 'Ground'], // Default exclusions for this map
                        player: player // Pass the player for debug visualization
                    });
                }
            }
            console.groupEnd();
        });
        
        console.log('Collision setup complete - debug system ready for all layers');
    }
    
    /**
     * Handle enemy interaction when player overlaps with enemy tiles
     * @param {Phaser.Physics.Arcade.Sprite} player - The player sprite
     * @param {Phaser.Tilemaps.Tile} tile - The enemy tile
     * @param {Phaser.Tilemaps.TilemapLayer} layer - The enemy layer
     */
    handleEnemyInteraction(player, tile, layer) {
        // Skip if dialogue is already active
        if (this.isDialogueActive) {
            return;
        }
        
        // Prevent multiple rapid interactions with the same tile
        if (tile.enemyInteractionCooldown && Date.now() - tile.enemyInteractionCooldown < 1000) {
            return;
        }
        
        // Skip if tile is already defeated
        if (tile.isDefeated) {
            return;
        }
        
        console.log('🎯 ENEMY DIALOGUE INTERACTION!');
        console.log('- Player position:', player.x, player.y);
        console.log('- Enemy tile:', tile.index, 'at', tile.pixelX, tile.pixelY);
        
        // Set cooldown to prevent spam
        tile.enemyInteractionCooldown = Date.now();
        
        // Initialize global question progress if not exists
        if (!this.globalQuestionIndex) {
            this.globalQuestionIndex = 0;
        }
        
        // Get all questions for the enemy layer (3 questions total)
        const allQuestions = this.getAllEnemyQuestions();
        
        // Check if all questions are completed
        if (this.globalQuestionIndex >= allQuestions.length) {
            console.log('All questions completed for enemy layer!');
            return;
        }
        
        // Show current question
        const currentQuestion = allQuestions[this.globalQuestionIndex];
        this.showEnemyDialogue(player, tile, layer, currentQuestion);
    }
    
    /**
     * Get all questions for the enemy layer (3 questions total)
     */
    getAllEnemyQuestions() {
        return [
            {
                question: "What is 2 + 2?",
                options: ["3", "4", "5", "6"],
                correctAnswer: 1,
                enemyName: "Math Guardian"
            },
            {
                question: "What is the capital of France?",
                options: ["London", "Berlin", "Paris", "Madrid"],
                correctAnswer: 2,
                enemyName: "Geography Keeper"
            },
            {
                question: "Which programming language is used for web development?",
                options: ["Python", "JavaScript", "C++", "Java"],
                correctAnswer: 1,
                enemyName: "Code Master"
            }
        ];
    }
    
    /**
     * Show enemy dialogue with question
     */
    showEnemyDialogue(player, tile, layer, questionData) {
        // Set dialogue as active to prevent overlapping
        this.isDialogueActive = true;
        
        // Pause player movement
        if (player.body) {
            player.body.setVelocity(0, 0);
        }
        
        console.log(`📚 Showing question ${this.globalQuestionIndex + 1}/3 for ${questionData.enemyName}`);
        
        // Create dialogue background
        const dialogueBox = this.scene.add.graphics();
        dialogueBox.fillStyle(0x000000, 0.8);
        dialogueBox.fillRoundedRect(50, 100, 700, 400, 10);
        dialogueBox.lineStyle(3, 0xffffff, 1);
        dialogueBox.strokeRoundedRect(50, 100, 700, 400, 10);
        dialogueBox.setScrollFactor(0);
        dialogueBox.setDepth(1000);
        
        // Enemy name
        const enemyNameText = this.scene.add.text(400, 130, questionData.enemyName, {
            fontSize: '24px',
            fill: '#ffff00',
            fontWeight: 'bold'
        });
        enemyNameText.setOrigin(0.5);
        enemyNameText.setScrollFactor(0);
        enemyNameText.setDepth(1001);
        
        // Question text
        const questionText = this.scene.add.text(400, 180, questionData.question, {
            fontSize: '20px',
            fill: '#ffffff',
            wordWrap: { width: 600 }
        });
        questionText.setOrigin(0.5);
        questionText.setScrollFactor(0);
        questionText.setDepth(1001);
        
        // Answer buttons
        const buttons = [];
        const buttonTexts = [];
        
        questionData.options.forEach((option, index) => {
            const buttonY = 250 + (index * 60);
            
            // Button background
            const button = this.scene.add.graphics();
            button.fillStyle(0x333333, 1);
            button.fillRoundedRect(100, buttonY, 600, 50, 5);
            button.lineStyle(2, 0x666666, 1);
            button.strokeRoundedRect(100, buttonY, 600, 50, 5);
            button.setScrollFactor(0);
            button.setDepth(1001);
            button.setInteractive(new Phaser.Geom.Rectangle(100, buttonY, 600, 50), Phaser.Geom.Rectangle.Contains);
            
            // Button text
            const buttonText = this.scene.add.text(400, buttonY + 25, `${index + 1}. ${option}`, {
                fontSize: '18px',
                fill: '#ffffff'
            });
            buttonText.setOrigin(0.5);
            buttonText.setScrollFactor(0);
            buttonText.setDepth(1002);
            
            // Button hover effects
            button.on('pointerover', () => {
                button.clear();
                button.fillStyle(0x555555, 1);
                button.fillRoundedRect(100, buttonY, 600, 50, 5);
                button.lineStyle(2, 0x888888, 1);
                button.strokeRoundedRect(100, buttonY, 600, 50, 5);
            });
            
            button.on('pointerout', () => {
                button.clear();
                button.fillStyle(0x333333, 1);
                button.fillRoundedRect(100, buttonY, 600, 50, 5);
                button.lineStyle(2, 0x666666, 1);
                button.strokeRoundedRect(100, buttonY, 600, 50, 5);
            });
            
            // Button click handler
            button.on('pointerdown', () => {
                this.handleAnswer(index, questionData.correctAnswer, player, tile, layer, {
                    dialogueBox, enemyNameText, questionText, buttons, buttonTexts
                });
            });
            
            buttons.push(button);
            buttonTexts.push(buttonText);
        });
        
        // Store UI elements for cleanup
        const uiElements = { dialogueBox, enemyNameText, questionText, buttons, buttonTexts };
        
        // Add keyboard support
        this.addKeyboardSupport(questionData, player, tile, layer, uiElements);
    }
    
    /**
     * Add keyboard support for dialogue
     */
    addKeyboardSupport(questionData, player, tile, layer, uiElements) {
        const keys = ['ONE', 'TWO', 'THREE', 'FOUR'].map(key => 
            this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[key])
        );
        
        const keyHandler = (event) => {
            const keyPressed = event.keyCode;
            let answerIndex = -1;
            
            if (keyPressed >= 49 && keyPressed <= 52) { // Keys 1-4
                answerIndex = keyPressed - 49;
            }
            
            if (answerIndex >= 0 && answerIndex < questionData.options.length) {
                this.handleAnswer(answerIndex, questionData.correctAnswer, player, tile, layer, uiElements);
                this.scene.input.keyboard.off('keydown', keyHandler);
            }
        };
        
        this.scene.input.keyboard.on('keydown', keyHandler);
    }
    
    /**
     * Handle player's answer
     */
    handleAnswer(selectedIndex, correctIndex, player, tile, layer, uiElements) {
        // Clean up UI
        this.cleanupDialogue(uiElements);
        
        // Clear dialogue active flag
        this.isDialogueActive = false;
        
        if (selectedIndex === correctIndex) {
            // Correct answer - progress to next question
            console.log('✅ Correct answer!');
            this.showFeedbackText(player.x, player.y - 50, 'Correct!', 0x00ff00);
            
            // Move to next question globally
            this.globalQuestionIndex++;
            
            // Get total questions for the enemy layer
            const totalQuestions = this.getAllEnemyQuestions().length;
            
            // Check if all questions are completed
            if (this.globalQuestionIndex >= totalQuestions) {
                console.log('🎉 All questions completed! Removing enemy layer automatically!');
                
                // Mark all enemies as defeated
                this.markAllEnemiesDefeated(layer);
                
                // Automatically remove the enemy layer
                this.removeEnemyLayer(layer);
                
                // Show victory message
                const centerX = this.scene.cameras.main.worldView.centerX;
                const centerY = this.scene.cameras.main.worldView.centerY;
                this.showVictoryMessage(centerX, centerY);
                
                this.showFeedbackText(player.x, player.y - 80, 'All Questions Complete!\nEnemy Layer Cleared!', 0xffd700);
            } else {
                console.log(`📚 Question ${this.globalQuestionIndex + 1}/${totalQuestions} next. Interact with any enemy to continue.`);
                this.showFeedbackText(player.x, player.y - 80, `Question ${this.globalQuestionIndex}/${totalQuestions} Complete!`, 0x00aa00);
            }
        } else {
            // Wrong answer - play hurt animation, don't progress
            console.log('❌ Wrong answer! Try again.');
            this.playHurtAnimation(player);
            this.showFeedbackText(player.x, player.y - 50, 'Wrong! Try Again!', 0xff0000);
        }
    }
    
    /**
     * Clean up dialogue UI elements
     */
    cleanupDialogue(uiElements) {
        const { dialogueBox, enemyNameText, questionText, buttons, buttonTexts } = uiElements;
        
        dialogueBox.destroy();
        enemyNameText.destroy();
        questionText.destroy();
        buttons.forEach(button => button.destroy());
        buttonTexts.forEach(text => text.destroy());
    }
    
    /**
     * Mark all enemies as defeated
     */
    markAllEnemiesDefeated(layer) {
        layer.forEachTile(tile => {
            if (tile && tile.index !== -1 && (tile.index === 607 || tile.index === 608 || tile.index === 609)) {
                this.defeatEnemy(tile, layer);
            }
        });
    }
    
    /**
     * Defeat enemy (make tile disappear)
     */
    defeatEnemy(tile, layer) {
        tile.isDefeated = true;
        tile.setVisible(false);
        tile.setAlpha(0);
        
        // Create victory effect
        const victoryGraphics = this.scene.add.graphics();
        victoryGraphics.fillStyle(0x00ff00, 0.6);
        victoryGraphics.fillCircle(
            tile.pixelX + layer.x + tile.width/2, 
            tile.pixelY + layer.y + tile.height/2, 
            50
        );
        victoryGraphics.setDepth(100);
        
        // Animate victory effect
        this.scene.tweens.add({
            targets: victoryGraphics,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                victoryGraphics.destroy();
            }
        });
    }
    
    /**
     * Play hurt animation on player
     */
    playHurtAnimation(player) {
        // Play hurt animation if available
        if (player.anims && this.scene.animationManager) {
            this.scene.animationManager.playAnimation(player, 'hurt', true);
        }
        
        // Red flash effect
        const originalTint = player.tint;
        player.setTint(0xff0000);
        
        this.scene.time.delayedCall(200, () => {
            player.setTint(originalTint);
        });
        
        // Slight knockback
        if (player.body) {
            player.body.setVelocity(
                Phaser.Math.Between(-100, 100),
                Phaser.Math.Between(-100, 100)
            );
        }
    }
    
    /**
     * Show feedback text
     */
    showFeedbackText(x, y, text, color = 0x00ff00) {
        const feedbackText = this.scene.add.text(x, y, text, {
            fontSize: '24px',
            fill: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 3,
            fontWeight: 'bold'
        });
        
        feedbackText.setOrigin(0.5);
        feedbackText.setDepth(200);
        
        // Animate the feedback text
        this.scene.tweens.add({
            targets: feedbackText,
            y: y - 80,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                feedbackText.destroy();
            }
        });
    }
    
    /**
     * Check if all enemies in the layer are defeated
     */
    checkAllEnemiesDefeated(layer, autoRemove = true) {
        let allDefeated = true;
        let totalEnemies = 0;
        let defeatedEnemies = 0;
        
        // Check all tiles in the enemy layer
        layer.forEachTile(tile => {
            if (tile && tile.index !== -1 && (tile.index === 607 || tile.index === 608 || tile.index === 609)) {
                totalEnemies++;
                if (tile.isDefeated) {
                    defeatedEnemies++;
                } else {
                    allDefeated = false;
                }
            }
        });
        
        console.log(`🎯 Enemy Progress: ${defeatedEnemies}/${totalEnemies} enemies defeated`);
        
        if (allDefeated && totalEnemies > 0) {
            // Set flag that all enemies are defeated
            this.allEnemiesDefeated = true;
            
            if (autoRemove) {
                console.log('🎉 ALL ENEMIES DEFEATED! Removing enemy layer...');
                this.removeEnemyLayer(layer);
                
                // Show victory message
                const centerX = this.scene.cameras.main.worldView.centerX;
                const centerY = this.scene.cameras.main.worldView.centerY;
                this.showVictoryMessage(centerX, centerY);
            } else {
                console.log('🎉 ALL ENEMIES DEFEATED! Press SPACE (attack) to remove enemy layer!');
                
                // Show instruction message
                const centerX = this.scene.cameras.main.worldView.centerX;
                const centerY = this.scene.cameras.main.worldView.centerY;
                this.showFeedbackText(centerX, centerY - 100, 'All Enemies Defeated!\nPress SPACE to clear layer!', 0xffd700);
            }
        } else {
            this.allEnemiesDefeated = false;
        }
        
        return allDefeated;
    }
    
    /**
     * Remove the entire enemy layer
     */
    removeEnemyLayer(layer) {
        // Create dramatic removal effect
        const removalEffect = this.scene.add.graphics();
        removalEffect.fillStyle(0xffd700, 0.8); // Gold color
        removalEffect.fillRect(0, 0, this.scene.cameras.main.width, this.scene.cameras.main.height);
        removalEffect.setScrollFactor(0);
        removalEffect.setDepth(500);
        
        // Flash effect
        this.scene.tweens.add({
            targets: removalEffect,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                removalEffect.destroy();
            }
        });
        
        // Actually remove the layer
        if (layer) {
            layer.setVisible(false);
            layer.setActive(false);
            
            // Remove from layers array
            const layerIndex = this.layers.findIndex(l => l.layer === layer);
            if (layerIndex !== -1) {
                this.layers.splice(layerIndex, 1);
                console.log('✅ Enemy layer removed from layers array');
            }
        }
        
        
        console.log('🎊 Enemy layer completely removed!');
    }
    
    /**
     * Show victory message when all enemies are defeated
     */
    showVictoryMessage(x, y) {
        const victoryText = this.scene.add.text(x, y - 50, 'ALL ENEMIES DEFEATED!\nYOU ARE VICTORIOUS!', {
            fontSize: '32px',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4,
            fontWeight: 'bold',
            align: 'center'
        });
        
        victoryText.setOrigin(0.5);
        victoryText.setScrollFactor(0);
        victoryText.setDepth(600);
        
        // Create return to index button
        const buttonBackground = this.scene.add.graphics();
        buttonBackground.fillStyle(0x4CAF50, 1); // Green color
        buttonBackground.fillRoundedRect(x - 100, y + 50, 200, 60, 10);
        buttonBackground.lineStyle(3, 0xffffff, 1);
        buttonBackground.strokeRoundedRect(x - 100, y + 50, 200, 60, 10);
        buttonBackground.setScrollFactor(0);
        buttonBackground.setDepth(601);
        buttonBackground.setInteractive(new Phaser.Geom.Rectangle(x - 100, y + 50, 200, 60), Phaser.Geom.Rectangle.Contains);
        
        // Button text
        const buttonText = this.scene.add.text(x, y + 80, 'Return to Menu', {
            fontSize: '20px',
            fill: '#ffffff',
            fontWeight: 'bold'
        });
        buttonText.setOrigin(0.5);
        buttonText.setScrollFactor(0);
        buttonText.setDepth(602);
        
        // Button hover effects
        buttonBackground.on('pointerover', () => {
            buttonBackground.clear();
            buttonBackground.fillStyle(0x66BB6A, 1); // Lighter green
            buttonBackground.fillRoundedRect(x - 100, y + 50, 200, 60, 10);
            buttonBackground.lineStyle(3, 0xffffff, 1);
            buttonBackground.strokeRoundedRect(x - 100, y + 50, 200, 60, 10);
        });
        
        buttonBackground.on('pointerout', () => {
            buttonBackground.clear();
            buttonBackground.fillStyle(0x4CAF50, 1); // Original green
            buttonBackground.fillRoundedRect(x - 100, y + 50, 200, 60, 10);
            buttonBackground.lineStyle(3, 0xffffff, 1);
            buttonBackground.strokeRoundedRect(x - 100, y + 50, 200, 60, 10);
        });
        
        // Button click handler
        buttonBackground.on('pointerdown', () => {
            console.log('🏠 Returning to index page...');
            
            // Add click effect
            this.scene.tweens.add({
                targets: [buttonBackground, buttonText],
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    // Redirect to index page
                    window.location.href = '/';
                }
            });
        });
        
        // Animate victory text
        this.scene.tweens.add({
            targets: victoryText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                // Keep victory text visible (don't fade out)
                // Button remains clickable
            }
        });
        
        // Animate button entrance
        buttonBackground.setAlpha(0);
        buttonText.setAlpha(0);
        
        this.scene.tweens.add({
            targets: [buttonBackground, buttonText],
            alpha: 1,
            duration: 1000,
            delay: 1500, // Show button after victory text animation
            ease: 'Power2'
        });
    }
    
    
    
    /**
     * Check proximity to enemies and handle interactions
     * Call this from the scene's update loop
     */
    checkEnemyProximity(player) {
        // Only check if enemy layer exists and dialogue is not active
        if (!this.enemyLayer || this.isDialogueActive) {
            return;
        }
        
        const interactionDistance = 40; // Smaller interaction zone (40 pixels)
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        
        // Check all enemy tiles
        this.enemyLayer.forEachTile(tile => {
            if (tile && tile.index !== -1 && (tile.index === 607 || tile.index === 608 || tile.index === 609)) {
                // Skip if already defeated
                if (tile.isDefeated) {
                    return;
                }
                
                // Calculate tile center position in world coordinates
                const tileWorldX = tile.pixelX + this.enemyLayer.x + (tile.width / 2);
                const tileWorldY = tile.pixelY + this.enemyLayer.y + (tile.height / 2);
                
                // Calculate distance from player to tile center
                const distance = Phaser.Math.Distance.Between(
                    player.x, player.y,
                    tileWorldX, tileWorldY
                );
                
                // Check if within interaction distance and closer than previous
                if (distance <= interactionDistance && distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = tile;
                }
            }
        });
        
        // Handle interaction with nearest enemy if found
        if (nearestEnemy) {
            // Check cooldown
            if (nearestEnemy.enemyInteractionCooldown && Date.now() - nearestEnemy.enemyInteractionCooldown < 1000) {
                return;
            }
            
            // Trigger interaction
            this.handleEnemyInteraction(player, nearestEnemy, this.enemyLayer);
        }
    }
    
    /**
     * Find a spawn point by name from the Tiled map
     * @param {string} name - Name of the spawn point (e.g., 'player', 'enemy1')
     * @returns {Phaser.Math.Vector2|null} Position of the spawn point or null if not found
     */
    findSpawnPoint(name = 'player') {
        console.group('findSpawnPoint Debug');
        console.log('Looking for spawn point named:', name);
        
        if (!this.map) {
            console.error('Map not loaded, cannot find spawn point');
            console.groupEnd();
            return null;
        }
        
        // Method 1: Try to find the object directly in the map
        if (this.map.objects) {
            console.log('Looking in map.objects...', this.map.objects);
            for (const layerName in this.map.objects) {
                const layer = this.map.objects[layerName];
                console.log(`Checking layer: ${layerName}`, layer);
                
                if (layer && Array.isArray(layer)) {
                    const obj = layer.find(o => o.name === name);
                    if (obj) {
                        console.log('Found spawn point in map.objects:', obj);
                        console.groupEnd();
                        return new Phaser.Math.Vector2(
                            obj.x + (obj.width || 0) / 2,
                            obj.y - (obj.height || 0) / 2
                        );
                    }
                }
            }
        }
        
        // Method 2: Try to find in map.layers
        if (this.map.layers) {
            console.log('Looking in map.layers...');
            for (const layer of this.map.layers) {
                console.log(`Checking layer: ${layer.name} (${layer.type})`);
                
                // Check if this is an object layer with objects
                if ((layer.type === 'objectgroup' || layer.objects) && layer.objects) {
                    console.log(`Found object layer: ${layer.name} with ${layer.objects.length} objects`);
                    
                    // Try to find the spawn point by name
                    const spawnObj = layer.objects.find(obj => obj.name === name);
                    if (spawnObj) {
                        console.log('Found spawn point:', spawnObj);
                        console.groupEnd();
                        return new Phaser.Math.Vector2(
                            spawnObj.x + (spawnObj.width || 0) / 2,
                            spawnObj.y - (spawnObj.height || 0) / 2
                        );
                    }
                }
            }
        }
        
        // Method 3: Try using getObjectLayer if available
        if (this.map.getObjectLayer) {
            console.log('Trying getObjectLayer...');
            const layerNames = ['SpawnPoints', 'Spawners', 'Objects', 'Object Layer 1'];
            
            for (const layerName of layerNames) {
                try {
                    const layer = this.map.getObjectLayer(layerName);
                    if (layer && layer.objects) {
                        console.log(`Found layer via getObjectLayer('${layerName}'):`, layer);
                        const spawnObj = layer.objects.find(obj => obj.name === name);
                        if (spawnObj) {
                            console.log('Found spawn point:', spawnObj);
                            console.groupEnd();
                            return new Phaser.Math.Vector2(
                                spawnObj.x + (spawnObj.width || 0) / 2,
                                spawnObj.y - (spawnObj.height || 0) / 2
                            );
                        }
                    }
                } catch (e) {
                    console.log(`Layer '${layerName}' not found via getObjectLayer`);
                }
            }
        }
        
        // If we get here, we couldn't find the spawn point
        console.warn('Spawn point not found. Available layers:', 
            this.map.layers ? this.map.layers.map(l => `${l.name} (${l.type})`).join(', ') : 'No layers');
            
        if (this.map.objects) {
            console.log('Map objects structure:', Object.keys(this.map.objects));
        }
        
        console.groupEnd();
        return null;
    }
}

// Flexible Asset Manager that works with different sprite sheet formats
class AssetManager {
    constructor(scene) {
        this.scene = scene;
        // Sprite configuration - updated with correct frame counts
        this.spriteConfig = {
            frameWidth: 96,  // Change this for different sprite sizes
            frameHeight: 96, // Change this for different sprite sizes
            
            // Animation configurations - updated with your specific frame counts
            animations: {
                idle: {
                    frames: 7,      // Updated: 7 frames for idle
                    frameRate: 6,   // Speed of animation
                    repeat: -1,     // Loop forever
                    repeatDelay: 1000 // Pause between loops
                },
                walk: {
                    frames: 8,      // 8 frames for walk
                    frameRate: 8,
                    repeat: -1,
                    repeatDelay: 0
                },
                attack: {
                    frames: 6,      // 6 frames for attack
                    frameRate: 10,
                    repeat: 0,      // Play once
                    repeatDelay: 0
                },
                hurt: {
                    frames: 4,      // Updated: 4 frames for hurt
                    frameRate: 8,
                    repeat: 2,      // Flash a few times
                    repeatDelay: 0
                }
            }
        };
    }
    
    preloadAssets() {
        console.log('Starting asset preloading...');
        const progress = this.scene.add.graphics();
        
        // Show loading progress
        this.scene.load.on('progress', (value) => {
            progress.clear();
            progress.fillStyle(0xffffff, 0.5);
            progress.fillRect(20, this.scene.sys.game.config.height / 2 - 10, 
                           (this.scene.sys.game.config.width - 40) * value, 20);
        });
        
        const baseUrl = 'images/characters/player/';
        
        console.log('Loading character sprites...');
        
        // Load each sprite sheet with specific frame configurations
        try {
            // Load idle animation (7 frames)
            this.scene.load.spritesheet('idle', baseUrl + 'idle.png', {
                frameWidth: 96,
                frameHeight: 96
            });
            
            // Load walk animation (8 frames)
            this.scene.load.spritesheet('walk', baseUrl + 'walk.png', {
                frameWidth: 96,
                frameHeight: 96
            });
            
            // Load attack animation (6 frames)
            this.scene.load.spritesheet('attack', baseUrl + 'attack.png', {
                frameWidth: 96,
                frameHeight: 96
            });
            
            // Load hurt animation (4 frames)
            this.scene.load.spritesheet('hurt', baseUrl + 'hurt.png', {
                frameWidth: 96,
                frameHeight: 96
            });
            
            // Load map assets
            console.log('Loading map assets...');
            this.scene.load.tilemapTiledJSON('map', 'images/maps2/map.tmj');
            console.log('Loading map tilesets...');
            this.scene.load.image('tiles', 'images/maps2/tiles.png');
            this.scene.load.image('assets', 'images/maps2/assets.png');
            // Load S_Attack tileset for enemies
            console.log('Loading S_Attack tileset for enemies...');
            this.scene.load.image('S_Attack', 'images/maps2/S_Attack.png');
            
            // Add load event handlers for tileset images
            this.scene.load.on('filecomplete-image-tiles', (key, type, data) => {
                console.log('Tiles tileset loaded:', data.width, 'x', data.height);
            });
            this.scene.load.on('filecomplete-image-assets', (key, type, data) => {
                console.log('Assets tileset loaded:', data.width, 'x', data.height);
            });
            this.scene.load.on('filecomplete-image-S_Attack', (key, type, data) => {
                console.log('✅ S_Attack tileset loaded successfully:', data.width, 'x', data.height);
                console.log('Expected: 576x96 (18 columns x 3 rows of 32x32 tiles)');
            });
            
            // Add error handler specifically for S_Attack
            this.scene.load.on('loaderror', (file) => {
                if (file.key === 'S_Attack') {
                    console.error('❌ FAILED TO LOAD S_Attack tileset!');
                    console.error('File path:', file.src);
                    console.error('This will cause enemy sprites to not display');
                }
            });
            
            // Handle load complete
            this.scene.load.once('complete', () => {
                console.log('All assets loaded successfully');
                
                // Verify each character texture was loaded with frames
                const expectedFrames = { idle: 7, walk: 8, attack: 6, hurt: 4 };
                let allValid = true;
                
                Object.entries(expectedFrames).forEach(([key, expected]) => {
                    if (this.scene.textures.exists(key)) {
                        const texture = this.scene.textures.get(key);
                        const actualFrames = texture.frameTotal;
                        console.log(`✓ Texture '${key}' loaded with ${actualFrames} frames`);
                        
                        if (actualFrames === 0) {
                            console.error(`✗ Texture '${key}' has no frames - check sprite sheet format!`);
                            allValid = false;
                        }
                    } else {
                        console.error(`✗ Texture '${key}' failed to load`);
                        allValid = false;
                    }
                });
                
                if (!allValid) {
                    console.error('SPRITE LOADING FAILED - Check:');
                    console.error('1. Files exist at: images/characters/player/');
                    console.error('2. Files are valid PNG format');
                    console.error('3. Each frame is exactly 96x96 pixels');
                    console.error('4. Sprites are arranged horizontally in a single row');
                }
                
                progress.destroy();
                gameState.assetsLoaded = allValid;
            });
            
            // Handle load errors
            this.scene.load.on('loaderror', (file) => {
                console.error(`✗ FAILED TO LOAD: ${file.key} from ${file.src}`);
                console.error('Check that the file exists and is accessible');
            });
            
        } catch (error) {
            console.error('Error in preloadAssets:', error);
            progress.destroy();
            gameState.assetsLoaded = false;
        }
    }
}

// Dialogue Manager
class DialogueManager {
    constructor(scene) {
        this.scene = scene;
        this.dialogueBox = null;
        this.dialogueText = null;
        this.currentDialogue = [];
        this.dialogueIndex = 0;
        this.isVisible = false;
        this.callback = null;
        this.autoAdvance = true; // Enable auto-advance by default
        this.autoAdvanceTimer = null;
        
        // Configurable timing settings (in milliseconds)
        this.timingSettings = {
            baseTime: 2000,        // Base time for short messages (2 seconds)
            timePerCharacter: 50,  // Additional time per character (50ms per char)
            minTime: 1500,         // Minimum display time (1.5 seconds)
            maxTime: 6000          // Maximum display time (6 seconds)
        };
    }

    create() {
        console.log('Creating dialogue UI elements...');
        
        // Create dialogue box with a very high depth to ensure it's on top
        this.dialogueBox = this.scene.add.graphics()
            .fillStyle(0x000000, 0.7)
            .fillRoundedRect(50, this.scene.game.config.height - 150, 
                           this.scene.game.config.width - 100, 120, 10)
            .setDepth(10000);  // Very high depth to ensure it's on top
        
        // Create dialogue text with depth
        this.dialogueText = this.scene.add.text(
            80, 
            this.scene.game.config.height - 130, 
            'DIALOGUE TEXT SHOULD APPEAR HERE', 
            { 
                font: 'bold 18px Arial', 
                fill: '#ffffff',
                backgroundColor: '#ff0000',  // Red background to make it visible
                padding: { x: 10, y: 5 },
                wordWrap: { width: this.scene.game.config.width - 160 },
                lineSpacing: 8
            }
        ).setDepth(10001);  // Higher than the box
        
        // Create continue prompt (shows auto-advance info)
        this.continueText = this.scene.add.text(
            this.scene.game.config.width - 200,  // Moved left to be more visible
            this.scene.game.config.height - 50,  // Moved down slightly
            'Auto-advancing...',
            { 
                font: 'bold 14px Arial', 
                fill: '#ffff00',  // Yellow for better visibility
                backgroundColor: '#0000aa',  // Blue background
                padding: { x: 10, y: 5 }
            }
        ).setDepth(10001);  // Same as text
        
        // Bring to front
        this.dialogueBox.setScrollFactor(0);
        this.dialogueText.setScrollFactor(0);
        this.continueText.setScrollFactor(0);
        
        // Set initial visibility
        this.setVisible(true);  // Temporarily set to true for testing
        
        // Set up input
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Log creation
        console.log('Dialogue UI elements created with depths:', {
            box: this.dialogueBox.depth,
            text: this.dialogueText.depth,
            continueText: this.continueText.depth
        });
    }
    
    startDialogue(dialogue, callback = null, autoAdvance = true) {
        if (!Array.isArray(dialogue)) {
            dialogue = [dialogue];
        }
        
        this.currentDialogue = dialogue;
        this.dialogueIndex = 0;
        this.callback = callback;
        this.autoAdvance = autoAdvance;
        this.showNextDialogue();
        this.setVisible(true);
    }
    
    /**
     * Calculate display time based on text length
     */
    calculateDisplayTime(text) {
        const charCount = text.length;
        const calculatedTime = this.timingSettings.baseTime + (charCount * this.timingSettings.timePerCharacter);
        
        // Clamp between min and max time
        return Math.max(
            this.timingSettings.minTime,
            Math.min(calculatedTime, this.timingSettings.maxTime)
        );
    }
    
    /**
     * Set custom timing settings
     */
    setTimingSettings(settings) {
        this.timingSettings = { ...this.timingSettings, ...settings };
        console.log('Dialogue timing updated:', this.timingSettings);
    }
    
    showNextDialogue() {
        // Clear any existing timer
        if (this.autoAdvanceTimer) {
            this.autoAdvanceTimer.remove();
            this.autoAdvanceTimer = null;
        }
        
        if (this.dialogueIndex < this.currentDialogue.length) {
            const text = this.currentDialogue[this.dialogueIndex];
            this.dialogueText.setText(text);
            
            // Update continue text based on auto-advance mode
            if (this.autoAdvance) {
                const displayTime = this.calculateDisplayTime(text);
                const seconds = Math.ceil(displayTime / 1000);
                this.continueText.setText(`Auto-advancing in ${seconds}s...`);
                
                // Set up auto-advance timer
                this.autoAdvanceTimer = this.scene.time.delayedCall(displayTime, () => {
                    const hasMore = this.showNextDialogue();
                    if (!hasMore) {
                        this.scene.events.emit('dialogueComplete');
                    }
                });
                
                console.log(`Dialogue "${text}" will auto-advance in ${displayTime}ms`);
            } else {
                this.continueText.setText('Press SPACE to continue');
            }
            
            this.dialogueIndex++;
            return true;
        } else {
            this.setVisible(false);
            if (this.callback) {
                this.callback();
            }
            return false;
        }
    }
    
    update() {
        // Allow manual advance with SPACE even in auto-advance mode (skip waiting)
        if (this.isVisible && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            // Clear auto-advance timer if manually advancing
            if (this.autoAdvanceTimer) {
                this.autoAdvanceTimer.remove();
                this.autoAdvanceTimer = null;
            }
            
            const hasMore = this.showNextDialogue();
            if (!hasMore) {
                this.scene.events.emit('dialogueComplete');
            }
        }
    }
    
    setVisible(visible) {
        this.isVisible = visible;
        if (this.dialogueBox) {
            this.dialogueBox.setVisible(visible);
            this.dialogueBox.setDepth(10000);
        }
        if (this.dialogueText) {
            this.dialogueText.setVisible(visible);
            this.dialogueText.setDepth(10001);
        }
        if (this.continueText) {
            this.continueText.setVisible(visible);
            this.continueText.setDepth(10001);
        }
    }
}

// Tutorial Scene
class TutorialScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TutorialScene' });
        this.player = null;
        this.playerController = null;
        this.animationManager = null;
        this.mapManager = null;
        this.debugManager = null;
        this.assetManager = null;
        this.dialogueManager = null;
        this.tutorialManager = null;
        this.movementTutorialComplete = false;
        this.cursors = null;
    }
    
    create() {
        console.log('TutorialScene: Initializing...');
        
        // Set up input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.addKey('W');
        this.input.keyboard.addKey('A');
        this.input.keyboard.addKey('S');
        this.input.keyboard.addKey('D');
        
        // Capture TAB at the scene level and toggle debug using Phaser keyboard events
        this.input.keyboard.addCapture('TAB');
        this.input.keyboard.on('keydown-TAB', (event) => {
            const target = document.activeElement;
            const isFormField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            if (!isFormField && event && event.preventDefault) {
                event.preventDefault();
                // Prevent other global key handlers from also toggling (avoid double-toggle)
                if (event.stopImmediatePropagation) {
                    try { event.stopImmediatePropagation(); } catch (e) { /* ignore */ }
                }
            }
            
            // Use unified setter so we can trace who toggled debug mode
            try {
                if (typeof window !== 'undefined' && window.setDebugMode) {
                    window.setDebugMode(undefined, 'TutorialScene.scene-level-TAB');
                } else {
                    gameState.debugMode = !gameState.debugMode;
                    console.log('Debug mode:', gameState.debugMode ? 'ON' : 'OFF');
                }
            } catch (e) {
                console.warn('Scene-level debug toggle failed:', e);
            }
            // Mark last toggle timestamp so any global fallback handlers ignore this event (avoid double-toggle)
            try { this._lastTabToggleTs = performance.now(); if (typeof window !== 'undefined') window.__lastDebugToggleTs = this._lastTabToggleTs; } catch (e) { }
            
            if (this.debugManager) {
                this.debugManager.toggleCollisionDebug();
                if (!gameState.debugMode) {
                    this.debugManager.clearCollisionGraphics();
                }
            }
        });

        // Direct collision box click handler - simple approach
        this.input.on('pointerdown', (pointer) => {
            // Only work in debug mode
            if (!gameState.debugMode) return;
            
            // Get world coordinates
            const worldX = pointer.worldX || (pointer.x + this.cameras.main.worldView.x);
            const worldY = pointer.worldY || (pointer.y + this.cameras.main.worldView.y);
            
            // Check all collision layers for tiles at this position
            if (this.mapManager && this.mapManager.layers) {
                this.mapManager.layers.forEach(layerData => {
                    if (!layerData.collision || !layerData.layer) return;
                    
                    const tile = layerData.layer.getTileAtWorldXY(worldX, worldY);
                    if (tile && tile.index > 0) {
                        // Toggle collision for this tile
                        const wasColliding = tile.collides;
                        if (wasColliding) {
                            tile.setCollision(false, false, false, false);
                            console.log(`Disabled collision for tile at ${tile.x},${tile.y} in layer ${layerData.name}`);
                        } else {
                            tile.setCollision(true, true, true, true);
                            console.log(`Enabled collision for tile at ${tile.x},${tile.y} in layer ${layerData.name}`);
                        }
                        
                        // Refresh physics world
                        if (this.physics && this.physics.world && this.physics.world.colliders) {
                            try { this.physics.world.colliders.refresh(); } catch (e) {}
                        }
                        
                        // Force visual update if collision debug is active
                        if (this.debugManager && this.debugManager.collisionDebugSystem && this.debugManager.collisionDebugSystem.enabled) {
                            // Clear graphics and re-render to show color changes
                            if (this.debugManager.collisionDebugSystem.graphics) {
                                this.debugManager.collisionDebugSystem.graphics.clear();
                            }
                            this.debugManager.collisionDebugSystem.render();
                        }
                        
                        return; // Only toggle the first tile found
                    }
                });
            }
        });
        
        // Clear any existing game objects first
        this.children.removeAll();
        
        // Initialize managers
        console.log('Initializing AnimationManager...');
        this.animationManager = new AnimationManager(this);
        
        console.log('Initializing MapManager...');
        this.mapManager = new MapManager(this);
        
        console.log('Initializing DebugManager...');
        this.debugManager = new window.DebugManager(this);
        
        console.log('Initializing AssetManager...');
        this.assetManager = new AssetManager(this);
        
        console.log('Initializing DialogueManager...');
        this.dialogueManager = new DialogueManager(this);
        
        // Initialize dialogue manager
        console.log('Creating DialogueManager UI...');
        this.dialogueManager.create();
        
        // Configure dialogue timing (you can adjust these values)
        this.dialogueManager.setTimingSettings({
            baseTime: 2500,        // Base time for short messages (2.5 seconds)
            timePerCharacter: 40,  // Additional time per character (40ms per char)
            minTime: 2000,         // Minimum display time (2 seconds)
            maxTime: 7000          // Maximum display time (7 seconds)
        });
        
        // Load assets first, then create map
        console.log('Preloading assets...');
        this.assetManager.preloadAssets();
        
        // Wait for assets to load before creating the map
        this.load.once('complete', () => {
            console.log('Assets loaded, creating map...');
            this.mapManager.createMap();
            
            // Initialize tutorial manager if available
            console.log('Checking for TutorialManager...');
            console.log('window.TutorialManagers:', typeof window.TutorialManagers);
            console.log('window.TutorialManagers.TutorialManager:', typeof window.TutorialManagers?.TutorialManager);
            
            if (window.TutorialManagers && window.TutorialManagers.TutorialManager) {
                console.log('Initializing TutorialManager...');
                this.tutorialManager = new window.TutorialManagers.TutorialManager(this);
                this.tutorialManager.create();
                console.log('TutorialManager initialized, movementComplete:', this.tutorialManager.movementComplete);
                
                // Start the tutorial after a short delay
                this.time.delayedCall(1000, () => {
                    console.log('Starting tutorial...');
                    this.tutorialManager.startTutorial();
                });
            } else {
                console.warn('TutorialManager not found, using fallback tutorial system');
                this.setupFallbackTutorial();
            }
            
            // Initialize the game
            this.initializeGame();
        });
        
        // Handle loading errors
        this.load.on('loaderror', (file) => {
            console.error(`Failed to load asset: ${file.key} from ${file.src}`);
            console.error('Creating fallback world due to loading error');
            this.mapManager.createFallbackWorld();
        });
        
        // Fallback initialization in case assets don't load properly
        this.time.delayedCall(2000, () => {
            if (!gameState.gameReady) {
                console.warn('Assets may not have loaded properly, forcing game initialization...');
                this.mapManager.createFallbackWorld();
                this.initializeGame();
            }
        });
        
        // Start the loading process
        this.load.start();
        
        // Check if loading is already complete (in case assets are cached)
        if (this.load.isReady()) {
            console.log('Assets already loaded, initializing immediately...');
            this.mapManager.createMap();
            this.initializeGame();
        }
    }
    
    
    initializeGame() {
        // Prevent duplicate initialization
        if (this._gameInitialized) {
            console.log('Game already initialized, skipping...');
            return;
        }
        
        console.log('Initializing tutorial with loaded assets...');
        this._gameInitialized = true;
        
        // Create player
        this.createPlayer();
        
        // Set up camera
        this.setupCamera();
        
        // Set up collisions
        this.setupCollisions();
        
        // Create animations
        this.createAnimationsAndStart();
        
        // Start the tutorial
        if (this.tutorialManager) {
            console.log('Starting tutorial manager...');
            this.tutorialManager.startTutorial();
        } else {
            console.log('Starting fallback tutorial...');
            this.startMovementTutorial();
        }
        
        console.log('Tutorial initialization complete');
    }
    
    setupFallbackTutorial() {
        // Fallback tutorial system if TutorialManager is not available
        console.log('Setting up fallback tutorial system...');
        
        // Allow movement immediately in fallback mode
        this.movementTutorialComplete = true;
        
        // Show a simple welcome message
        if (this.dialogueManager) {
            this.time.delayedCall(3000, () => {
                this.dialogueManager.startDialogue([
                    'Welcome to CodeQuest!',
                    'Use WASD or arrow keys to move around.',
                    'Press SPACE to attack.',
                    'Press TAB to toggle debug mode.'
                ]);
            });
        }
        
        this.events.on('movementTutorialComplete', () => {
            this.movementTutorialComplete = true;
            if (this.dialogueManager) {
                this.dialogueManager.startDialogue([
                    'Great job! You\'ve learned how to move around.',
                    'Now let\'s learn how to interact with objects in the game.'
                ], () => {
                    // Continue to next tutorial section
                    this.startInteractionTutorial();
                });
            }
        });
        
        console.log('Fallback tutorial system initialized - movement enabled');
    }
    
    startMovementTutorial() {
        console.log('Starting movement tutorial...');
        if (this.tutorialManager) {
            this.tutorialManager.startTutorial();
        } else {
            // Fallback movement tutorial
            this.dialogueManager.startDialogue([
                'Welcome to CodeQuest! Let\'s learn how to move around.',
                'Use the WASD keys or arrow keys to move your character.',
                'Try moving around now!'
            ], () => {
                // Enable movement after the dialogue is complete
                this.movementTutorialComplete = true;
                
                // Set up movement detection
                const movementCheck = () => {
                    if (this.cursors.left.isDown || this.cursors.right.isDown || 
                        this.cursors.up.isDown || this.cursors.down.isDown) {
                        // Player moved, complete the tutorial
                        this.events.emit('movementTutorialComplete');
                    } else {
                        // Keep checking for movement
                        this.time.delayedCall(100, movementCheck);
                    }
                };
                
                // Start checking for movement
                movementCheck();
            });
        }
    }
    
    startInteractionTutorial() {
        // This function would contain the next part of the tutorial
        this.dialogueManager.startDialogue([
            'To interact with objects, move close to them and press the E key.',
            'Try interacting with the computer terminal in front of you.'
        ]);
    }
    
    createAnimationsAndStart() {
        console.log('Creating animations and starting game...');
        
        // Create animations
        const success = this.animationManager.createAnimations();
        
        // Always mark game as ready, even if animations fail
        setTimeout(() => {
            gameState.gameReady = true;
            console.log('Game ready! (Animation success:', success, ', Player exists:', !!this.player, ')');
            
            if (success && this.player && this.animationManager) {
                console.log('Starting idle animation...');
                this.animationManager.playAnimation(this.player, 'idle', true);
            } else {
                console.warn('Animations or player not ready, but game will still work');
                if (!success) console.warn('- Animation creation failed');
                if (!this.player) console.warn('- Player not created');
                if (!this.animationManager) console.warn('- AnimationManager not available');
            }
        }, 100);
    }
    
    createPlayer() {
        console.log('Creating single player sprite...');
        
        // Verify idle texture exists and has frames
        if (!this.textures.exists('idle')) {
            console.error('CRITICAL: Idle texture not found! Cannot create player.');
            return;
        }
        
        const idleTexture = this.textures.get('idle');
        console.log(`Idle texture info: ${idleTexture.frameTotal} total frames`);
        
        if (idleTexture.frameTotal === 0) {
            console.error('CRITICAL: Idle texture has no frames! Check sprite sheet format.');
            return;
        }
        
        // Destroy any existing player first
        if (this.player) {
            console.log('Removing existing player...');
            this.player.destroy();
            this.player = null;
        }
        
        console.group('Player Creation');
        console.log('Creating player...');
        
        // Default to center of screen
        const screenCenterX = this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.height / 2;
        let spawnX = screenCenterX;
        let spawnY = screenCenterY;
        let spawnSource = 'screen center';
        
        if (this.mapManager) {
            console.log('Looking for spawn point in map...');
            const spawnPoint = this.mapManager.findSpawnPoint('player');
            
            if (spawnPoint) {
                spawnX = spawnPoint.x;
                spawnY = spawnPoint.y;
                spawnSource = 'Tiled map spawn point';
                console.log(`Using spawn point from Tiled map: ${spawnX}, ${spawnY}`);
            } else {
                console.warn('No spawn point found in Tiled map, using default position');
                spawnSource = 'default (spawn point not found)';
            }
        } else {
            console.warn('MapManager not available, using default spawn position');
            spawnSource = 'default (MapManager not available)';
        }
        
        console.log(`Final spawn position: ${spawnX}, ${spawnY} (Source: ${spawnSource})`);
        
        // Create sprite with explicit frame 0 to ensure single sprite
        console.log('Creating player sprite...');
        this.player = this.physics.add.sprite(spawnX, spawnY, 'idle', 0);

        // Many Tiled maps place object spawn points at the "feet" of a character.
        // By default Phaser positions sprites by their center. Set origin to
        // bottom-center so the Tiled y coordinate lines up with the player's feet.
        try {
            this.player.setOrigin(0.5, 1);
        } catch (e) {
            console.warn('Unable to set player origin to bottom-center:', e);
        }
        
        // Add a temporary debug graphic to show the spawn position
        if (this.player) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xff0000, 0.5);
            graphics.fillCircle(spawnX, spawnY, 10); // Red circle at spawn point
            graphics.setDepth(1000);
            
            // Remove after a delay
            this.time.delayedCall(3000, () => {
                graphics.destroy();
            });
            
            console.log('Player created successfully at:', spawnX, spawnY);
        } else {
            console.error('Failed to create player sprite!');
        }
        
        console.groupEnd();
        
        // Configure player properties
        this.player.setCollideWorldBounds(true);
        this.player.setSize(64, 64); // Collision box
        this.player.setScale(1); // Normal scale
        this.player.setDepth(100); // Ensure player is above background
        
        // Verify single sprite creation
        console.log(`Player sprite created:`, {
            texture: this.player.texture.key,
            frame: this.player.frame.name,
            position: { x: this.player.x, y: this.player.y },
            scale: this.player.scale,
            visible: this.player.visible
        });
        
        // Debug player physics body
        console.log('Player physics body check:', {
            hasBody: !!this.player.body,
            bodyType: this.player.body?.constructor?.name,
            position: this.player.body ? { x: this.player.body.x, y: this.player.body.y } : 'No body'
        });
        
        // Set up player controller
        this.playerController = new PlayerController(this, this.player);
        
        console.log('✓ Single player sprite created successfully');
    }
    
    setupCamera() {
        const camera = this.cameras.main;
        
        camera.startFollow(this.player, true, 0.08, 0.08);
        camera.setZoom(1);
        camera.setRoundPixels(true);
        camera.setDeadzone(100, 80);
        
        if (this.mapManager && this.mapManager.map) {
            camera.setBounds(
                0, 
                0, 
                this.mapManager.map.widthInPixels, 
                this.mapManager.map.heightInPixels
            );
        }
        
        console.log('Camera configured');
    }
    
    setupCollisions() {
        this.mapManager.setupCollisions(this.player);
        console.log('Collisions configured');
    }
    
    update() {
    // Only log scene updates when game state changes
    if (this.lastGameState !== gameState.gameReady || this.lastPlayerState !== !!this.player) {
        dlogOnChange('tutorial-scene-update', '🎮 TUTORIAL SCENE UPDATE CALLED');
        this.lastGameState = gameState.gameReady;
        this.lastPlayerState = !!this.player;
    }
        if (!gameState.gameReady || !this.player) {
            console.log('❌ BLOCKED: gameReady:', gameState.gameReady, 'player:', !!this.player);
            return;
        }
        
        // Update dialogue manager
        if (this.dialogueManager) {
            this.dialogueManager.update();
        } else {
            console.warn('Dialogue manager not initialized!');
        }
        
        // Update tutorial manager
        if (this.tutorialManager) {
            this.tutorialManager.update();
        }
        
        // Allow player movement - TEMPORARY: Always allow movement for debugging
        if (this.playerController) {
            const canMove = !this.tutorialManager || this.tutorialManager.movementComplete || this.movementTutorialComplete || true; // Force true for debugging
            if (canMove) {
                dlogOnChange('calling-playerController-update', '🎯 CALLING playerController.update() NOW!'); // EXTREME DEBUG (only on change)
                this.playerController.update();
                // Only log finish when we had movement or attacking
                if (this.hadMovement || this.isAttacking) {
                    dlogOnChange('playerUpdateFinished', '✅ playerController.update() FINISHED');
                }
                
                // Reset movement tracking for next update
                this.hadMovement = false;
            } else {
                // Debug why movement is blocked
                if (this.frameCount % 60 === 0) { // Log once per second
                    console.log('Movement blocked by tutorial. Status:');
                    console.log('- tutorialManager exists:', !!this.tutorialManager);
                    console.log('- tutorialManager.movementComplete:', this.tutorialManager?.movementComplete);
                    console.log('- this.movementTutorialComplete:', this.movementTutorialComplete);
                }
            }
        } else {
            if (this.frameCount % 60 === 0) { // Log once per second
                console.log('PlayerController not available. Debug info:', {
                    playerControllerExists: !!this.playerController,
                    playerExists: !!this.player,
                    gameReady: gameState.gameReady
                });
            }
        }
        
        // Add frame counter for debugging
        if (!this.frameCount) this.frameCount = 0;
        this.frameCount++;
        
        if (this.debugManager) {
            this.debugManager.update(this.player);
        }
        
        // Check enemy proximity for interactions
        if (this.mapManager && this.player) {
            this.mapManager.checkEnemyProximity(this.player);
        }
    }
}

// Game Configuration
const gameConfig = {
    type: Phaser.AUTO,
    parent: 'game-wrapper',
    width: 800,
    height: 600,
    backgroundColor: '#2c3e50',
    dom: {
        createContainer: true
    },
    render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true,
        clearBeforeRender: false
    },
    canvasStyle: 'display: block; width: 100%; height: 100%;',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: TutorialScene,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-wrapper',
        width: '100%',
        height: '100%',
        min: {
            width: 800,
            height: 600
        },
        max: {
            width: 1600,
            height: 1200
        },
        zoom: 1
    }
};

// Game instance and state
let game = null;
let gameState = new GameState();
// Expose the canonical gameState on window so global handlers and other scripts can read/write the same object
if (typeof window !== 'undefined') window.gameState = window.gameState || gameState;
let resizeObserver = null;
let isInitializing = false;

// Function to handle window resize
function handleResize() {
    if (!game || !game.scale) return;
    
    const gameWrapper = document.getElementById('game-wrapper');
    if (!gameWrapper) return;
    
    const width = gameWrapper.clientWidth;
    const height = gameWrapper.clientHeight;
    
    if (width === 0 || height === 0) {
        console.warn('Invalid game container dimensions');
        return;
    }
    
    console.log('Resizing game to:', { width, height });
    
    try {
        game.config.width = width;
        game.config.height = height;
        
        game.scale.resize(width, height);
        
        if (game.scene && game.scene.scenes) {
            game.scene.scenes.forEach(scene => {
                if (scene.cameras?.main) {
                    scene.cameras.main.setViewport(0, 0, width, height);
                }
            });
        }
    } catch (error) {
        console.error('Error during resize:', error);
    }
}

// Setup resize observer for the game container
function setupResizeObserver() {
    const gameWrapper = document.getElementById('game-wrapper');
    if (!gameWrapper) return;
    
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    
    resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (entry.contentBoxSize) {
                const contentBoxSize = Array.isArray(entry.contentBoxSize) 
                    ? entry.contentBoxSize[0] 
                    : entry.contentBoxSize;
                
                if (contentBoxSize) {
                    handleResize();
                }
            }
        }
    });
    
    try {
        resizeObserver.observe(gameWrapper, { box: 'content-box' });
    } catch (error) {
        console.warn('ResizeObserver not supported, falling back to window resize');
        window.addEventListener('resize', handleResize);
    }
}

// Clean up all resources
function cleanupGame() {
    console.log('Cleaning up game resources...');
    
    window.removeEventListener('resize', handleResize);
    
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    
    if (game) {
        try {
            game.destroy(true);
        } catch (e) {
            console.warn('Error during game cleanup:', e);
        }
        game = null;
    }
    
    gameState = new GameState();
    if (typeof window !== 'undefined') window.gameState = window.gameState || gameState;
}

// Initialize the game
function initializeGame() {
    if (isInitializing || game) {
        console.log('Game initialization already in progress or game already exists');
        return;
    }
    
    isInitializing = true;
    
    try {
        // Clean up any existing game instance
        cleanupGame();
        
        // Reset game state
    gameState = new GameState();
    // Expose to window so global handlers toggle the same object
    if (typeof window !== 'undefined') window.gameState = gameState;
    // Force debug mode off by default to avoid noisy per-frame logs unless explicitly enabled
    gameState.debugMode = false;
        
        // Create new game instance
        game = new Phaser.Game(gameConfig);
        window.gameInstance = game; // Store game instance globally for debug access
        
        setupResizeObserver();
        console.log('Game initialized successfully');
    } catch (error) {
        console.error('Failed to initialize game:', error);
        
        try {
            cleanupGame();
        } catch (e) {
            console.error('Error during recovery:', e);
        }
    } finally {
        isInitializing = false;
    }
}

// Wait for Phaser to load before initializing
function waitForPhaser() {
    if (typeof Phaser !== 'undefined') {
        console.log('Phaser loaded, version:', Phaser.VERSION);
        initializeGame();
    } else {
        console.log('Waiting for Phaser to load...');
        setTimeout(waitForPhaser, 100);
    }
}

// Initialize when the page is fully loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(waitForPhaser, 0);
} else {
    window.addEventListener('DOMContentLoaded', waitForPhaser, { once: true });
}

// Clean up on page unload
window.addEventListener('beforeunload', cleanupGame);
window.addEventListener('unload', cleanupGame);

// Export for debugging
window.__gameDebug = {
    restart: () => {
        cleanupGame();
        initializeGame();
    },
    getState: () => gameState,
    getGame: () => game
};

// Global debug functions
window.gameDebug = {
    restart: () => {
        if (game) {
            game.destroy(true);
            game = new Phaser.Game(gameConfig);
        }
    },
    toggleDebug: () => {
        if (typeof window !== 'undefined' && window.setDebugMode) {
            window.setDebugMode(undefined, 'window.gameDebug.toggleDebug');
        } else if (gameState) {
            gameState.debugMode = !gameState.debugMode;
            console.log('Debug mode:', gameState.debugMode ? 'ON' : 'OFF');
            if (typeof window !== 'undefined' && window.enableVerboseLogs) window.enableVerboseLogs(!!gameState.debugMode);
        }
    },
    getState: () => gameState,
    getGame: () => game
};

// Unified debug mode setter with diagnostics and debounce timestamping
if (typeof window !== 'undefined') {
    window.setDebugMode = function(val, source) {
        try {
            // Ensure canonical gameState and synchronize module + window references
            if (typeof gameState === 'undefined' || !gameState) {
                gameState = (window.gameState && typeof window.gameState === 'object') ? window.gameState : new GameState();
            }
            window.gameState = window.gameState || gameState;
            // Always sync module-level and window-level gameState
            const prev = !!gameState.debugMode;
            const next = (typeof val === 'undefined') ? !prev : !!val;
            gameState.debugMode = next;
            window.gameState = gameState;
            // Timestamp for debounce
            window.__lastDebugToggleTs = performance.now();
            // Show UI and verbose logging state
            try { if (window.showDebugToast) window.showDebugToast(next); } catch (e) {}
            try { if (window.enableVerboseLogs) window.enableVerboseLogs(!!next); } catch (e) {}
            // Diagnostic log to trace which code changed debug mode
            try {
                console.warn(`[setDebugMode] (${source || 'unknown'}) ->`, next);
                // Include a short stack trace for debugging
                console.warn(new Error('debug-mode-change').stack.split('\n').slice(1,6).join('\n'));
            } catch (e) {}
            return next;
        } catch (e) {
            console.error('setDebugMode failed:', e);
            return false;
        }
    };
}

// Small on-screen toast for debug toggles (visible even if console output is filtered)
;(function(){
    function createToastContainer() {
        let c = document.getElementById('debug-toast-container');
        if (c) return c;
        c = document.createElement('div');
        c.id = 'debug-toast-container';
        c.style.position = 'fixed';
        c.style.right = '16px';
        c.style.bottom = '16px';
        c.style.zIndex = '20000';
        c.style.pointerEvents = 'none';
        document.body.appendChild(c);
        return c;
    }

    function showDebugToast(on) {
        try {
            const container = createToastContainer();
            const el = document.createElement('div');
            el.textContent = on ? 'Debug: ON' : 'Debug: OFF';
            el.style.background = on ? 'rgba(0,150,0,0.9)' : 'rgba(150,0,0,0.9)';
            el.style.color = '#fff';
            el.style.padding = '8px 12px';
            el.style.marginTop = '8px';
            el.style.borderRadius = '6px';
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
            el.style.fontFamily = 'Arial, sans-serif';
            el.style.fontSize = '13px';
            el.style.opacity = '0';
            el.style.transition = 'opacity 240ms ease, transform 240ms ease';
            el.style.transform = 'translateY(8px)';
            el.style.pointerEvents = 'auto';
            container.appendChild(el);
            // force reflow then show
            void el.offsetWidth;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            setTimeout(() => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(8px)';
                setTimeout(() => { try { container.removeChild(el); } catch(e){} }, 300);
            }, 1400);
        } catch (e) {
            // ignore
        }
    }

    window.showDebugToast = showDebugToast;
})();