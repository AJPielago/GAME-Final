// Cleanup script to remove old non-user-specific save slots
// Run this in browser console to clean up old saves

function cleanupOldSaves() {
    const userId = window.gameData?.user?.id;
    const username = window.gameData?.user?.username;
    
    console.log(`🧹 Cleaning up old save slots for user: ${username} (ID: ${userId})`);
    
    let cleanedCount = 0;
    
    // Find and remove old save slots
    Object.keys(localStorage).forEach(key => {
        if (key.includes('game_save_slot_') && !key.includes(`user_${userId}`)) {
            console.log(`🗑️ Removing old save slot: ${key}`);
            localStorage.removeItem(key);
            cleanedCount++;
        }
    });
    
    console.log(`✅ Cleanup complete! Removed ${cleanedCount} old save slots.`);
    
    // Verify no old saves remain
    const remainingOldSaves = Object.keys(localStorage).filter(key => 
        key.includes('game_save_slot_') && !key.includes(`user_${userId}`)
    );
    
    if (remainingOldSaves.length === 0) {
        console.log('✅ All old save slots successfully removed!');
    } else {
        console.log('⚠️ Some old saves still remain:', remainingOldSaves);
    }
}

// Run the cleanup
cleanupOldSaves();
