# Cycling Training App

## Purpose
Tracks cycling rides, calculates training metrics (TSS, training load), estimates fitness progress with eFTP (estimated FTP with decay function), and provides gamified progression tracking. Includes an instant analysis feature with canned responses based on metrics and recent rides.

## Tech Stack
- React 18
- Vite
- localStorage for data persistence
- Data import from intervals.icu (JSON format)

## Key Features
- Ride logging and history. Manual entry and import from Intervals
- FTP and eFTP tracking
- Training load calculations
- Progression tracking system (gamified levels)
- Charts: Hours, TSS, Elevation, eFTP over time

## Data Structure
- **userData**: Stores FTP, weight, training zones
- **rideHistory**: Array of ride objects with date, duration, TSS, eFTP, etc.
- **progressionLevels**: Tracks training zone progression

## Important Notes
- eFTP comes from intervals.icu with built-in decay
- When eFTP differs from manual FTP by >10W, prompt user to update
- Ride history data can be imported from Intervals, and can be logged manually
- All data stored in browser localStorage
