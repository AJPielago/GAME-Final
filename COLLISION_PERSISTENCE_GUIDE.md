# Collision Box Persistence - Implementation Guide

## What Was Changed

The collision debugging system now saves and loads collision box toggles **GLOBALLY** across ALL users and accounts. 

**⚠️ ADMIN ONLY:** Only users with the `admin` role can modify collision boxes. Regular players can view collision debug mode but cannot toggle collision states.

### Files Modified

1. **models/CollisionOverride.js** - NEW: Created global collision override model
2. **routes/index.js** - Added global collision override save/load API routes with admin-only save protection
3. **public/js/game.js** - Added global save/load functions, admin role check, and user notifications
4. **views/game.ejs** - Added user role to gameData for client-side role checking
5. **middleware/auth.js** - Existing `requireAdmin` middleware used for API protection

## How It Works

### 1. Toggle Collision Boxes (Admin Only)
- Press `C` or `Tab` to enable debug mode (available to all users)
- **Admin users only:** Click on any collision tile to toggle it ON/OFF
- **Regular players:** Can view collision boxes but cannot modify them
- The change is **automatically saved GLOBALLY** for all users immediately

### 2. Data Storage
- Collision overrides are stored as key-value pairs: `"x,y,layerName" -> boolean`
- `true` = collision ON, `false` = collision OFF
- Stored in MongoDB in a single global document: `CollisionOverride` collection with ID `'global'`

### 3. Persistence
- When you refresh the page, collision overrides are automatically loaded
- **ALL users share the same collision override settings**
- Changes made by one user are visible to all other users
- Changes persist across sessions and accounts

## Testing Steps

1. **Start the server** (if not already running):
   ```bash
   node server.js
   ```

2. **Login to your account**

3. **Enable debug mode**:
   - Press `C` or `Tab` key

4. **Toggle some collision boxes**:
   - Click on collision tiles (they'll show as red/green boxes)
   - Watch the console for save confirmation messages

5. **Refresh the page**:
   - The collision boxes should maintain their toggled state
   - Check console for load messages

## Console Messages to Look For

### When Toggling:
```
🖱️ Toggled collision at (x, y) on layer 'layerName'
   Tile ID: ### | Collision: ON ✓ (or OFF ✗)
   💾 Collision override will be saved globally for all users
💾 Saving collision overrides globally: X tiles
✅ Collision overrides saved globally: X tiles
```

### When Loading (on refresh):
```
🔧 Loading global collision overrides...
📥 Loading global collision overrides...
✅ Loaded global collision overrides: X tiles
```

## Troubleshooting

### If collision boxes don't persist:

1. **Check console for errors** - Look for save/load error messages

2. **Verify database connection** - Make sure MongoDB is running

3. **Check user authentication** - Make sure you're logged in

4. **Clear browser cache** - Sometimes old JavaScript files are cached

5. **Check server logs** - Look for save/load route messages:
   ```
   🔧 Saving collision overrides: X tiles
   🔧 Loading collision overrides: X tiles
   ```

### Common Issues:

- **"collisionOverrides not available"** - The Map wasn't initialized (shouldn't happen now)
- **No save messages** - Auto-save might have failed, check network tab
- **Loads as empty** - Database might not have saved properly, check server logs

## Technical Details

### Data Flow:

1. **Toggle** → `collisionOverrides.set(key, value)`
2. **Auto-save** → Convert Map to Object → Send to `/api/collision-overrides/save`
3. **Server** → Save to global `CollisionOverride` document (ID: 'global')
4. **Refresh** → Load from `/api/collision-overrides/load` → Convert Object to Map
5. **Restore** → `collisionOverrides.set(key, value)` for each entry
6. **Shared** → All users load from the same global document

### Key Code Locations:

- **Declaration**: Line ~172 in game.js
- **Global Save Function**: Line ~175 in game.js (`saveCollisionOverridesGlobally`)
- **Global Load Function**: Line ~206 in game.js (`loadCollisionOverridesGlobally`)
- **Toggle Handler**: Line ~3477 in game.js
- **Game Init Load**: Line ~5601 in game.js
- **Server Save Route**: Line ~980 in routes/index.js (`POST /api/collision-overrides/save`)
- **Server Load Route**: Line ~1022 in routes/index.js (`GET /api/collision-overrides/load`)
- **CollisionOverride Model**: models/CollisionOverride.js

## Notes

- Collision overrides are **GLOBAL across ALL users** - not per-account
- **Only admin users can modify** collision boxes, but all users can view them
- Regular players will see a notification if they try to toggle collision boxes
- The system uses auto-save, so manual saving is not required
- All existing game functionality is preserved
- Changes are stored in a single MongoDB document with ID 'global'

## Security Features

### Client-Side Protection:
- `isUserAdmin()` function checks user role before allowing collision toggle
- Non-admin users see notification: "⚠️ Admin access required to modify collision boxes"
- Console logs inform users of their collision debug permissions on game load

### Server-Side Protection:
- `/api/collision-overrides/save` route checks user role before saving
- Returns 403 Forbidden error for non-admin users
- Logs attempted unauthorized access

## Making a User Admin

To grant admin access to a user, update their role in MongoDB:

```javascript
// In MongoDB shell or Compass
db.users.updateOne(
  { username: "your_username" },
  { $set: { role: "admin" } }
)
```

Or use the `make-admin-direct.js` script if available in the scripts folder.
