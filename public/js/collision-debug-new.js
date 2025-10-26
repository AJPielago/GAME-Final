// Guarded collision debug logger: prints only when gameState.debugMode or persisted DEBUG_LOGS is enabled
function cdbg(...args) {
    try {
        // If explicit verbose flag is set, always print
        if (typeof window !== 'undefined' && window.__VERBOSE_LOGGING_ENABLED) {
            console.log(...args);
            return;
        }

        // Throttled guarded logger - reuse dlog-style rate limiter if available
        const gs = (typeof window !== 'undefined' && window.gameState && window.gameState.debugMode);
        const persisted = (typeof localStorage !== 'undefined' && localStorage.getItem && localStorage.getItem('DEBUG_LOGS') === '1');

        // Initialize throttle/dedupe state if not present
        if (typeof window !== 'undefined') {
            if (typeof window.__dlogLastTs === 'undefined') window.__dlogLastTs = 0;
            if (typeof window.__dlogSuppressedCount === 'undefined') window.__dlogSuppressedCount = 0;
            // Increase default rate limit to avoid per-frame chatter
            if (typeof window.__dlogRateLimitMs === 'undefined') window.__dlogRateLimitMs = 1000;
            if (typeof window.__dlogLastMsg === 'undefined') window.__dlogLastMsg = null;
            if (typeof window.__dlogLastMsgTs === 'undefined') window.__dlogLastMsgTs = 0;
        }

        const now = Date.now();
        // Build msg key to detect repeated identical messages
        let msgKey = '';
        try { msgKey = args.length === 1 ? (typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0])) : JSON.stringify(args); } catch (e) { try { msgKey = args.map(a => String(a)).join(' '); } catch (e2) { msgKey = String(args); } }

        if (gs || persisted) {

            // Dedupe identical messages within a short window (3s)
            const dedupeWindowMs = 3000;
            if (msgKey && window.__dlogLastMsg === msgKey && (now - window.__dlogLastMsgTs) < dedupeWindowMs) {
                window.__dlogSuppressedCount = (window.__dlogSuppressedCount || 0) + 1;
                return;
            }

            if (now - window.__dlogLastTs < window.__dlogRateLimitMs) {
                window.__dlogSuppressedCount = (window.__dlogSuppressedCount || 0) + 1;
                window.__dlogLastMsg = msgKey;
                window.__dlogLastMsgTs = now;
                return;
            }

            if (window.__dlogSuppressedCount > 0) {
                console.log(`(suppressed ${window.__dlogSuppressedCount} messages)`);
                window.__dlogSuppressedCount = 0;
            }
            console.log(...args);
            window.__dlogLastTs = now;
            window.__dlogLastMsg = msgKey;
            window.__dlogLastMsgTs = now;
        }
    } catch (e) { /* ignore */ }
}

cdbg('NEW collision-debug-new.js is loading... Version 2.0');

// Mirror tutorial.js helper for verbose logging control
if (typeof window !== 'undefined') {
    window.__VERBOSE_LOGGING_ENABLED = window.__VERBOSE_LOGGING_ENABLED || false;
    window.enableVerboseLogs = window.enableVerboseLogs || function(enabled) {
        window.__VERBOSE_LOGGING_ENABLED = !!enabled;
        console.log('Verbose logging enabled:', !!enabled);
    };
}

// Simplified CollisionDebugSystem class compatible with Arcade Physics
class CollisionDebugSystem {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.enabled = false;
        this.graphics = null;
        this.tilemapLayers = [];
        this.disabledTiles = new Map();
        this.storageKey = 'collisionDebugDisabledTiles';
        this.debugObjects = [];
        this.hoveredTile = null;
        this.isMouseOverTile = false;
    this._hoverLayerEntry = null;
        this._coordText = null;
        this._instructions = null;
        this._layerNameFilter = null; // optional Set of layer names to render
        
        // Visual styling
        this.colors = {
            enabled: 0x00ff00,
            disabled: 0xff0000,
            hover: 0xffff00,
            player: 0x0000ff,
            highlight: 0xff00ff
        };
        
