import { createContext, useContext } from 'react';

// UI-level actions the Shell owns and screens call: open the Log Ride sheet (new, optionally
// with a date pre-filled — Rides tab "Log a ride on <date>" — or edit). Kept separate from
// AppDataContext, which holds data and never opens UI.
export const ShellContext = createContext({ openLogRide: () => {}, openEditRide: () => {} });
export const useShell = () => useContext(ShellContext);
