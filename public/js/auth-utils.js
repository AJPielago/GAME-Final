// Authentication utilities for clearing game state
class AuthUtils {
    static clearGameData() {
        try {
            // Clear localStorage items that might persist game state
            const keysToRemove = [
                'DEBUG_LOGS',
                'theme',
                'gameState',
                'playerData',
                'tutorialProgress',
                'questProgress',
                'characterData',
                'gameProgress',
                'disabledTiles',
                'gameee_dashboard_data', // This is the key causing cross-account data sharing
                'gameee_player_data',
                'gameee_game_state'
            ];
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
            });
            
            // Clear sessionStorage as well
            sessionStorage.clear();
            
            console.log('Game data cleared successfully');
        } catch (e) {
            console.warn('Failed to clear some game data:', e);
        }
    }
    
    static clearOnLogout() {
        // Clear game data when user logs out
        this.clearGameData();
        
        // Also clear any cookies that might contain game state
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
    }
    
    static initNewUser() {
        // Clear any existing game data for new user
        this.clearGameData();
        
        // Set default values for new user
        try {
            localStorage.setItem('theme', 'dark'); // Default theme
        } catch (e) {
            console.warn('Failed to set default theme:', e);
        }
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.AuthUtils = AuthUtils;
}