        try { this.loadDisabledTiles(); } catch (e) { /* ignore */ }
        cdbg('CollisionDebugSystem initialized (Arcade Physics compatible)');
    }

    /**
     * Restrict overlay rendering to specific tile layer names.
     * @param {string[]|null} names - Array of layer names to allow, or null to allow all
     */
    setLayerNameFilter(names) {
        if (!names || names.length === 0) {
            this._layerNameFilter = null;
        } else {
            this._layerNameFilter = new Set(names);
        }
        this.render();
    }

    toggle() {
        this.enabled = !this.enabled;
        
        if (this.enabled) {
            this.enable();
        } else {
            this.disable();
        }
        
        return this.enabled;
    }
    
    enable() {
        this.enabled = true;
        
        if (!this.graphics) {
            this.graphics = this.scene.add.graphics();
            this.graphics.setDepth(99999); // Ensure it's above everything else
        }
        
        // Clear any layer name filter so all registered layers are visible by default
        this._layerNameFilter = null;
        // Auto-discover and register any tilemap layers available on the scene
        try { this.autoDiscoverTilemapLayers(); } catch (e) { console.warn('Auto-discover failed:', e); }
        this.setupMouseInteractions();
        this.createInstructions();
        this.createLayerListText();
        
        cdbg('Collision debug enabled (Arcade Physics mode)');
        
        // Ensure any saved states are reflected visually immediately
        try { this.applySavedDisabledStates(true); } catch (e) {}
        this.render();
    }

    dumpDiscoveredLayers() {
        try {
            console.group('CollisionDebug: Discovered Layers');
            if (!this.tilemapLayers || this.tilemapLayers.length === 0) {
                cdbg('No tilemap layers registered');
                console.groupEnd();
                return;
            }

            const camera = this.scene?.cameras?.main;
            const view = camera ? camera.worldView : { x: 0, y: 0, width: this.scene?.scale?.width || 0, height: this.scene?.scale?.height || 0 };

            this.tilemapLayers.forEach((entry, idx) => {
                try {
                    const layer = entry.layer;
                    const id = entry.id || `layer_${idx}`;
                    console.group(`Layer ${idx}: ${id}`);
                    cdbg('Layer object:', layer);
                    cdbg('Visible:', !!(layer.visible !== false));
                    cdbg('Has getTileAtWorldXY:', typeof (layer && layer.getTileAtWorldXY) === 'function');
                    cdbg('Has getTilesWithinWorldXY:', typeof (layer && layer.getTilesWithinWorldXY) === 'function');
                    cdbg('Has forEachTile:', typeof (layer && layer.forEachTile) === 'function');
                    cdbg('Tilemap ref:', layer?.tilemap || layer?.map || null);
                    cdbg('Tile size:', layer?.tilemap?.tileWidth || layer?.tileWidth || '(unknown)', 'x', layer?.tilemap?.tileHeight || layer?.tileHeight || '(unknown)');

                    // If camera view is available and layer supports querying tiles, attempt to log count in view
                    if (typeof (layer && layer.getTilesWithinWorldXY) === 'function' && view) {
                        try {
                            const tiles = layer.getTilesWithinWorldXY(view.x, view.y, view.width, view.height) || [];
                            cdbg(`Tiles in camera view: ${tiles.length}`);
                        } catch (e) {
                            cdbg('Tiles in camera view: (query failed)', e && e.message ? e.message : e);
                        }
                    } else if (typeof (layer && layer.forEachTile) === 'function') {
                        // non-blocking count via forEachTile (may be heavy for large maps) - we'll skip counting automatically
                        cdbg('Tiles in camera view: forEachTile available (count skipped)');
                    } else {
                        cdbg('Tiles in camera view: (no query API)');
                    }

                    // Show how many disabled tiles are stored for this layer
                    const disabled = this.disabledTiles.get(id);
                    cdbg('Disabled tiles saved:', disabled ? disabled.size : 0);

                    console.groupEnd();
                } catch (e) {
                    console.warn('Error dumping layer info for entry', entry, e);
                }
            });

            console.groupEnd();
        } catch (e) {
            console.warn('dumpDiscoveredLayers failed:', e);
        }
    }
    
    disable() {
        this.enabled = false;
        
        if (this.graphics) {
            this.graphics.clear();
        }
        
        if (this.scene) {
            this.removeMouseInteractions();
        }
        
        this.hideInstructions();
    this.hideLayerListText();
        
        if (this._coordText) {
            this._coordText.destroy();
            this._coordText = null;
        }
        
        // Reset cursor
        if (this.scene && this.scene.game && this.scene.game.canvas) {
            this.scene.game.canvas.style.cursor = 'default';
        }
        
    cdbg('Collision debug disabled');
    }

    createLayerListText() {
        if (this._layerText || !this.scene || !this.scene.add) return;
        this._layerText = this.scene.add.text(10, 80, '', {
            fontSize: '12px',
            fill: '#00ff00',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: { x: 8, y: 6 }
        });
        this._layerText.setScrollFactor(0);
        this._layerText.setDepth(10002);
        this.updateLayerListText();
    }

    updateLayerListText() {
        if (!this._layerText) return;
        const ids = (this.tilemapLayers || []).map(e => e.id || '<unnamed>');
        const filter = this._layerNameFilter ? Array.from(this._layerNameFilter).join(', ') : 'None';
        this._layerText.setText([`Registered layers: ${ids.length}`, ids.join(', '), `Active filter: ${filter}`].join('\n'));
    }

    hideLayerListText() {
        if (this._layerText) {
            this._layerText.destroy();
            this._layerText = null;
        }
    }
    
    setupMouseInteractions() {
        if (!this.scene || !this.scene.input) {
            console.warn('Scene or input not available for mouse interactions');
            return;
        }
        
        this.scene.input.on('pointermove', this.onPointerMove, this);
        this.scene.input.on('pointerdown', this.onPointerDown, this);
    }

    // Helper: get world coordinates for a pointer, fall back to camera conversion
    _getPointerWorld(pointer) {
        const camera = this.scene?.cameras?.main;
        if (!pointer) return { x: 0, y: 0 };
        // Prefer Phaser pointer.worldX/worldY when available
        if (typeof pointer.worldX === 'number' && typeof pointer.worldY === 'number') {
            return { x: pointer.worldX, y: pointer.worldY };
        }
        // Fallback: use pointer.x/y plus camera offset
        if (camera) {
            return { x: pointer.x + camera.worldView.x, y: pointer.y + camera.worldView.y };
        }
        // Last fallback: use pointer.x/y
        return { x: pointer.x || 0, y: pointer.y || 0 };
    }
    
    removeMouseInteractions() {
        if (this.scene && this.scene.input) {
            this.scene.input.off('pointermove', this.onPointerMove, this);
            this.scene.input.off('pointerdown', this.onPointerDown, this);
        }
    }
    
    onPointerMove(pointer) {
        if (!this.enabled) {
            return;
        }
        
        const { x: worldX, y: worldY } = this._getPointerWorld(pointer);
        
        // Update coordinate display
        this.updateCoordinateDisplay(worldX, worldY);
        
        // Find top-most tile under pointer for cursor change only
        let found = null;
        for (let i = this.tilemapLayers.length - 1; i >= 0; i--) {
            const entry = this.tilemapLayers[i];
            const layer = entry.layer;
            if (!layer || !layer.getTileAtWorldXY) continue;
            const tile = layer.getTileAtWorldXY(worldX, worldY);
            if (tile) { found = { entry, layer, tile }; break; }
        }

        // Store hover info
        if (found) {
            this.hoveredTile = { id: found.entry.id, x: found.tile.x, y: found.tile.y, tile: found.tile };
            this.isMouseOverTile = true;
        } else {
            this.hoveredTile = null;
            this.isMouseOverTile = false;
        }

        // Update cursor
        if (this.scene && this.scene.game && this.scene.game.canvas) {
            this.scene.game.canvas.style.cursor = this.isMouseOverTile ? 'pointer' : 'default';
        }

        // Don't render on every mouse move - too expensive
    }
    
    onPointerDown(pointer) {
        // Disabled - using TutorialScene's direct approach instead
        return;
    }
    
    addTilemapLayer(layer, customName = null) {
        const layerId = customName || 
                       layer.layer?.name || 
                       layer.name || 
                       `layer_${this.tilemapLayers.length}`;
        
        // Avoid duplicate registration
        if (this.tilemapLayers.some(e => e.id === layerId)) {
        cdbg(`Layer '${layerId}' is already registered - skipping`);
            return false;
        }

    cdbg(`Adding tilemap layer: ${layerId} (Arcade Physics compatible)`);

        this.tilemapLayers.push({
            layer: layer,
            id: layerId,
            type: 'tilemap'
        });
        
    cdbg(`Layer ${layerId} added. Total layers: ${this.tilemapLayers.length}`);
        // Apply saved states as layers are registered
        try { this.applySavedDisabledStates(true); } catch (e) {}
        // Update layer HUD if present
        try { this.updateLayerListText(); } catch (e) {}
        return true;
    }
    
    addObject(obj, color = this.colors.player) {
        this.debugObjects.push({
            object: obj,
            color: color,
            type: 'object'
        });
        
        if (this.enabled) {
            this.render();
        }
    }
    
    update() {
        // Don't render anything in update - only render on demand
    }
    
    clear() {
        this.debugObjects = [];
    cdbg('Debug objects cleared');
    }
    
    render() {
        if (!this.graphics) {
            cdbg('[CollisionDebug] No graphics object');
            return;
        }
        
        this.graphics.clear();
        
        if (this.enabled) {
            this.renderTilemapLayers();
        }
        
        this.renderDebugObjects();
        this.renderInstructions();
        try { this.updateLayerListText(); } catch (e) {}
    }
    
    renderDebugObjects() {
        if (!this.graphics) return;
        
        // Only render debug objects (like player box) without clearing the entire graphics
        for (const debugObj of this.debugObjects) {
            const obj = debugObj.object;
            const color = debugObj.color;
            
            if (obj && obj.x !== undefined && obj.y !== undefined) {
                let width = obj.width || obj.displayWidth || 32;
                let height = obj.height || obj.displayHeight || 32;
                
                // Use body dimensions if available for more accurate collision box
                if (obj.body) {
                    width = obj.body.width || width;
                    height = obj.body.height || height;
                }
                
                this.graphics.lineStyle(2, color, 0.8);
                this.graphics.strokeRect(obj.x - width/2, obj.y - height/2, width, height);
                
                this.graphics.fillStyle(color, 0.2);
                this.graphics.fillRect(obj.x - width/2, obj.y - height/2, width, height);
            }
        }
    }
    
    renderInstructions() {
        if (!this._instructions && this.scene.add) {
            this.createInstructions();
        }
    }

    renderTilemapLayers() {
        if (!this.tilemapLayers || this.tilemapLayers.length === 0) return;
        const camera = this.scene.cameras?.main;
        const view = camera ? camera.worldView : { x: 0, y: 0, width: this.scene.scale.width, height: this.scene.scale.height };
        // If a layer name filter is active, but none of the registered layers match,
        // warn the developer to avoid confusion.
        if (this._layerNameFilter) {
            const registered = this.tilemapLayers.map(e => e.id || '<unknown>');
            const anyMatch = registered.some(id => this._layerNameFilter.has(id));
            if (!anyMatch) {
                console.warn('[CollisionDebug] Layer name filter is active but no registered layers match. Registered layers:', registered);
            }
        }
        for (const entry of this.tilemapLayers) {
            const layer = entry.layer;
            if (!layer) continue;
            // Apply optional filter by layer name/id
            if (this._layerNameFilter && !this._layerNameFilter.has(entry.id)) continue;
            
            // Prefer using world-space query to support infinite/chunked maps
            let tiles = [];
            if (typeof layer.getTilesWithinWorldXY === 'function') {
                // Include tiles regardless of current collides flag to ensure overlay visibility
                tiles = layer.getTilesWithinWorldXY(view.x, view.y, view.width, view.height);
            } else {
                // Fallback: convert world rect to tile rect
                const startX = Math.max(0, layer.worldToTileX ? layer.worldToTileX(view.x) : 0);
                const startY = Math.max(0, layer.worldToTileY ? layer.worldToTileY(view.y) : 0);
                const endX = (layer.worldToTileX ? layer.worldToTileX(view.x + view.width) : startX + 100) - startX + 1;
                const endY = (layer.worldToTileY ? layer.worldToTileY(view.y + view.height) : startY + 100) - startY + 1;
                if (typeof layer.getTilesWithin === 'function') {
                    tiles = layer.getTilesWithin(startX, startY, endX, endY);
                }
            }
            
            let drawn = 0;
            const drawTile = (tile) => {
                if (!tile) return;
                const disabled = this.isTileCollisionDisabled(entry.id, tile.x, tile.y);
                const hasIndex = typeof tile.index === 'number' && tile.index > 0;

                // We render any tile that exists (hasIndex) so it's selectable, and
                // visually indicate whether it's collidable, disabled, or just a tile.
                if (!hasIndex) return;

                const worldX = tile.getLeft ? tile.getLeft() : tile.pixelX;
                const worldY = tile.getTop ? tile.getTop() : tile.pixelY;
                const width = tile.width || layer.tilemap?.tileWidth || 32;
                const height = tile.height || layer.tilemap?.tileHeight || 32;

                let color = this.colors.enabled;
                let alpha = 0.15;
                
                // Check the actual tile collision state (not just disabled tiles)
                if (!tile.collides) {
                    // Tile collision is disabled - show RED
                    color = this.colors.disabled; // Red
                    alpha = 0.25;
                } else {
                    // Tile collision is enabled - show GREEN
                    color = this.colors.enabled; // Green
                    alpha = 0.15;
                }

                // If this tile is hovered, use hover color/outline
                if (this.hoveredTile && this.hoveredTile.id === entry.id && this.hoveredTile.x === tile.x && this.hoveredTile.y === tile.y) {
                    this.graphics.lineStyle(2, this.colors.hover, 1.0);
                    this.graphics.strokeRect(worldX, worldY, width, height);
                    this.graphics.fillStyle(this.colors.hover, 0.12);
                    this.graphics.fillRect(worldX, worldY, width, height);
                } else {
                    this.graphics.lineStyle(1, color, 0.9);
                    this.graphics.strokeRect(worldX, worldY, width, height);
                    this.graphics.fillStyle(color, alpha);
                    this.graphics.fillRect(worldX, worldY, width, height);
                    // Don't log every tile - increment a local counter and log the summary after loop
                    // (see drawn++ below)
                }

                drawn++;
            };

            if (tiles && tiles.length > 0) {
                for (const tile of tiles) drawTile(tile);
            } else if (typeof layer.forEachTile === 'function') {
                layer.forEachTile((tile) => { drawTile(tile); });
            } else {
                cdbg(`[DebugOverlay] No query API available for layer '${entry.id}'.`);
            }

            // Only log the drawn count if it changed since last render to avoid
            // spamming the console with identical summary lines each frame.
            try {
                if (entry._lastDrawn !== drawn) {
                    entry._lastDrawn = drawn;
                    cdbg(`[DebugOverlay] Layer '${entry.id}' drawn tiles: ${drawn}`);
                }
            } catch (e) {
                // Fallback: if entry is not writable for some reason, still attempt a throttled log
                cdbg(`[DebugOverlay] Layer '${entry.id}' drawn tiles: ${drawn}`);
            }
        }
    }
    
    createInstructions() {
        if (this._instructions || !this.scene.add) {
            return;
        }
        
        const instructions = [
            'Debug Mode (Arcade Physics):',
            '• Green box = Player hitbox',
            '• TAB = Toggle debug mode',
            '• Click empty space = Toggle collision overlay',
            '• Click tiles = Toggle tile collision'
        ];
        
        this._instructions = this.scene.add.text(10, 10, instructions.join('\n'), {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 10, y: 10 }
        });
        
        this._instructions.setScrollFactor(0);
        this._instructions.setDepth(10000);
    }
    
    hideInstructions() {
        if (this._instructions) {
            this._instructions.destroy();
            this._instructions = null;
        }
    }
    
    updateCoordinateDisplay(worldX, worldY) {
        if (!this.scene.cameras || !this.scene.cameras.main) {
            return;
        }
        
        const camera = this.scene.cameras.main;
        const screenX = worldX - camera.worldView.x;
        const screenY = worldY - camera.worldView.y;
        
        if (!this._coordText && this.scene.add) {
            this._coordText = this.scene.add.text(0, 0, '', {
                fontSize: '12px',
                fill: '#ffffff',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: { x: 5, y: 2 }
            });
            this._coordText.setScrollFactor(0);
            this._coordText.setDepth(10001);
        }
        
        if (this._coordText) {
            this._coordText.setText(`World: (${Math.round(worldX)}, ${Math.round(worldY)})`);
            this._coordText.setPosition(screenX + 15, screenY - 10);
        }
    }
    
    getStats() {
        return {
            enabled: this.enabled,
            totalLayers: this.tilemapLayers.length,
            debugObjects: this.debugObjects.length
        };
    }
    
    debugState() {
        cdbg('=== Collision Debug State (Arcade Physics) ===');
        cdbg('Enabled:', this.enabled);
        cdbg('Layers:', this.tilemapLayers.length);
        cdbg('Debug objects:', this.debugObjects.length);
        cdbg('============================');
    }
    
    // Persistence API
    loadDisabledTiles() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.disabledTiles = new Map();
            Object.keys(data).forEach(layerId => {
                this.disabledTiles.set(layerId, new Set(data[layerId]));
            });
            cdbg('Loaded disabled tiles');
        } catch (e) {
            console.warn('Failed to load disabled tiles:', e);
        }
    }
    saveDisabledTiles() {
        try {
            const obj = {};
            for (const [layerId, set] of this.disabledTiles.entries()) {
                obj[layerId] = Array.from(set);
            }
            localStorage.setItem(this.storageKey, JSON.stringify(obj));
            cdbg('Saved disabled tiles');
        } catch (e) {
            console.warn('Failed to save disabled tiles:', e);
        }
    }
    applySavedDisabledStates(silent = false) {
        if (!this.disabledTiles || this.disabledTiles.size === 0) return;
        for (const { layer, id } of this.tilemapLayers) {
            const set = this.disabledTiles.get(id);
            if (!set || !layer || !layer.getTileAt) continue;
            for (const key of set.values()) {
                const [xStr, yStr] = key.split(',');
                const x = parseInt(xStr, 10);
                const y = parseInt(yStr, 10);
                const tile = layer.getTileAt(x, y);
                if (tile) {
                    tile.resetCollision();
                    tile.setCollision(false, false, false, false);
                }
            }
        }
        if (this.scene?.physics?.world?.colliders) {
            try { this.scene.physics.world.colliders.refresh(); } catch (_) {}
        }
    if (!silent) cdbg('Applied saved disabled collision states');
        this.render();
    }
    isTileCollisionDisabled(layerId, x, y) {
        const set = this.disabledTiles.get(layerId);
        return !!(set && set.has(`${x},${y}`));
    }
    toggleTileCollision(layerId, x, y, disable) {
        if (!this.disabledTiles.has(layerId)) this.disabledTiles.set(layerId, new Set());
        const set = this.disabledTiles.get(layerId);
        const key = `${x},${y}`;
        if (disable) set.add(key); else set.delete(key);
        this.saveDisabledTiles();
    }
    getTotalDisabledTiles() {
        let total = 0;
        for (const set of this.disabledTiles.values()) total += set.size;
        return total;
    }
    clearDisabledTiles() {
        this.disabledTiles.clear();
        this.saveDisabledTiles();
        this.applySavedDisabledStates();
    }
}

