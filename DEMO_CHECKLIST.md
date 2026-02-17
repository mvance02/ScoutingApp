# Quick Demo Checklist

## Pre-Demo Setup ✅

- [ ] Server is running (port 3001)
- [ ] Frontend is running (port 3000)
- [ ] Database is connected
- [ ] Have 2 browser windows ready (same game)
- [ ] Sample data prepared:
  - [ ] At least 1 game with stats
  - [ ] Players with comments
  - [ ] Flagged players
  - [ ] Recruits with weekly reports
- [ ] Test accounts ready:
  - [ ] Admin account (mvance02@byu.edu)
  - [ ] Scout account (speyerb@byu.edu)

---

## Demo Flow (15-20 min)

### 1. Dashboard (2 min)
- [ ] Show flagged players queue
- [ ] Show activity feed (point out real-time updates)
- [ ] Show average composite rating
- [ ] Show top performances

### 2. Game Review (5 min)
- [ ] Demonstrate keyboard shortcuts (`r`, `c`, `t`, `RT`, etc.)
- [ ] Show video clock integration
- [ ] **Real-time demo:** Open same game in 2 windows
  - [ ] Add stat in Window 1
  - [ ] Show appearing in Window 2 instantly
- [ ] Show game chat
- [ ] Show player grades section
- [ ] Show export options

### 3. Player Management (3 min)
- [ ] Show player profile
- [ ] Show player comments
- [ ] **Demo @mentions:**
  - [ ] Type `@` in comment
  - [ ] Show autocomplete dropdown
  - [ ] Post comment with mention
  - [ ] Show highlighted mention
- [ ] Show visit tracking
- [ ] Show stat trends chart

### 4. Recruits Report (3 min)
- [ ] Show weekly report layout
- [ ] Show auto-populated stats from Saturday review
- [ ] Show position coach assignments
- [ ] Show export/email options

### 5. Analytics Dashboard (3 min)
- [ ] Show class composite rating
- [ ] Show recruiting funnel
- [ ] Show position needs board
- [ ] Show time-to-commit metrics
- [ ] Show offer-to-commit rate
- [ ] Show position leaderboard

### 6. Collaboration Features (3 min)
- [ ] **Activity Feed:**
  - [ ] Perform action (add stat/comment)
  - [ ] Show appearing in activity feed
- [ ] **Real-Time Updates:**
  - [ ] Add stat in one window
  - [ ] Show appearing in other window
- [ ] **@Mentions:**
  - [ ] Mention someone in comment
  - [ ] Show notification appearing
- [ ] **Chat:**
  - [ ] Send message in game chat
  - [ ] Show appearing in other window

### 7. Admin Features (if applicable) (2 min)
- [ ] Show user management
- [ ] Show scout assignments
- [ ] Show audit log

---

## Key Features to Highlight

### ⚡ Speed & Efficiency
- Keyboard shortcuts for fast stat entry
- Real-time updates (no refresh needed)
- Automated weekly reports

### 🤝 Collaboration
- Multiple scouts working simultaneously
- Real-time chat and comments
- @Mentions for communication

### 📊 Data & Insights
- Analytics dashboard
- Position needs tracking
- Composite rating monitoring

### 📧 Reporting
- Automated weekly reports
- PDF/Excel exports
- Email integration

---

## Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| `r` | Rush |
| `c` | Reception |
| `t` | Tackle Solo |
| `a` | Tackle Assist |
| `p` | Pass Comp |
| `m` | Pass Inc |
| `i` | INT |
| `f` | Fumble |
| `s` | Sack |
| `l` | TFL |
| `b` | PBU |
| `RT` | Rush TD |
| `CT` | Rec TD |
| `PT` | Pass TD |
| `?` | Show all shortcuts |

---

## Troubleshooting

**If real-time updates don't work:**
- Check WebSocket connection (browser console)
- Verify server is running
- Check both windows are logged in

**If @mentions don't work:**
- Verify notifications table exists
- Check user is logged in
- Verify mentioned user exists

**If exports fail:**
- Check browser console for errors
- Verify data exists
- Check server logs

---

## Post-Demo

- [ ] Answer questions
- [ ] Collect feedback
- [ ] Schedule follow-up if needed
- [ ] Provide access/login info if requested
