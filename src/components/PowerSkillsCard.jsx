import React, { useMemo, useState } from 'react';
import { Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { ordinal } from '../lib/format.js';
import { toLocalDateStr } from '../lib/dates.js';
import { powerCurve } from '../lib/records.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { Sheet } from './ui/index.js';

// Population reference: intervals.icu age-40 cohort
// Each entry: secs, label, skill, refWatts (user's known watts), refPct (population percentile)
// 30s and 10m interpolated from adjacent known data points; 30m interpolated from 20m and 60m
const POWER_SKILLS = [
  { secs: 5, label: '5s', skill: 'Sprint', refWatts: 712, refPct: 44.9 },
  { secs: 30, label: '30s', skill: 'Sprint', refWatts: 553, refPct: 42.6 },
  { secs: 60, label: '1m', skill: 'Sprint', refWatts: 362, refPct: 39.8 },
  { secs: 300, label: '5m', skill: 'Attack', refWatts: 293, refPct: 53.9 },
  { secs: 600, label: '10m', skill: 'Attack', refWatts: 265, refPct: 44.0 },
  { secs: 1200, label: '20m', skill: 'Attack', refWatts: 209, refPct: 24.2 },
  { secs: 1800, label: '30m', skill: 'Climb', refWatts: 203, refPct: 24.6 },
  { secs: 3600, label: '1h', skill: 'Climb', refWatts: 184, refPct: 25.8 },
  { secs: 7200, label: '2h', skill: 'Climb', refWatts: 158, refPct: 24.2 },
];

// Power Skills radar + Rider Type. Re-homed from the old main page in V2 Phase 3; the
// percentile formula and phenotype rules are the original code, unchanged. V2 Phase 6 §6.1.4:
// now fed from the app's own last-90-day power curve (Phase 5's powerCurve/bestsForRide)
// instead of the one-time intervals.icu CSV import — the old `powerCurveData` is now only a
// fallback for a duration the computed curve doesn't have yet, and is labelled as such.
export default function PowerSkillsCard() {
  const { history, powerCurveData } = useAppData();
  const [showPhenotypeModal, setShowPhenotypeModal] = useState(false);
  const [activeBar, setActiveBar] = useState(null);

  // Closest match in the old, one-time imported power curve — used only as a fallback below.
  const findOldWatts = (targetSecs) => {
    if (!(powerCurveData && powerCurveData.length > 0)) return null;
    let closest = powerCurveData[0];
    let minDiff = Math.abs(powerCurveData[0].secs - targetSecs);
    for (const point of powerCurveData) {
      const diff = Math.abs(point.secs - targetSecs);
      if (diff < minDiff) { minDiff = diff; closest = point; }
    }
    return closest.watts;
  };

  const ninetyDayCurve = useMemo(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 90);
    return powerCurve(history, { from: toLocalDateStr(from), to: toLocalDateStr(today) });
  }, [history]);

  const radarData = POWER_SKILLS.map(s => {
    const computed = ninetyDayCurve[String(s.secs)];
    let watts = computed ? computed.watts : null;
    let fromOldImport = false;
    if (watts == null) {
      watts = findOldWatts(s.secs);
      if (watts != null) fromOldImport = true;
    }
    if (watts == null) return null;
    const percentile = Math.min(100, Math.round(s.refPct * (watts / s.refWatts) * 10) / 10);
    return { label: s.label, skill: s.skill, watts, percentile, fromOldImport };
  }).filter(Boolean);

  if (radarData.length === 0) return null;

  const hasAll = radarData.length === POWER_SKILLS.length;
  const oldImportLabels = radarData.filter(d => d.fromOldImport).map(d => d.label);

  // Dynamic domain: round max percentile up to nearest 10 so polygon fills the chart
  const maxPct = Math.max(...radarData.map(d => d.percentile));
  const domainMax = Math.ceil(maxPct / 10) * 10;
  const maxWatts = Math.max(...radarData.map(d => d.watts));

  // Custom tooltip for radar
  const RadarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const d = payload[0].payload;
      const color = d.skill === 'Sprint' ? '#60A5FA' : d.skill === 'Attack' ? '#4ADE80' : '#FB923C';
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg">
          <p style={{ color }} className="font-semibold text-sm">{d.label} — {d.skill}</p>
          <p className="text-gray-300 text-sm">{d.watts}W</p>
          <p className="text-gray-400 text-xs">{ordinal(d.percentile)} percentile</p>
        </div>
      );
    }
    return null;
  };

  // --- Phenotype determination (V2 Phase 6: only when all 9 durations are known — a
  // partial radar can't reliably tell Sprint/Attack/Climb apart) ---
  let phenotype = null, phenoColor = null, phenoExplanation = null;
  let sprintAvg = null, attackAvg = null, climbAvg = null;

  if (hasAll) {
  sprintAvg = radarData.filter(d => d.skill === 'Sprint').reduce((s, d) => s + d.percentile, 0) / 3;
  attackAvg = radarData.filter(d => d.skill === 'Attack').reduce((s, d) => s + d.percentile, 0) / 3;
  climbAvg = radarData.filter(d => d.skill === 'Climb').reduce((s, d) => s + d.percentile, 0) / 3;
  const maxCat = Math.max(sprintAvg, attackAvg, climbAvg);
  const minCat = Math.min(sprintAvg, attackAvg, climbAvg);
  const spread = maxCat - minCat;

  // Short-burst dominance: weight the 5s and 30s points more heavily
  const shortBurstAvg = (radarData[0].percentile * 1.5 + radarData[1].percentile * 1.25 + radarData[2].percentile * 0.75) / 3.5;
  // Sustained power: 20m, 30m, 1h
  const sustainedAvg = (radarData.find(d => d.label === '20m').percentile + radarData.find(d => d.label === '30m').percentile + radarData.find(d => d.label === '1h').percentile) / 3;
  // Long endurance: 1h, 2h
  const enduranceAvg = (radarData.find(d => d.label === '1h').percentile + radarData.find(d => d.label === '2h').percentile) / 2;

  if (spread < 8) {
    phenotype = 'All-Rounder';
    phenoColor = '#A855F7'; // purple
    phenoExplanation = `You're an All-Rounder because your power is evenly distributed across all effort durations. Your Sprint (${sprintAvg.toFixed(0)}%), Attack (${attackAvg.toFixed(0)}%), and Climb (${climbAvg.toFixed(0)}%) scores are all within ${spread.toFixed(0)} percentage points — no single weakness, no single dominance. You can compete across varied terrain and race situations.`;
  } else if (shortBurstAvg > attackAvg && shortBurstAvg > climbAvg && sprintAvg >= attackAvg * 1.15) {
    phenotype = 'Sprinter';
    phenoColor = '#60A5FA'; // blue
    phenoExplanation = `You're a Sprinter because you excel in short, explosive efforts. Your short-burst power (5s–1m) ranks in the top ${sprintAvg.toFixed(0)}%, significantly above your Attack (${attackAvg.toFixed(0)}%) and Climb (${climbAvg.toFixed(0)}%) scores. You generate your highest relative power in efforts under 1 minute.`;
  } else if (sprintAvg > climbAvg && attackAvg > climbAvg && sprintAvg >= attackAvg * 0.9) {
    phenotype = 'Puncheur';
    phenoColor = '#4ADE80'; // green
    phenoExplanation = `You're a Puncheur because you're strong in repeated, punchy surges. Your Sprint (${sprintAvg.toFixed(0)}%) and Attack (${attackAvg.toFixed(0)}%) power are both well above your Climb endurance (${climbAvg.toFixed(0)}%). You thrive on short, steep climbs and rolling terrain where quick bursts of power make the difference.`;
  } else if (attackAvg >= sprintAvg && attackAvg >= climbAvg && sustainedAvg > enduranceAvg) {
    phenotype = 'Rouleur';
    phenoColor = '#FB923C'; // orange
    phenoExplanation = `You're a Rouleur because you're powerful and consistent over flat and rolling terrain. Your Attack power (${attackAvg.toFixed(0)}%) leads your profile, with strong 5–20 minute sustained efforts (${sustainedAvg.toFixed(0)}%). You excel at setting tempo, driving breakaways, and maintaining high power when others fade.`;
  } else if (climbAvg >= sprintAvg && sustainedAvg >= attackAvg * 0.95 && enduranceAvg > sprintAvg) {
    phenotype = 'Time Trialist';
    phenoColor = '#F472B6'; // pink
    phenoExplanation = `You're a Time Trialist because you excel at steady, sustained solo efforts. Your sustained power across 20–60 minutes (${sustainedAvg.toFixed(0)}%) and endurance (${enduranceAvg.toFixed(0)}%) are your defining strengths. You don't rely on sprints or surges — instead you maintain a smooth, controlled effort over long durations.`;
  } else if (climbAvg >= attackAvg && climbAvg > sprintAvg) {
    phenotype = 'Climber';
    phenoColor = '#FB923C'; // orange
    phenoExplanation = `You're a Climber because you thrive when the road tilts upward. Your Climb power (${climbAvg.toFixed(0)}%) leads your profile, well above Sprint (${sprintAvg.toFixed(0)}%). Your endurance at 30m–2h durations (${enduranceAvg.toFixed(0)}%) shows you can sustain high intensity on long ascents where power-to-weight matters most.`;
  } else {
    phenotype = 'All-Rounder';
    phenoColor = '#A855F7';
    phenoExplanation = `You're an All-Rounder with a balanced power profile. Sprint (${sprintAvg.toFixed(0)}%), Attack (${attackAvg.toFixed(0)}%), Climb (${climbAvg.toFixed(0)}%) — you don't have a single standout specialty, but your versatility lets you compete across different race situations and terrain types.`;
  }
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-4">
      <div className="flex justify-between items-start gap-2 mb-1">
        <h3 className="font-semibold text-base">Power Skills</h3>
        {hasAll ? (
          <button
            type="button"
            onClick={() => setShowPhenotypeModal(true)}
            className="w-1/2 min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium transition-colors text-center"
            style={{ backgroundColor: phenoColor + '22', color: phenoColor, border: `1px solid ${phenoColor}44` }}
          >
            Rider Type: {phenotype}
          </button>
        ) : (
          <span className="w-1/2 min-h-[44px] px-3 py-2 rounded-xl text-sm text-gray-400 text-center border border-gray-700 flex items-center justify-center">
            Import a ride with a sprint to see your rider type
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        <span className="text-blue-400">Sprint</span> · <span className="text-green-400">Attack</span> · <span className="text-orange-400">Climb</span>
        <span className="ml-2 text-gray-500">— vs. intervals.icu age 40</span>
      </p>
      {oldImportLabels.length > 0 && (
        <p className="text-xs text-gray-500 -mt-2 mb-3">
          {oldImportLabels.join(', ')} from old intervals.icu import.
        </p>
      )}
      <div className="flex">
        {/* Radar chart - 3/5 width */}
        <div className="w-3/5">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis
                dataKey="label"
                tick={({ x, y, payload, index }) => {
                  const d = radarData[index];
                  const color = d.skill === 'Sprint' ? '#60A5FA' : d.skill === 'Attack' ? '#4ADE80' : '#FB923C';
                  return (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={12} fontWeight="600">
                      {payload.value}
                    </text>
                  );
                }}
              />
              <PolarRadiusAxis domain={[0, domainMax]} tick={false} axisLine={false} />
              <Tooltip content={<RadarTooltip />} />
              <Radar
                dataKey="percentile"
                stroke="#A855F7"
                fill="#A855F7"
                fillOpacity={0.35}
                strokeWidth={2}
                dot={{ fill: '#A855F7', r: 3 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* Horizontal power bars - 2/5 width */}
        <div className="w-2/5 flex flex-col justify-center pl-2">
          {radarData.map((d, i) => {
            const color = d.skill === 'Sprint' ? '#60A5FA' : d.skill === 'Attack' ? '#4ADE80' : '#FB923C';
            const barPct = maxWatts > 0 ? (d.watts / maxWatts) * 100 : 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveBar(activeBar === i ? null : i)}
                aria-label={`${d.label} ${d.skill}: ${d.watts}W, ${ordinal(d.percentile)} percentile`}
                className="group relative flex items-center gap-2 min-h-[44px] w-full"
              >
                <span className="text-xs w-7 text-right shrink-0" style={{ color }}>{d.label}</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barPct}%`, backgroundColor: color }}
                  />
                </div>
                {/* Tooltip: on tap (and hover on desktop) */}
                <div className={`absolute right-0 bottom-full mb-1 z-10 ${activeBar === i ? 'block' : 'hidden group-hover:block'}`}>
                  <div className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                    <p className="font-semibold text-xs" style={{ color }}>{d.label} — {d.skill}</p>
                    <p className="text-gray-300 text-xs">{d.watts}W</p>
                    <p className="text-gray-400 text-xs">{ordinal(d.percentile)} percentile</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {hasAll && (
        <Sheet open={showPhenotypeModal} onClose={() => setShowPhenotypeModal(false)} title={`Rider Type: ${phenotype}`} closeLabel="Done">
          <p className="text-gray-300 text-base leading-relaxed mb-4">{phenoExplanation}</p>
          <div className="bg-gray-700 rounded-xl p-3 mb-4">
            <p className="text-xs text-gray-400 mb-2">Category Scores (avg percentile)</p>
            <div className="flex justify-between text-sm tabular-nums">
              <span><span className="text-blue-400">Sprint:</span> {sprintAvg.toFixed(1)}%</span>
              <span><span className="text-green-400">Attack:</span> {attackAvg.toFixed(1)}%</span>
              <span><span className="text-orange-400">Climb:</span> {climbAvg.toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-sm text-gray-500">Your rider type is determined by comparing your relative power across Sprint (5s–1m), Attack (5–20m), and Climb (30m–2h) durations. As your training evolves, your rider type may shift.</p>
        </Sheet>
      )}
    </div>
  );
}
