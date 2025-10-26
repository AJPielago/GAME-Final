// Dialogue Manager for Tutorial
class DialogueManager {
    constructor(scene) {
        this.scene = scene;
        this.dialogueBox = null;
        this.dialogueText = null;
        this.currentDialogue = [];
        this.dialogueIndex = 0;
        this.isVisible = false;
        this.callback = null;
        this.spaceKey = null;
    }

    create() {
        // Create dialogue box
        this.dialogueBox = this.scene.add.graphics()
            .fillStyle(0x000000, 0.7)
            .fillRoundedRect(50, this.scene.game.config.height - 150, 
                           this.scene.game.config.width - 100, 120, 10);
        
        // Create dialogue text
        this.dialogueText = this.scene.add.text(
            80, 
            this.scene.game.config.height - 130, 
            '', 
            { 
                font: '16px Arial', 
                fill: '#ffffff',
                wordWrap: { width: this.scene.game.config.width - 160 },
                lineSpacing: 8
            }
        );
        
        // Create continue prompt
        this.continueText = this.scene.add.text(
            this.scene.game.config.width - 100,
            this.scene.game.config.height - 40,
            'Press SPACE to continue',
            { font: '14px Arial', fill: '#aaaaaa' }
        );
        
        // Set initial visibility
        this.setVisible(false);
        
        // Set up input
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
    
    startDialogue(dialogue, callback = null) {
        if (!Array.isArray(dialogue)) {
            dialogue = [dialogue];
        }
        
        this.currentDialogue = dialogue;
        this.dialogueIndex = 0;
        this.callback = callback;
        this.showNextDialogue();
        this.setVisible(true);
    }
    
    showNextDialogue() {
        if (this.dialogueIndex < this.currentDialogue.length) {
            const text = this.currentDialogue[this.dialogueIndex];
            this.dialogueText.setText(text);
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
        if (this.isVisible && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            const hasMore = this.showNextDialogue();
            if (!hasMore) {
                this.scene.events.emit('dialogueComplete');
            }
        }
    }
    
    setVisible(visible) {
        this.isVisible = visible;
        if (this.dialogueBox) this.dialogueBox.setVisible(visible);
        if (this.dialogueText) this.dialogueText.setVisible(visible);
        if (this.continueText) this.continueText.setVisible(visible);
    }
}

// Tutorial Manager
class TutorialManager {
    constructor(scene) {
        this.scene = scene;
        this.dialogueManager = null;
        this.currentStep = 0;
        this.tutorialComplete = false;
        this.movementComplete = false;
        this.interactionComplete = false;
    }
    
    create() {
        // Initialize dialogue manager
        this.dialogueManager = new DialogueManager(this.scene);
        this.dialogueManager.create();
        
        // Start the tutorial
        this.startMovementTutorial();
    }
    
    update() {
        if (this.dialogueManager) {
            this.dialogueManager.update();
        }
    }
    
    startMovementTutorial() {
        this.currentStep = 1;
        this.dialogueManager.startDialogue([
            'Welcome to CodeQuest! Let\'s learn how to move around.',
            'Use the WASD keys or arrow keys to move your character.',
            'Try moving around now!'
        ], () => {
            // Wait for player to move
            this.waitForMovement();
        });
    }
    
    waitForMovement() {
        // Check for movement every 100ms
        const checkMovement = () => {
            const cursors = this.scene.cursors;
            if (cursors.left.isDown || cursors.right.isDown || 
                cursors.up.isDown || cursors.down.isDown) {
                this.onMovementComplete();
            } else {
                this.scene.time.delayedCall(100, checkMovement);
            }
        };
        
        checkMovement();
    }
    
    onMovementComplete() {
        this.movementComplete = true;
        this.dialogueManager.startDialogue([
            'Great job! You\'ve learned how to move around.',
            'Now let\'s learn how to interact with objects in the game.'
        ], () => {
            this.startInteractionTutorial();
        });
    }
    
    startInteractionTutorial() {
        this.currentStep = 2;
        this.dialogueManager.startDialogue([
            'To interact with objects, move close to them and press the E key.',
            'Try interacting with the computer terminal in front of you.'
        ]);
    }
    
    completeTutorial() {
        this.tutorialComplete = true;
        this.dialogueManager.startDialogue([
            'Congratulations! You\'ve completed the tutorial!',
            'You can now explore the game world and complete challenges.'
        ]);
    }
}

// Export the managers
window.TutorialManagers = {
    DialogueManager,
    TutorialManager
};
