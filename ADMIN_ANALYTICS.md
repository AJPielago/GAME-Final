# Admin Analytics Dashboard

## Overview
The Admin Analytics Dashboard provides comprehensive insights into user activity, statistics, and engagement metrics for CodeQuest administrators.

## Features

### 📊 Statistics Overview
- **Total Users**: Complete count of registered users
- **Active Users**: Number of currently active users
- **Admin Users**: Count of users with admin privileges
- **Player Users**: Count of regular players
- **Average Level**: Mean level across all users
- **Average Pixel Coins**: Average currency accumulated
- **Total Monsters Defeated**: Cumulative monsters defeated by all users
- **Total Quests Completed**: Combined quest completion count

### 📈 Distribution Insights
- **Character Type Distribution**: Visual breakdown of character preferences (knight, mage, druid, paladin)
- **JavaScript Level Distribution**: Skill level categorization (beginner, intermediate, advanced, expert)

### 📋 User List
Complete table displaying:
- Username
- Email
- In-Game Name
- Role (Admin/Player)
- Active Status
- Level & Experience
- Pixel Coins
- Character Type
- JavaScript Level
- Quests Completed
- Monsters Defeated
- Play Time (minutes)

## Access

### Prerequisites
Users must have the `admin` role to access the analytics dashboard.

### URL
Navigate to: `/admin/analytics`

### Navigation
Admin users will see an "Admin" link in the navigation bar (highlighted in gold) on:
- Dashboard
- Profile
- Leaderboard

## Making a User an Admin

### Using the Helper Script
```bash
node scripts/make-admin.js <username_or_email>
```

Example:
```bash
node scripts/make-admin.js john_doe
# or
node scripts/make-admin.js john@example.com
```

### Manually in Database
If you prefer to update directly in MongoDB:
```javascript
db.users.updateOne(
  { username: "john_doe" },
  { $set: { role: "admin" } }
)
```

## Listing Users

To view all users and their roles:
```bash
node scripts/list-users.js
```

This will display a formatted table with user information including roles.

## Security

### Authorization Middleware
The `requireAdmin` middleware ensures:
1. User is authenticated (has valid session)
2. User has the `admin` role
3. Returns 403 Forbidden for unauthorized access

### Implementation
```javascript
const { requireAdmin } = require('../middleware/auth');

router.get('/admin/analytics', requireAdmin, async (req, res) => {
  // Only accessible to admin users
});
```

## API Endpoints

### GET `/admin/analytics`
Returns the analytics dashboard page with all statistics and user data.

**Authorization**: Admin only

**Response**: HTML page with analytics data

### GET `/admin/api/user/:userId`
Fetches detailed information for a specific user.

**Authorization**: Admin only

**Response**:
```json
{
  "success": true,
  "user": {
    "_id": "...",
    "username": "...",
    "email": "...",
    "level": 5,
    "experience": 1200,
    "progress": {...}
  }
}
```

## Technical Details

### Files Modified/Created
1. **Models**
   - `models/User.js`: Added `role` field with enum `['player', 'admin']`

2. **Middleware**
   - `middleware/auth.js`: Added `requireAdmin` middleware

3. **Routes**
   - `routes/admin.js`: New admin routes file

4. **Views**
   - `views/admin/analytics.ejs`: Analytics dashboard page
   - Updated navigation in: `dashboard.ejs`, `profile.ejs`, `leaderboard.ejs`

5. **Scripts**
   - `scripts/make-admin.js`: Helper to promote users to admin
   - `scripts/list-users.js`: Helper to list all users with roles

6. **Server**
   - `server.js`: Registered admin routes

### Default Role
All new users are automatically assigned the `player` role by default.

## Troubleshooting

### Cannot Access Analytics
- Verify your user has `role: 'admin'`
- Check server logs for authentication errors
- Ensure you're logged in with a valid session

### Admin Link Not Visible
- Clear browser cache
- Verify your session is active
- Confirm your user has admin role

### Database Connection Issues
- Verify `MONGODB_URI` in `.env` file
- Ensure MongoDB is running
- Check network connectivity

## Future Enhancements
Potential additions to the analytics dashboard:
- Real-time user activity monitoring
- Quest completion heatmaps
- User engagement trends over time
- Export data to CSV/Excel
- User activity logs
- Performance metrics
- Custom date range filtering
- Advanced search and filtering
