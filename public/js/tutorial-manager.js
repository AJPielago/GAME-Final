/**
 * TutorialManager - Manages the tutorial flow and progression
 */
class TutorialManager {
    constructor(scene) {
        this.scene = scene;
        this.currentStep = 0;
        this.movementComplete = false;
        this.attackComplete = false;
        this.interactionComplete = false;
        this.tutorialActive = false;
        
        console.log('TutorialManager initialized');
    }
    
    /**
     * Create tutorial UI elements
     */
    create() {
        console.log('TutorialManager: Creating tutorial UI...');
        
        // Tutorial will use the DialogueManager for displaying messages
        // No additional UI needed here
    }
    
    /**
     * Start the tutorial sequence
     */
    startTutorial() {
        console.log('Starting tutorial...');
        this.tutorialActive = true;
        this.currentStep = 0;
        
        // Show welcome message
        if (this.scene.dialogueManager) {
            this.scene.dialogueManager.startDialogue([
                'Welcome to CodeQuest!',
                'I\'m here to teach you the basics.',
                'Let\'s start by learning how to move around.'
            ], () => {
                this.startMovementTutorial();
            });
        } else {
            console.error('DialogueManager not available!');
        }
    }
    
    /**
     * Start the movement tutorial step
     */
    startMovementTutorial() {
        console.log('Starting movement tutorial step...');
        
        if (this.scene.dialogueManager) {
            this.scene.dialogueManager.startDialogue([
                'Use the WASD keys or Arrow keys to move your character.',
                'Try moving around now!'
            ], () => {
                // Enable movement detection
                this.watchForMovement();
            });
        }
    }
    
    /**
     * Watch for player movement
     */
    watchForMovement() {
        console.log('Watching for movement...');
        
        const checkMovement = () => {
            if (!this.tutorialActive || this.movementComplete) return;
            
            const keys = this.scene.playerController?.keys;
            if (!keys) {
                this.scene.time.delayedCall(100, checkMovement);
                return;
            }
            
            const isMoving = 
                keys.up?.isDown || keys.down?.isDown || 
                keys.left?.isDown || keys.right?.isDown ||
                keys.up2?.isDown || keys.down2?.isDown ||
                keys.left2?.isDown || keys.right2?.isDown;
            
            if (isMoving) {
                console.log('Movement detected!');
                this.completeMovementTutorial();
            } else {
                this.scene.time.delayedCall(100, checkMovement);
            }
        };
        
        checkMovement();
    }
    
    /**
     * Complete the movement tutorial step
     */
    completeMovementTutorial() {
        console.log('Movement tutorial complete!');
        this.movementComplete = true;
        this.currentStep++;
        
        if (this.scene.dialogueManager) {
            this.scene.dialogueManager.startDialogue([
                'Great job! You\'ve learned how to move.',
                'Now let\'s learn about combat mechanics.',
                'Walk close to an enemy to start a quiz battle!',
                'Answer questions correctly to defeat enemies.'
            ], () => {
                this.startCombatTutorial();
            });
        }
    }
    
    /**
     * Start the combat tutorial step
     */
    startCombatTutorial() {
        console.log('Starting combat tutorial step...');
        this.watchForEnemyInteraction();
    }
    
    /**
     * Watch for player enemy interaction
     */
    watchForEnemyInteraction() {
        console.log('Watching for enemy interaction...');
        
        // Listen for enemy interaction events
        this.scene.events.on('enemyInteraction', () => {
            if (this.tutorialActive && !this.attackComplete) {
                console.log('Enemy interaction detected!');
                this.completeCombatTutorial();
            }
        });
        
        // Also complete if tutorial takes too long (fallback)
        this.scene.time.delayedCall(30000, () => {
            if (this.tutorialActive && !this.attackComplete) {
                console.log('Combat tutorial timeout - completing automatically');
                this.completeCombatTutorial();
            }
        });
    }
    
    /**
     * Complete the combat tutorial step
     */
    completeCombatTutorial() {
        console.log('Combat tutorial complete!');
        this.attackComplete = true;
        this.currentStep++;
        
        if (this.scene.dialogueManager) {
            this.scene.dialogueManager.startDialogue([
                'Excellent! You\'ve learned about quiz battles!',
                'Answer 3 questions correctly to clear all enemies.',
                'You\'re now ready to begin your coding adventure.',
                'Press TAB to toggle debug mode and see collision boxes.',
                'Good luck, adventurer!'
            ], () => {
                this.completeTutorial();
            });
        }
    }
    
    /**
     * Complete the entire tutorial
     */
    completeTutorial() {
        console.log('Tutorial complete!');
        this.tutorialActive = false;
        
        // Emit event that tutorial is complete
        this.scene.events.emit('tutorialComplete');
        
        // Could transition to main game scene here
        // this.scene.scene.start('MainGameScene');
    }
    
    /**
     * Update tutorial state
     */
    update() {
        // Tutorial logic is event-driven, no per-frame updates needed
    }
    
    /**
     * Skip the tutorial
     */
    skipTutorial() {
        console.log('Skipping tutorial...');
        this.tutorialActive = false;
        this.movementComplete = true;
        this.attackComplete = true;
        this.interactionComplete = true;
        
        if (this.scene.dialogueManager) {
            this.scene.dialogueManager.setVisible(false);
        }
        
        this.scene.events.emit('tutorialComplete');
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    if (!window.TutorialManagers) {
        window.TutorialManagers = {};
    }
    window.TutorialManagers.TutorialManager = TutorialManager;
    console.log('TutorialManager registered globally');
}