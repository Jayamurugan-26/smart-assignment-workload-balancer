import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, Clock, Calendar, ShieldCheck, Tag, Flame } from "lucide-react";
import { format } from "date-fns";
import { calculateClientRisk, RISK_THEMES } from "../utils/riskUtils.js";

export default function EditAssignmentModal({ assignment, isOpen, onClose, onSave }) {
  if (!isOpen || !assignment) return null;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    dueTime: "23:59",
    difficulty: 3,
    estimatedMinutes: 180,
    priority: "MEDIUM",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (assignment) {
      const d = new Date(assignment.dueDate);
      const dateString = !isNaN(d.getTime()) ? format(d, "yyyy-MM-dd") : "";
      
      setFormData({
        title: assignment.title || "",
        description: assignment.description || "",
        dueDate: dateString,
        dueTime: assignment.dueTime || "23:59",
        difficulty: assignment.difficulty || 3,
        estimatedMinutes: assignment.estimatedMinutes || 180,
        priority: assignment.priority || "MEDIUM",
        notes: assignment.notes || "",
      });
      setError(null);
    }
  }, [assignment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(assignment.id, {
        ...formData,
        difficulty: parseInt(formData.difficulty, 10),
        estimatedMinutes: parseInt(formData.estimatedMinutes, 10),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const liveRisk = calculateClientRisk({
    dueDate: formData.dueDate,
    dueTime: formData.dueTime,
    estimatedMinutes: formData.estimatedMinutes,
    difficulty: formData.difficulty,
    priority: formData.priority,
    status: assignment.status
  });
  const liveTheme = RISK_THEMES[liveRisk.riskLevel] || RISK_THEMES.LOW;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Edit Local Assignment
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {assignment.course?.code || "Subject"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize deadlines, priority, and workload estimates</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational banner: local vs classroom */}
        <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/40 px-6 py-2.5 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
          <ShieldCheck className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
          <p>
            <strong>Local Customization:</strong> Updates saved here adjust your personal workload schedule and dashboard. Your teacher's original Google Classroom coursework is never modified.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Assignment Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description / Instructions</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition leading-relaxed"
              placeholder="Add personal notes or instructions..."
            />
          </div>

          {/* Due Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                Due Time
              </label>
              <input
                type="time"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Priority & Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Difficulty (1 Easy - 5 Hard)</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="1">1 - Very Simple</option>
                <option value="2">2 - Easy</option>
                <option value="3">3 - Moderate</option>
                <option value="4">4 - Challenging</option>
                <option value="5">5 - Hard / Complex</option>
              </select>
            </div>
          </div>

          {/* Estimated Workload Minutes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Estimated Completion Time: {+(formData.estimatedMinutes / 60).toFixed(1)} hours ({formData.estimatedMinutes} mins)
            </label>
            <input
              type="range"
              min="30"
              max="720"
              step="30"
              value={formData.estimatedMinutes}
              onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              <span>30m</span>
              <span>3h</span>
              <span>6h</span>
              <span>12h</span>
            </div>
          </div>

          {/* Live Calculated Risk Preview */}
          <div className={`p-3 rounded-2xl border transition-all ${
            liveRisk.riskLevel === "CRITICAL"
              ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200"
              : liveRisk.riskLevel === "HIGH"
                ? "bg-orange-50/80 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40 text-orange-800 dark:text-orange-200"
                : liveRisk.riskLevel === "MEDIUM"
                  ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-200"
                  : "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200"
          }`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                Live Deadline Risk Preview
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${liveTheme.badge}`}>
                {liveRisk.riskLevel} • {liveRisk.riskScore}%
              </span>
            </div>
            <p className="text-xs leading-relaxed opacity-95">
              {liveRisk.reason}
            </p>
          </div>

          {/* Personal Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Personal Strategy Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
              placeholder="e.g., Focus on section 3 first..."
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 transition active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Saving Changes..." : "Save Changes"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}