// Enhanced Debug Manager with Collision Debug System - Reusable across maps
class DebugManager {
    constructor(scene) {
        this.scene = scene;
        this.debugText = null;
        this.debugCollision = false;
        this.collisionDebugSystem = null;
        this.inputStateText = null;
        this.lastKeyPress = '';
        
        // Initialize the collision debug system with error handling
        try {
            console.log('Attempting to initialize CollisionDebugSystem...');
            console.log('CollisionDebugSystem available in window:', typeof window.CollisionDebugSystem);

            if (typeof window.CollisionDebugSystem !== 'function') {
                throw new Error('CollisionDebugSystem is not defined. Check if collision-debug.js is loaded correctly.');
            }

            // Check if this is a real Phaser scene or a pseudo-scene (canvas-based game)
            const isPhaserScene = scene && scene.scene && scene.scene.key; // Real Phaser scenes have this property
            
            if (isPhaserScene) {
                this.collisionDebugSystem = new window.CollisionDebugSystem(scene);
                console.log('DebugManager initialized with collision debug support (Phaser scene)');
            } else {
                console.log('Canvas-based game detected, collision debug system will be limited');
                this.collisionDebugSystem = null; // No collision debug system for canvas games
            }
        } catch (error) {
            console.error('Failed to initialize CollisionDebugSystem:', error);
            console.error('Available globals:', Object.keys(window).filter(key => 
                key === 'CollisionDebugSystem' || 
                key.includes('Phaser') || 
                key === 'gameState' ||
                key === 'gameConfig'
            ));

            // Continue without collision debug
            this.collisionDebugSystem = null;
            console.log('DebugManager initialized without collision debug system');
        }
    }
    
