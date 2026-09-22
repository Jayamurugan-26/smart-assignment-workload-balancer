import React, { useState, useRef, useEffect } from "react";
import { 
  MoreVertical, 
  CheckCircle2, 
  RotateCcw, 
  Edit3, 
  Trash2, 
  Clock, 
  Calendar, 
  AlertCircle, 
  Flame, 
  FileText,
  Sparkles,
  ExternalLink,
  Tag
} from "lucide-react";
import { format } from "date-fns";
import { 
  getResolvedRisk, 
  RISK_THEMES, 
  formatTimeRemaining, 
  combineDueDateTime 
} from "../utils/riskUtils.js";

export default function AssignmentCard({ 
  assignment, 
  onEdit, 
  onToggleStatus, 
  onDelete, 
  onOpenDetails,
  isLoadingStatus = false
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const isCompleted = assignment.status === "COMPLETED";
  const risk = getResolvedRisk(assignment);
  const isOverdue = !isCompleted && (assignment.isOverdue !== undefined ? assignment.isOverdue : risk.isOverdue);
  const dueDateObj = combineDueDateTime(assignment.dueDate, assignment.dueTime) || new Date(assignment.dueDate);
  const currentRiskTheme = RISK_THEMES[risk.riskLevel] || RISK_THEMES.LOW;

  const priorityColors = {
    LOW: "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    MEDIUM: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60",
    HIGH: "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
    URGENT: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
  };

  const subjectCode = assignment.course?.code || "COURSE";
  const subjectName = assignment.course?.name || "Academic Subject";

  return (
    <div className={`relative glass-card rounded-2xl p-4 sm:p-5 group flex flex-col justify-between transition-all ${
      isCompleted 
        ? "border-emerald-500/40 dark:border-emerald-500/30 opacity-90" 
        : isOverdue || risk.riskLevel === "CRITICAL"
          ? "border-rose-500/60 dark:border-rose-500/50 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/20" 
          : risk.riskLevel === "HIGH"
            ? "border-orange-400/50 dark:border-orange-500/40 shadow-sm"
            : ""
    }`}>
      
      {/* Top Header: Subject Code, Subject Name & Action Menu */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          
          {/* Subject Badge: Clickable to view details */}
          <button
            type="button"
            onClick={() => onOpenDetails(assignment)}
            title="Click to view assignment & course details"
            className="text-left group/sub inline-flex items-center flex-wrap gap-1.5 cursor-pointer rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/60 py-0.5 px-1.5 -ml-1.5 transition"
          >
            <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover/sub:border-blue-500">
              {subjectCode}
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover/sub:text-blue-600 dark:group-hover/sub:text-blue-400 transition truncate max-w-[180px] sm:max-w-[260px]">
              {subjectName}
            </span>
          </button>

          {/* Action Menu (⋮) */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              aria-label="Assignment actions menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 z-40 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(assignment);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  Edit Details
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleStatus(assignment);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                >
                  {isCompleted ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Mark as Undone
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Mark as Done
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenDetails(assignment);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  View Full Details
                </button>

                <div className="my-1 border-t border-slate-200 dark:border-slate-700/70"></div>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(assignment);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  Delete Assignment
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Assignment Title */}
        <h3 
          onClick={() => onOpenDetails(assignment)}
          className={`font-bold text-base leading-snug cursor-pointer transition line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 ${
            isCompleted 
              ? "text-slate-400 dark:text-slate-500 line-through" 
              : "text-slate-900 dark:text-white"
          }`}
        >
          {assignment.title}
        </h3>

        {/* Local Edits indicator badge */}
        {assignment.isLocallyEdited && (
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded px-1.5 py-0.5 mt-1.5">
            <Tag className="w-2.5 h-2.5" />
            Locally edited
          </div>
        )}

        {/* Description snippet */}
        {assignment.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
            {assignment.description}
          </p>
        )}
      </div>

      {/* Middle/Bottom Metadata & Badges */}
      <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/70">
        
        {/* Due Date & Time */}
        <div className="flex items-center justify-between text-xs mb-2.5">
          <div className={`flex items-center gap-1.5 font-medium ${
            isCompleted 
              ? "text-slate-400 dark:text-slate-500" 
              : isOverdue 
                ? "text-rose-600 dark:text-rose-400 font-semibold" 
                : "text-slate-700 dark:text-slate-300"
          }`}>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {format(dueDateObj, "MMM d, yyyy")}
              {assignment.dueTime ? ` at ${assignment.dueTime}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isCompleted && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                isOverdue 
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold animate-pulse" 
                  : risk.riskLevel === "CRITICAL"
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-medium"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {formatTimeRemaining(risk.remainingMinutes, isOverdue)}
              </span>
            )}
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{+(assignment.estimatedMinutes / 60).toFixed(1)}h</span>
            </div>
          </div>
        </div>

        {/* Badges: Priority & Risk & Status */}
        <div className="flex items-center flex-wrap gap-1.5 mb-2.5">
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${priorityColors[assignment.priority] || priorityColors.MEDIUM}`}>
            {assignment.priority}
          </span>

          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${currentRiskTheme.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${currentRiskTheme.dot} ${risk.riskLevel === "CRITICAL" ? "animate-ping" : ""}`} />
            Risk: {risk.riskLevel} • {risk.riskScore}%
          </span>

          {/* Status Badge */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            isCompleted
              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
              : assignment.status === "IN_PROGRESS"
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
          }`}>
            {assignment.status.replace("_", " ")}
          </span>
        </div>

        {/* "Why this risk?" Explanation Banner */}
        {risk.reason && !isCompleted && (
          <div 
            title={risk.reason}
            className={`mb-2.5 px-2.5 py-1.5 rounded-xl text-[11px] leading-snug flex items-center gap-1.5 border transition-all ${
              risk.riskLevel === "CRITICAL" 
                ? "bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/40"
                : risk.riskLevel === "HIGH"
                  ? "bg-orange-50/80 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-900/40"
                  : risk.riskLevel === "MEDIUM"
                    ? "bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/30"
                    : "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-800/60"
            }`}
          >
            <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${risk.riskLevel === 'CRITICAL' ? 'text-rose-500 animate-pulse' : risk.riskLevel === 'HIGH' ? 'text-orange-500' : 'text-slate-400'}`} />
            <span className="truncate">{risk.reason}</span>
          </div>
        )}

        {/* Bottom Actions: [Mark as Done] button + Quick Info */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={isLoadingStatus}
            onClick={() => onToggleStatus(assignment)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${
              isCompleted
                ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-slate-300 dark:border-slate-700"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
            }`}
          >
            {isCompleted ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mark as Undone</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark as Done</span>
              </>
            )}
          </button>

          {/* Edit Shortcut */}
          <button
            type="button"
            onClick={() => onEdit(assignment)}
            title="Edit local assignment"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition active:scale-95"
          >
            <Edit3 className="w-4 h-4 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" />
          </button>
        </div>

      </div>

    </div>
  );
}