# In-Game Name Debugging Guide

## Changes Made

### 1. Database Model (`models/User.js`)
- ✅ Added `inGameName` field to User schema
- Type: String, trimmed, default: null
- Stores character name from Quest 1

### 2. Client-Side (`public/js/game.js`)
- ✅ Added logging when name is set
- ✅ Fixed `saveToServer()` to prioritize passed `inGameName` data
- ✅ Removed spread operator that might override the value

### 3. Server-Side (`routes/index.js`)
- ✅ Added code to save `inGameName` to database
- ✅ Added detailed logging to track the value

## How to Test

1. **Restart your server** (important for model changes to take effect)
   ```bash
   # Stop the server (Ctrl+C)
   # Start it again
   npm start
   ```

2. **Delete your current save** (to start fresh)
   - In game, press `M` for settings
   - Click "Delete Save"
   - Page will reload automatically

3. **Start Quest 1**
   - Walk to the first quest NPC
   - Press `E` to start
   - Enter your character name
   - Click "Confirm"

4. **Check the console logs**
   - Browser Console (F12) should show:
     ```
     ✅ In-game name set to: [your name]
     💾 Saved in-game name to server: [your name]
     ```
   
   - Server Console should show:
     ```
     📥 Received inGameName: [your name] Type: string
     👤 Updated inGameName: [your name]
     ```

5. **Reload the page**
   - Press F5 or refresh
   - Check if your name appears in the HUD (top-left)
   - Should show your character name instead of username

## What to Look For

### ✅ Success Indicators:
- Name appears in HUD after entering it
- Name persists after page reload
- Console shows successful save messages
- Server logs show name being received and saved

### ❌ Failure Indicators:
- Name reverts to username after reload
- Console shows errors
- Server logs show null/undefined for inGameName
- Database doesn't have the field

## Troubleshooting

### If name still doesn't persist:

1. **Check server logs** - Look for:
   - `📥 Received inGameName:` - Is it receiving the name?
   - `👤 Updated inGameName:` - Is it saving to user object?

2. **Check database** - Use MongoDB Compass or CLI:
   ```javascript
   db.users.findOne({ username: "your_username" })
   // Look for inGameName field
   ```

3. **Check browser console** - Look for:
   - Any errors during save
   - Whether `playerProfile.inGameName` is set
   - Whether save request completes successfully

4. **Verify model restart** - Make sure you restarted the server after adding the field

## Expected Flow

```
User enters name in Quest 1
    ↓
playerProfile.inGameName = name (client)
    ↓
saveToServer({ inGameName: name }) (client)
    ↓
POST /game/save with inGameName (network)
    ↓
Server receives inGameName (server)
    ↓
user.inGameName = inGameName (server)
    ↓
user.save() (database)
    ↓
Name stored in MongoDB
    ↓
On reload: GET /game/load
    ↓
Server sends inGameName back
    ↓
playerProfile.inGameName = data.inGameName (client)
    ↓
HUD displays inGameName
```

## Quick Fix Commands

If you need to manually set the name in database:
```javascript
// In MongoDB shell or Compass
db.users.updateOne(
  { username: "your_username" },
  { $set: { inGameName: "Your Character Name" } }
)
```

## Files Modified

1. `models/User.js` - Added inGameName field
2. `routes/index.js` - Added save logic and logging
3. `public/js/game.js` - Fixed save method and added logging

---

**Last Updated:** October 22, 2025  
**Status:** Testing Required