    /**
     * Setup collision debug for specific layers - reusable across different maps
     * 
     * USAGE EXAMPLES:
     * 
     * // Tutorial Map (exclude decorative layers)
     * debugManager.setupCollisionDebug(layers, {
     *   excludeLayers: ['Bridges', 'Ground'],
     *   player: player
     * });
     * 
     * // Dungeon Map (include all collision layers)
     * debugManager.setupCollisionDebug(layers, {
     *   excludeLayers: ['Decorative'],
     *   player: player,
     *   autoEnable: true
     * });
     * 
     * // Platformer Map (only show platform layers)
     * debugManager.setupCollisionDebug(
     *   layers.filter(l => l.name.includes('Platform')),
     *   { player: player }
     * );
     * 
     * @param {Array} layers - Array of layer objects with {name, layer, collision} properties
     * @param {Object} options - Configuration options
     * @param {string[]} options.excludeLayers - Layer names to exclude from debug
     * @param {Phaser.GameObjects.Sprite} options.player - Player object to visualize
     * @param {boolean} options.autoEnable - Whether to auto-enable debug overlay
     */
    setupCollisionDebug(layers, options = {}) {
        const {
            excludeLayers = ['Bridges', 'Ground'], // Layers to exclude from debug
            player = null, // Player object to add to debug
            autoEnable = false // Whether to auto-enable debug overlay
        } = options;

        console.log('Setting up collision debug for layers:', layers.map(l => l.name).join(', '));
        console.log('Excluding layers:', excludeLayers.join(', '));

        // For canvas-based games without collision debug system, just log and return
        if (!this.collisionDebugSystem) {
            console.log('Canvas-based game detected - collision debug setup skipped (no visual overlay available)');
            console.log('TAB key will still toggle debug mode for logging');
            return;
        }

        // Existing logic for Phaser scenes
        // Register collision layers with the debug system
        if (this.collisionDebugSystem && typeof this.collisionDebugSystem.addTilemapLayer === 'function') {
            const namesToInclude = [];
            
            layers.forEach(layerData => {
                if (!layerData || !layerData.layer || !layerData.name) return;
                
                // Check if layer should be excluded
                const lname = String(layerData.name).trim();
                if (excludeLayers.includes(lname)) {
                    console.log(`Excluding layer from debug: ${layerData.name}`);
                    return;
                }
                
                // Only include layers that are marked as collision layers
                if (layerData.collision) {
                    console.log(`Adding layer to debug: ${layerData.name}`);
                    this.collisionDebugSystem.addTilemapLayer(layerData.layer, layerData.name);
                    namesToInclude.push(layerData.name);
                }
            });

            // Apply saved disabled states so overlay matches actual collisions
            this.collisionDebugSystem.applySavedDisabledStates(true);
            
            // Restrict overlay to the selected layers so developer sees only relevant overlays
            if (namesToInclude.length) {
                this.collisionDebugSystem.setLayerNameFilter(namesToInclude);
            }

            // Add player to debug if provided
            if (player) {
                console.log('Adding player to debug');
                this.collisionDebugSystem.addObject(player, 0x0000ff);
            }

            console.log('Collision debug setup complete. Layers included:', namesToInclude.join(', '));
            
            // Auto-enable if requested
            if (autoEnable && namesToInclude.length > 0) {
                this.debugCollision = true;
                this.collisionDebugSystem.enable();
                console.log('Collision debug: Auto-enabled for configured layers');
            }
        }
    }
    
