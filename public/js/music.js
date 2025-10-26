class MusicPlayer {
    constructor() {
        try {
            this.audio = new Audio('/audio/music.mp3');
            this.audio.preload = 'auto';
            this.audio.loop = true;
            this.audio.volume = 0.3;
            this.audio.autoplay = true;
            
            // Add error handling for audio loading
            this.audio.addEventListener('error', (e) => {
                console.error('Audio loading error:', e);
            });

            this.button = document.getElementById('toggleMusic');
            if (!this.button) {
                throw new Error('Music button not found!');
            }

            this.isMuted = localStorage.getItem('musicMuted') === 'true';
            console.log('MusicPlayer initialized:', { isMuted: this.isMuted });
            
            this.init();
        } catch (error) {
            console.error('MusicPlayer initialization failed:', error);
        }
    }

    init() {
        this.updateButtonState();
        
        this.button.addEventListener('click', () => {
            console.log('Music button clicked');
            this.toggleMusic();
        });

        // Attempt immediate autoplay
        if (!this.isMuted) {
            this.audio.play().catch(() => {
                // Fallback to user gestures
                const unlock = () => {
                    if (!this.isMuted) {
                        this.audio.play().catch(() => {});
                    }
                    window.removeEventListener('pointerdown', unlock);
                    window.removeEventListener('keydown', unlock);
                    window.removeEventListener('touchstart', unlock);
                    window.removeEventListener('click', unlock);
                };
                window.addEventListener('pointerdown', unlock, { once: true });
                window.addEventListener('keydown', unlock, { once: true });
                window.addEventListener('touchstart', unlock, { once: true });
                window.addEventListener('click', unlock, { once: true });
            });
        }
    }

    toggleMusic() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('musicMuted', this.isMuted);

        if (this.isMuted) {
            this.audio.pause();
            console.log('Music paused');
        } else {
            this.audio.play().catch((error) => {
                console.error('Audio playback failed:', error);
            });
            console.log('Music playing');
        }

        this.updateButtonState();
    }

    updateButtonState() {
        const icon = this.button.querySelector('.sound-icon');
        this.button.setAttribute('aria-pressed', String(!this.isMuted));
        this.button.title = this.isMuted ? 'Music Off' : 'Music On';
        if (icon) {
            if (this.isMuted) {
                this.button.classList.add('muted');
            } else {
                this.button.classList.remove('muted');
            }
        } else {
            // Fallback: toggle emoji/text if no icon element
            this.button.textContent = this.isMuted ? '🔇' : '🔊';
        }
        console.log('Button state updated:', { isMuted: this.isMuted });
    }
}

// Wait for DOM and create player
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing MusicPlayer');
    window.musicPlayer = new MusicPlayer();
});

