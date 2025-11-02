class AudioManager {
    constructor() {
        // Audio elements
        this.backgroundMusic = null;
        this.gameMusic = null;
        this.questSound = null;

        // Volume levels (0.0 to 1.0)
        this.backgroundVolume = 0.3;
        this.gameVolume = 0.5;
        this.soundVolume = 0.7;

        // Mute states
        this.backgroundMuted = false;
        this.gameMuted = false;
        this.soundMuted = false;

        // Master mute
        this.masterMuted = false;

        this.init();
    }

    init() {
        try {
            // Get audio elements from DOM
            this.backgroundMusic = document.getElementById('backgroundMusic');
            this.gameMusic = document.getElementById('gameMusic');
            this.questSound = document.getElementById('questCompleteSound');

            // Load saved settings
            this.loadSettings();

            // Apply initial volumes and mute states
            this.updateVolumes();

            console.log('✅ AudioManager initialized');
        } catch (error) {
            console.error('❌ AudioManager initialization failed:', error);
        }
    }

    loadSettings() {
        // Load volume settings
        this.backgroundVolume = parseFloat(localStorage.getItem('backgroundVolume')) || 0.3;
        this.gameVolume = parseFloat(localStorage.getItem('gameVolume')) || 0.5;
        this.soundVolume = parseFloat(localStorage.getItem('soundVolume')) || 0.7;

        // Load mute states
        this.backgroundMuted = localStorage.getItem('backgroundMuted') === 'true';
        this.gameMuted = localStorage.getItem('gameMuted') === 'true';
        this.soundMuted = localStorage.getItem('soundMuted') === 'true';
        this.masterMuted = localStorage.getItem('masterMuted') === 'true';
    }

    saveSettings() {
        localStorage.setItem('backgroundVolume', this.backgroundVolume);
        localStorage.setItem('gameVolume', this.gameVolume);
        localStorage.setItem('soundVolume', this.soundVolume);
        localStorage.setItem('backgroundMuted', this.backgroundMuted);
        localStorage.setItem('gameMuted', this.gameMuted);
        localStorage.setItem('soundMuted', this.soundMuted);
        localStorage.setItem('masterMuted', this.masterMuted);
    }

    updateVolumes() {
        const masterMultiplier = this.masterMuted ? 0 : 1;

        if (this.backgroundMusic) {
            this.backgroundMusic.volume = (this.backgroundMuted ? 0 : this.backgroundVolume) * masterMultiplier;
        }
        if (this.gameMusic) {
            this.gameMusic.volume = (this.gameMuted ? 0 : this.gameVolume) * masterMultiplier;
        }
        if (this.questSound) {
            this.questSound.volume = (this.soundMuted ? 0 : this.soundVolume) * masterMultiplier;
        }
    }

    setBackgroundVolume(volume) {
        this.backgroundVolume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
        this.updateVolumes();
    }

    setGameVolume(volume) {
        this.gameVolume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
        this.updateVolumes();
    }

    setSoundVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
        this.updateVolumes();
    }

    toggleBackgroundMute() {
        this.backgroundMuted = !this.backgroundMuted;
        this.saveSettings();
        this.updateVolumes();
        return this.backgroundMuted;
    }

    toggleGameMute() {
        this.gameMuted = !this.gameMuted;
        this.saveSettings();
        this.updateVolumes();
        return this.gameMuted;
    }

    toggleSoundMute() {
        this.soundMuted = !this.soundMuted;
        this.saveSettings();
        this.updateVolumes();
        return this.soundMuted;
    }

    toggleMasterMute() {
        this.masterMuted = !this.masterMuted;
        this.saveSettings();
        this.updateVolumes();
        return this.masterMuted;
    }

    playBackgroundMusic() {
        if (this.backgroundMusic && !this.backgroundMuted && !this.masterMuted) {
            this.backgroundMusic.play().catch(() => {});
        }
    }

    playGameMusic() {
        if (this.gameMusic && !this.gameMuted && !this.masterMuted) {
            this.gameMusic.play().catch(() => {});
        }
    }

    playQuestSound() {
        if (this.questSound && !this.soundMuted && !this.masterMuted) {
            this.questSound.currentTime = 0; // Reset to beginning
            this.questSound.play().catch(() => {});
        }
    }
}

// Create global instance
window.AudioManager = new AudioManager();