    update(player, gameState = null) {
        // Use provided gameState or fall back to global/window gameState
        const currentGameState = gameState || (typeof window !== 'undefined' && window.gameState) || null;
        
        if (!currentGameState || !currentGameState.debugMode) {
            // Hide debug HUD text but DO NOT auto-disable the collision overlay; keep collision overlay
            // controlled explicitly via toggleCollisionDebug() so it isn't turned off by unrelated code.
            if (this.debugText) {
                this.debugText.destroy();
                this.debugText = null;
            }
            if (this.inputStateText) {
                this.inputStateText.destroy();
                this.inputStateText = null;
            }
            // Intentionally do NOT toggle collisionDebugSystem here.
            return;
        }
        
        // Don't update collision debug system every frame - too expensive
        // It only renders on demand (clicks, enable/disable)
        
        if (this.debugText) {
            this.debugText.destroy();
        }
        
        const debugInfo = [
            `Position: (${Math.round(player.x)}, ${Math.round(player.y)})`,
            `Velocity: (${player.body ? Math.round(player.body.velocity.x) : 0}, ${player.body ? Math.round(player.body.velocity.y) : 0})`,
            `Body: (${player.body ? Math.round(player.body.x) : player.x}, ${player.body ? Math.round(player.body.y) : player.y}, ${player.width}x${player.height})`,
            `Animation: ${currentGameState.currentAnimation || 'idle'}`,
            `Moving: ${currentGameState.isMoving || false}`,
            `Attacking: ${currentGameState.isAttacking || false}`,
            `Collision Debug: ${this.debugCollision ? 'ON' : 'OFF'}`,
            `FPS: ${this.scene?.game?.loop?.actualFps ? Math.round(this.scene.game.loop.actualFps) : 'N/A'}`
        ];
        
        // Only create text if we have a Phaser scene
        if (this.scene && this.scene.add) {
            this.debugText = this.scene.add.text(16, 16, debugInfo.join('\n'), {
                fontSize: '14px',
                fill: '#ffffff',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: { x: 8, y: 8 }
            });
            
            this.debugText.setScrollFactor(0);
            this.debugText.setDepth(1000);
            
            // Update input state display
            this.updateInputStateDisplay(player);
        }
    }
    
