# Admin Button Fix - Summary

## Problem
The admin button was added to all navigation headers, but wasn't visible because the routes were not passing the full user object (including the `role` field) to the templates.

## Root Cause
Several routes were only passing partial user data:
```javascript
user: req.session.userId ? { id: req.session.userId, username: req.session.username } : null
```

This object didn't include the `role` field, so the EJS template check `<% if (user.role === 'admin') { %>` always failed.

## Solution
Updated all routes to fetch the complete user object from the database:
```javascript
let user = null;
if (req.session.userId) {
  try {
    user = await User.findById(req.session.userId).select('-password');
  } catch (error) {
    console.error('Error fetching user:', error);
  }
}
```

## Files Updated

### Routes Fixed (`routes/index.js`)
1. ✅ **Index route** (`/`) - Lines 35-43
2. ✅ **Leaderboard route** (`/leaderboard`) - Lines 340-348 and 361-369
3. ✅ **Tutorial route** (`/tutorial`) - Lines 184-198

### Routes Already Correct
- ✅ **Dashboard route** (`/dashboard`) - Already fetching full user
- ✅ **Profile route** (`/profile`) - Already fetching full user
- ✅ **Game route** (`/game`) - Already fetching full user

### Templates with Admin Button
All templates now have the admin button with role checking:
1. ✅ `views/index.ejs`
2. ✅ `views/dashboard.ejs`
3. ✅ `views/profile.ejs`
4. ✅ `views/leaderboard.ejs`
5. ✅ `views/layout.ejs`
6. ✅ `views/tutorial.ejs`
7. ✅ `views/game.ejs`

## Admin Button Code
```html
<% if (user.role === 'admin') { %>
<a href="/admin/analytics" class="nav-link" style="color: #FFD700; font-weight: bold;">
    <i class="fas fa-chart-bar"></i> Admin
</a>
<% } %>
```

## How to Set Admin Role

### Method 1: Using the Script
```bash
node scripts/make-admin-direct.js YOUR_USER_ID
```

### Method 2: Using MongoDB Compass
1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Navigate to `codequest` database → `users` collection
4. Find your user document
5. Add/edit the field: `role: "admin"`
6. Save the document

### Method 3: Using MongoDB Shell
```javascript
db.users.updateOne(
  { _id: ObjectId("YOUR_USER_ID") },
  { $set: { role: "admin" } }
)
```

## Verification Steps

1. **Restart your server** (important!)
   ```bash
   npm start
   ```

2. **Clear browser cache** or use incognito mode

3. **Log out and log back in** to refresh the session

4. **Check the navigation header** - you should see a gold "Admin" button

5. **Verify in MongoDB** that your user has `role: "admin"`

## Troubleshooting

### Button still not showing?
1. ✅ Verify user has `role: "admin"` in database
2. ✅ Restart the Node.js server
3. ✅ Clear browser cache and cookies
4. ✅ Log out and log back in
5. ✅ Check browser console for errors
6. ✅ Verify you're on the correct database (not mixing local/Atlas)

### Check your user's role:
```javascript
// In MongoDB Compass or shell
db.users.findOne({ email: "your-email@example.com" })
```

Look for the `role` field - it should be `"admin"`.

## Database Schema
The User model includes:
```javascript
role: {
  type: String,
  enum: ['player', 'admin'],
  default: 'player'
}
```

## Next Steps
1. Run the admin script to set your role
2. Restart the server
3. Log out and log back in
4. The admin button should now be visible in the header!
