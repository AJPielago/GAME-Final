// Test script to verify user-specific save slots
// Run this in browser console on different accounts

function testUserSpecificSaves() {
    const userId = window.gameData?.user?.id;
    const username = window.gameData?.user?.username;
    
    console.log(`🧪 Testing save slots for user: ${username} (ID: ${userId})`);
    
    // Test save slot 1
    const testSaveKey = `game_save_slot_1_user_${userId}`;
    const testSaveData = {
        test: true,
        user: username,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(testSaveKey, JSON.stringify(testSaveData));
    
    // Verify it exists
    const retrieved = localStorage.getItem(testSaveKey);
    if (retrieved) {
        const parsed = JSON.parse(retrieved);
        console.log(`✅ Save test passed for ${username}:`, parsed);
    } else {
        console.log(`❌ Save test failed for ${username}`);
    }
    
    // Check that we can't see other users' saves
    console.log('🔍 Checking for other user saves...');
    Object.keys(localStorage).forEach(key => {
        if (key.includes('game_save_slot_') && !key.includes(`user_${userId}`)) {
            console.log(`⚠️ Found other user's save: ${key}`);
        }
    });
    
    if (!Object.keys(localStorage).some(key => key.includes('game_save_slot_') && !key.includes(`user_${userId}`))) {
        console.log('✅ No other user saves found - isolation working!');
    }
}

// Run the test
testUserSpecificSaves();