    /**
     * Toggle collision debug visualization
     */
    toggleCollisionDebug() {
        console.log('Toggling collision debug...');
        try { console.warn('[toggleCollisionDebug] called from:', new Error().stack.split('\n').slice(1,6).join('\n')); } catch (e) {}
        
        if (!this.collisionDebugSystem) {
            console.log('Collision debug system not available (canvas-based game)');
            // For canvas-based games, just toggle the debug state
            this.debugCollision = !this.debugCollision;
            console.log('Debug mode toggled to:', this.debugCollision ? 'ON' : 'OFF');
            return;
        }
        
        // Existing logic for Phaser scenes
        // Toggle the debug mode (always ensure layers are present and saved states applied)
        this.debugCollision = !this.debugCollision;
        
        if (this.debugCollision) {
            this.collisionDebugSystem.enable();
            console.log('Collision debug enabled');
            
            // Add all collidable layers to the debug system, excluding Bridges and Ground
            if (this.scene.mapManager && this.scene.mapManager.layers) {
                const namesToInclude = [];
                this.scene.mapManager.layers.forEach(layer => {
                    try {
                        if (!layer || !layer.layer || !layer.name) return;
                        // Exclude Bridges and Ground explicitly
                        const lname = String(layer.name).trim();
                        if (lname === 'Bridges' || lname === 'Ground') return;
                        // Only include layers that are marked as collision layers
                        if (layer.collision) {
                            console.log(`Adding layer to debug: ${layer.name}`);
                            this.collisionDebugSystem.addTilemapLayer(layer.layer, layer.name);
                            namesToInclude.push(layer.name);
                        }
                    } catch (e) {
                        console.warn('Error while adding mapManager layer to collision debug:', e);
                    }
                });
                // Apply saved disabled states so overlay matches actual collisions
                this.collisionDebugSystem.applySavedDisabledStates(true);
                // Restrict overlay to the selected layers so developer sees only relevant overlays
                if (namesToInclude.length) this.collisionDebugSystem.setLayerNameFilter(namesToInclude);
            }
            
            // Add player to debug
            if (this.scene.player) {
                console.log('Adding player to debug');
                this.collisionDebugSystem.addObject(this.scene.player, 0x0000ff);
            }
            
            console.log('Collision debug: ON - Showing all collision layers');
            try {
                // Ensure global debugMode reflects collision debug state to avoid immediate disable in update()
                if (typeof gameState !== 'undefined') gameState.debugMode = !!this.debugCollision;
                if (typeof window !== 'undefined' && window.enableVerboseLogs) window.enableVerboseLogs(!!gameState.debugMode);
                // Diagnostic summary
                try { console.warn('CollisionDebugSystem stats:', this.collisionDebugSystem.getStats()); } catch (e) {}
                try { console.warn('Registered layers for debug:', (this.collisionDebugSystem && this.collisionDebugSystem.tilemapLayers) ? this.collisionDebugSystem.tilemapLayers.map(l => l.id) : []); } catch (e) {}
            } catch (e) {}
        } else {
            console.log('Collision debug: OFF - Hiding all collision layers');
            this.collisionDebugSystem.disable();
        }
    }
    
