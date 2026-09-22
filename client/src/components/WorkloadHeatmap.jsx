import React from "react";
import { 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  Calendar as CalIcon, 
  Clock, 
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";

export default function WorkloadHeatmap({ 
  balancerData, 
  onBalance, 
  isBalancing, 
  onSyncStudyBlock 
}) {
  if (!balancerData) return null;

  const { overallRisk = "LOW", dailyTimeline = [] } = balancerData;

  const riskBadge = {
    LOW: { label: "Safe Workload", bg: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" },
    MODERATE: { label: "Moderate Density", bg: "bg-amber-950/40 text-amber-400 border-amber-800/50" },
    MEDIUM: { label: "Moderate Density", bg: "bg-amber-950/40 text-amber-400 border-amber-800/50" },
    HIGH: { label: "High Burnout Risk", bg: "bg-orange-950/40 text-orange-400 border-orange-800/50" },
    CRITICAL: { label: "Critical Overload Peak", bg: "bg-rose-950/40 text-rose-400 border-rose-800/50" },
  }[overallRisk] || { label: overallRisk, bg: "bg-slate-800 text-slate-300 border-slate-700" };

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 mb-8 shadow-sm">
      
      {/* Header with Risk Meter & Balance Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Workload Density & Burnout Prevention
            </h3>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${riskBadge.bg}`}>
              {riskBadge.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ML algorithms smooth deadline peaks across your available weekly capacity.
          </p>
        </div>

        <button
          type="button"
          onClick={onBalance}
          disabled={isBalancing}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition active:scale-95 disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isBalancing ? "animate-spin" : ""}`} />
          <span>{isBalancing ? "Balancing Schedule..." : "Re-calculate Balance"}</span>
        </button>
      </div>

      {/* 14-Day Timeline Bar Chart */}
      <div className="space-y-2 mb-6">
        <div className="grid grid-cols-7 lg:grid-cols-14 gap-1.5 sm:gap-2">
          {dailyTimeline.map((slot) => {
            const dateObj = new Date(slot.date);
            const dateDisplay = format(dateObj, "MMM d");
            const dayName = format(dateObj, "EEE");

            // Ratio of allocated vs nominal capacity
            const loadRatio = slot.nominalCapacityHours > 0 
              ? Math.min(100, Math.round((slot.allocatedHours / slot.nominalCapacityHours) * 100))
              : 0;

            const barColor = slot.burnoutRisk === "CRITICAL"
              ? "bg-rose-500"
              : slot.burnoutRisk === "HIGH"
                ? "bg-orange-500"
                : slot.burnoutRisk === "MODERATE"
                  ? "bg-amber-500"
                  : "bg-blue-500";

            return (
              <div
                key={slot.date}
                className={`p-2.5 rounded-2xl border flex flex-col justify-between transition ${
                  slot.isWeekend 
                    ? "bg-slate-50 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800" 
                    : "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800/80"
                } ${slot.burnoutRisk === "CRITICAL" ? "border-rose-300 dark:border-rose-900/80 ring-1 ring-rose-500/20" : ""}`}
              >
                <div className="text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">{dayName}</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{dateDisplay.split(" ")[1]}</span>
                </div>

                {/* Vertical Gauge Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-12 my-2 relative overflow-hidden flex items-end">
                  <div 
                    className={`w-full ${barColor} rounded-b-full transition-all duration-500`}
                    style={{ height: `${Math.max(6, loadRatio)}%` }}
                  />
                </div>

                <div className="text-center">
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white block leading-none">
                    {slot.allocatedHours}h
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-500 block mt-0.5">
                    /{slot.nominalCapacityHours}h
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommended Auto-Scheduled Study Blocks */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          Optimal Balanced Study Sessions (Ready for Google Calendar)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dailyTimeline.flatMap(slot => slot.studyBlocks).slice(0, 6).map((sb, idx) => {
            const startObj = new Date(sb.startTime);
            const endObj = new Date(sb.endTime);

            return (
              <div
                key={idx}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-slate-200 truncate max-w-[200px]">{sb.title}</h5>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                    <span>{format(startObj, "EEE MMM d, h:mm a")} - {format(endObj, "h:mm a")}</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-300">({sb.durationHours}h)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSyncStudyBlock && onSyncStudyBlock(sb.assignmentId)}
                  title="Push to Google Calendar"
                  className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-[11px] font-semibold transition shrink-0"
                >
                  Sync G-Cal
                </button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}