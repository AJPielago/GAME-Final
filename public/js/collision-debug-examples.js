// Example: How to use the refactored collision debug system in different maps
// This shows how different maps can configure collision debugging independently

// =============================================================================
// TUTORIAL MAP EXAMPLE (from tutorial.js)
// =============================================================================

class TutorialScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TutorialScene' });
        this.debugManager = null;
        // ... other properties
    }

    create() {
        // Initialize managers
        this.debugManager = new window.DebugManager(this);
        this.mapManager = new MapManager(this);
        // ... other initialization

        // Load and create map
        this.mapManager.createMap();

        // Wait for map creation, then setup collision debug
        this.time.delayedCall(100, () => {
            if (this.mapManager.layers && this.player) {
                // Configure collision debug for tutorial map
                // Exclude decorative layers, include player
                this.debugManager.setupCollisionDebug(
                    this.mapManager.layers,
                    {
                        excludeLayers: ['Bridges', 'Ground'], // Tutorial-specific exclusions
                        player: this.player, // Add player to debug visualization
                        autoEnable: false // Don't auto-enable (let TAB control it)
                    }
                );
            }
        });
    }
}

// =============================================================================
// DUNGEON MAP EXAMPLE
// =============================================================================

class DungeonScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DungeonScene' });
        this.debugManager = null;
    }

    create() {
        this.debugManager = new window.DebugManager(this);
        // ... load dungeon map and layers

        this.time.delayedCall(100, () => {
            if (this.dungeonLayers && this.player) {
                // Configure collision debug for dungeon map
                this.debugManager.setupCollisionDebug(
                    this.dungeonLayers,
                    {
                        excludeLayers: ['Decorative', 'Ambient'], // Dungeon-specific exclusions
                        player: this.player,
                        autoEnable: true // Auto-enable for dungeon debugging
                    }
                );
            }
        });
    }
}

// =============================================================================
// PLATFORMER MAP EXAMPLE
// =============================================================================

class PlatformerScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PlatformerScene' });
        this.debugManager = null;
    }

    create() {
        this.debugManager = new window.DebugManager(this);
        // ... load platformer map

        this.time.delayedCall(100, () => {
            if (this.platformerLayers) {
                // Only debug platform layers for platformer
                const platformLayers = this.platformerLayers.filter(layer =>
                    layer.name.includes('Platform') || layer.name.includes('Ground')
                );

                this.debugManager.setupCollisionDebug(
                    platformLayers,
                    {
                        excludeLayers: [], // Include all selected layers
                        player: this.player,
                        autoEnable: false
                    }
                );
            }
        });
    }
}

// =============================================================================
// GENERIC MAP CONFIGURATION HELPER
// =============================================================================

/**
 * Helper function to configure collision debug for any map
 * @param {DebugManager} debugManager - The debug manager instance
 * @param {Array} layers - Array of layer objects
 * @param {Object} player - Player sprite (optional)
 * @param {Object} config - Map-specific configuration
 */
function configureMapCollisionDebug(debugManager, layers, player = null, config = {}) {
    const defaultConfig = {
        excludeLayers: ['Bridges', 'Ground', 'Decorative'],
        autoEnable: false,
        debugName: 'Map Collision Debug'
    };

    const finalConfig = { ...defaultConfig, ...config };

    console.log(`🎯 Configuring ${finalConfig.debugName} for ${layers.length} layers`);

    debugManager.setupCollisionDebug(layers, {
        excludeLayers: finalConfig.excludeLayers,
        player: player,
        autoEnable: finalConfig.autoEnable
    });

    return debugManager;
}

// Usage examples:
/*
// Tutorial map
configureMapCollisionDebug(
    this.debugManager,
    this.mapManager.layers,
    this.player,
    { excludeLayers: ['Bridges', 'Ground'], debugName: 'Tutorial Map' }
);

// Dungeon map
configureMapCollisionDebug(
    this.debugManager,
    this.dungeonLayers,
    this.player,
    { excludeLayers: ['Ambient'], autoEnable: true, debugName: 'Dungeon Map' }
);

// Platformer map (only platform layers)
const platformOnlyLayers = this.layers.filter(l => l.name.includes('Platform'));
configureMapCollisionDebug(
    this.debugManager,
    platformOnlyLayers,
    this.player,
    { excludeLayers: [], debugName: 'Platformer Map' }
);
*/

export { configureMapCollisionDebug };
