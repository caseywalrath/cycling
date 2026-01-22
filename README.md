# Gran Fondo Utah Training Tracker

A Progressive Web App (PWA) for tracking cycling training with TrainerRoad-style progression levels, TSS calculations, and training load analytics.

**Event Goal:** Gran Fondo Utah - June 13, 2026

## Features

- **Progression Levels**: Track your improvement across 6 training zones (Endurance, Tempo, Sweet Spot, Threshold, VO2max, Anaerobic)
- **Training Load Metrics**: CTL (Chronic Training Load), ATL (Acute Training Load), TSB (Training Stress Balance)
- **TSS & IF Calculations**: Automatic Training Stress Score and Intensity Factor calculations
- **Workout Logging**: Log workouts with power, duration, RPE, and notes
- **Smart Insights**: Automated training analysis and recommendations
- **Data Persistence**: All data stored locally in your browser
- **Export/Import**: Backup and restore your training data
- **PWA Support**: Install on your iPhone home screen like a native app

## Quick Start (For Beginners)

### Prerequisites

You need to install:
1. **Node.js** - Download from [nodejs.org](https://nodejs.org/) (choose LTS version)
   - This includes npm (Node Package Manager) which we'll use to install dependencies

### Step 1: Install Dependencies

Open Command Prompt (Windows) or Terminal and navigate to this folder:

```bash
cd path/to/cycling
```

Then install all required packages:

```bash
npm install
```

This will download all the libraries needed to run the app (React, Vite, Tailwind, etc.)

### Step 2: Run Development Server

```bash
npm run dev
```

You should see something like:
```
VITE v5.4.11  ready in 432 ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.1.123:3000/
```

Open the **Network** URL on your iPhone (make sure your iPhone is on the same WiFi network as your computer).

### Step 3: Install on iPhone

1. On your iPhone, open Safari and go to the Network URL (e.g., `http://192.168.1.123:3000/`)
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Name it "GF Training" and tap **Add**
5. You now have an app icon on your home screen!

**Note:** When using `npm run dev`, the app only works while your computer is running and connected to the same WiFi. For a permanent solution, see the deployment options below.

## Deployment Options (Free)

To make your app accessible anywhere without keeping your computer running, deploy it to one of these free hosting services:

### Option 1: Netlify (Recommended - Easiest)

1. **Create a free account** at [netlify.com](https://www.netlify.com/)

2. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

3. **Build your app**:
   ```bash
   npm run build
   ```

4. **Deploy**:
   ```bash
   netlify deploy --prod
   ```
   - Follow the prompts
   - Select "Create & configure a new site"
   - When asked for publish directory, enter: `dist`

5. **You'll get a URL** like `https://your-app-name.netlify.app`

6. **On your iPhone**, open that URL in Safari and add to home screen!

### Option 2: Vercel

1. **Create account** at [vercel.com](https://vercel.com/)

2. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   - Follow the prompts
   - You'll get a URL like `https://your-app-name.vercel.app`

### Option 3: GitHub Pages

1. **Make sure your code is on GitHub** (already done if you cloned this repo)

2. **Install gh-pages**:
   ```bash
   npm install -D gh-pages
   ```

3. **Update package.json** - Add homepage and deploy scripts:
   ```json
   {
     "homepage": "https://yourusername.github.io/cycling",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

4. **Update vite.config.js** - Add base path:
   ```javascript
   export default defineConfig({
     base: '/cycling/',
     // ... rest of config
   ```

5. **Deploy**:
   ```bash
   npm run deploy
   ```

6. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Settings → Pages
   - Source: Deploy from branch `gh-pages`
   - Your app will be at `https://yourusername.github.io/cycling`

## How It Works

### Progression Level System

The app tracks your ability in each training zone (1-10 scale):
- Complete a workout → Level increases based on difficulty vs RPE
- Fail to complete → Level decreases
- The harder the workout relative to your level + lower RPE = bigger gains

### Training Load (PMC)

- **CTL (Chronic Training Load)**: 42-day weighted average TSS (your "fitness")
- **ATL (Acute Training Load)**: 7-day weighted average TSS (your "fatigue")
- **TSB (Training Stress Balance)**: CTL - ATL (your "freshness")

**TSB Ranges:**
- `< -25`: Very tired, high risk of overtraining
- `-25 to -10`: Tired but building fitness
- `-10 to +5`: Neutral, ready for normal training
- `+5 to +20`: Fresh, good for hard efforts/races
- `> +25`: Very fresh, but fitness may be declining

### TSS Calculation

Training Stress Score = `(duration_hours × NP × IF) / (FTP × 3600) × 100`

Where:
- **NP** = Normalized Power (watts)
- **IF** = Intensity Factor (NP / FTP)
- **FTP** = Functional Threshold Power (currently set to 235W)

## Customizing Your FTP

To change your FTP from the default 235W:

1. Open `src/App.jsx`
2. Find line 22: `const FTP = 235;`
3. Change to your FTP value
4. Save and rebuild: `npm run build`
5. Redeploy

## Data Management

### Export Your Data
1. Go to History tab
2. Click "Export Data"
3. Saves a JSON file with all your workouts and progression levels

### Import Data
1. Click "Import File" or "Paste JSON"
2. Select your exported file or paste JSON
3. All data restored!

### Copy for AI Analysis
On the Dashboard tab, click "Copy for Claude" to get a formatted summary you can paste into Claude for personalized training advice.

## Development Scripts

```bash
# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linter
npm run lint
```

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **PWA** - Progressive Web App capabilities
- **LocalStorage** - Data persistence

## Browser Support

- **iOS Safari** - Fully supported (primary target)
- **Chrome/Edge** - Fully supported
- **Firefox** - Fully supported

## Troubleshooting

### App won't install on iPhone
- Make sure you're using Safari (not Chrome)
- Check that you're accessing via HTTPS (required for PWA)
- Local development uses HTTP, which works but won't install

### Changes not showing up
- Hard refresh in browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Clear browser cache
- For PWA updates, you may need to reinstall from home screen

### Data disappeared
- Check if you're in a different browser or incognito mode
- Data is stored per-browser using localStorage
- Export your data regularly as backup!

### Can't access from iPhone on local network
- Make sure your iPhone and computer are on the same WiFi
- Check your computer's firewall isn't blocking port 3000
- Try the IP address shown in "Network" instead of "Local"

## Future Enhancements (Ideas)

- [ ] GPS route tracking
- [ ] Heart rate zone tracking
- [ ] Workout library with pre-built TrainerRoad-style workouts
- [ ] Calendar view
- [ ] Charts and graphs for progression over time
- [ ] Strava integration
- [ ] Multiple rider profiles
- [ ] Custom training plans
- [ ] Race taper recommendations

## License

MIT License - Feel free to modify and use as you like!

## Questions?

This is a personal training app. If you're using it and have questions or want features added, just ask Claude to help modify it!

## Credits

Created with the help of Claude AI as a TrainerRoad-inspired training tracker for Gran Fondo Utah 2026.

---

**Happy Training! See you at Gran Fondo Utah! 🚴‍♂️**