    /**
     * Clear all debug graphics
     */
    clearCollisionGraphics() {
        try { console.warn('[clearCollisionGraphics] called from:', new Error().stack.split('\n').slice(1,6).join('\n')); } catch (e) {}
        if (this.collisionDebugSystem) {
            // The collision debug system handles its own cleanup
            if (this.debugCollision) {
                this.debugCollision = false;
                this.collisionDebugSystem.toggle();
            }
            this.collisionDebugSystem.clear();
        }
    }
    
    /**
     * Update the input state display
     * @private
     */
    updateInputStateDisplay(player) {
        if (!this.scene.playerController) return;
        
        const keys = this.scene.playerController.keys;
        const activeKeys = Object.entries(keys)
            .filter(([_, keyObj]) => keyObj.isDown)
            .map(([keyName]) => keyName);
            
        // Show collision layer info
        const collisionInfo = [
            '=== Collision Debug ===',
            `Status: ${this.debugCollision ? 'ENABLED' : 'DISABLED'}`,
            ...(this.scene.mapManager?.layers || [])
                .filter(layer => layer.collision)
                .map(layer => {
                    return `• ${layer.name} layer`;
                })
        ];
        
        const inputState = [
            '=== Input State ===',
            `Last Key: ${this.lastKeyPress}`,
            'Active Keys:',
            ...(activeKeys.length > 0 ? activeKeys.map(k => `- ${k}`) : ['None']),
            '',
            ...collisionInfo,
            '',
            '=== Controls ===',
            'TAB: Toggle debug mode',
            'WASD/Arrows: Move',
            'SPACE: Attack'
        ];
        
        if (this.inputStateText) {
            this.inputStateText.destroy();
        }
        
        this.inputStateText = this.scene.add.text(
            this.scene.cameras.main.width - 320, 
            16, 
            inputState.join('\n'), 
            {
                fontSize: '12px',
                fill: '#00ff00',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: { x: 10, y: 10 },
                align: 'left',
                fixedWidth: 300,
                lineSpacing: 4
            }
        );
        
        this.inputStateText.setScrollFactor(0);
        this.inputStateText.setDepth(1000);
    }
    
    /**
     * Log key press for debugging
     * @param {string} keyName - Name of the key that was pressed
     */
    logKeyPress(keyName) {
        this.lastKeyPress = `${keyName} (${new Date().toISOString()})`;
        console.log(`Key pressed: ${keyName}`);
    }
}

// Export for browser and Node.js environments
try {
        if (typeof window !== 'undefined') {
        window.CollisionDebugSystem = CollisionDebugSystem;
        window.DebugManager = DebugManager;
        cdbg('NEW CollisionDebugSystem and DebugManager registered to window');
    }
    
    // For Node.js/CommonJS environment
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { CollisionDebugSystem, DebugManager };
    }
    
    // For Node.js global scope
    if (typeof global !== 'undefined') {
        global.CollisionDebugSystem = CollisionDebugSystem;
        global.DebugManager = DebugManager;
    }
    
    cdbg('NEW CollisionDebugSystem and DebugManager registration complete');
    cdbg('CollisionDebugSystem type:', typeof CollisionDebugSystem);
    cdbg('DebugManager type:', typeof DebugManager);
} catch (error) {
    console.error('Error registering NEW CollisionDebugSystem and DebugManager:', error);
    throw error;
}
