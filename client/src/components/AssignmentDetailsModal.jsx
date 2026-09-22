import React, { useState } from "react";
import { 
  X, 
  CheckCircle2, 
  RotateCcw, 
  Edit3, 
  Trash2, 
  Calendar, 
  Clock, 
  FileText, 
  Sparkles, 
  ExternalLink, 
  AlertTriangle,
  BookOpen,
  CheckSquare,
  Square,
  Paperclip,
  Flame,
  ShieldCheck,
  Tag
} from "lucide-react";
import { format } from "date-fns";
import { api } from "../services/api";
import { 
  getResolvedRisk, 
  RISK_THEMES, 
  formatTimeRemaining, 
  combineDueDateTime 
} from "../utils/riskUtils.js";

export default function AssignmentDetailsModal({ 
  assignment, 
  isOpen, 
  onClose, 
  onEdit, 
  onToggleStatus, 
  onDelete,
  onToggleMicroTask
}) {
  if (!isOpen || !assignment) return null;

  const [activeTab, setActiveTab] = useState("overview"); // overview, ai, attachments
  const [analyzingDoc, setAnalyzingDoc] = useState(null);
  const [docAnalysisResults, setDocAnalysisResults] = useState({});

  const isCompleted = assignment.status === "COMPLETED";
  const risk = getResolvedRisk(assignment);
  const dueDateObj = combineDueDateTime(assignment.dueDate, assignment.dueTime) || new Date(assignment.dueDate);
  const riskTheme = RISK_THEMES[risk.riskLevel] || RISK_THEMES.LOW;

  // Parse AI Analysis if stringified
  let aiData = null;
  if (assignment.aiAnalysis) {
    try {
      aiData = typeof assignment.aiAnalysis === "string" 
        ? JSON.parse(assignment.aiAnalysis) 
        : assignment.aiAnalysis;
    } catch (e) {
      console.warn("Could not parse aiAnalysis", e);
    }
  }

  // Parse Drive Attachments
  let attachments = [];
  if (assignment.driveAttachments) {
    try {
      attachments = typeof assignment.driveAttachments === "string"
        ? JSON.parse(assignment.driveAttachments)
        : assignment.driveAttachments;
    } catch (e) {
      console.warn("Could not parse driveAttachments", e);
    }
  }

  const subjectCode = assignment.course?.code || "COURSE";
  const subjectName = assignment.course?.name || "Subject Name";

  const handleAnalyzeDoc = async (att) => {
    setAnalyzingDoc(att.name);
    try {
      const res = await api.analyzeAttachment({
        assignmentId: assignment.id,
        attachmentName: att.name,
        mimeType: att.mimeType,
        extractedText: att.extractedText,
      });
      setDocAnalysisResults((prev) => ({
        ...prev,
        [att.name]: res.analysis,
      }));
    } catch (err) {
      alert("Document analysis failed: " + err.message);
    } finally {
      setAnalyzingDoc(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-start justify-between">
          <div className="pr-4">
            <div className="flex items-center flex-wrap gap-2 mb-1.5">
              <span className="font-extrabold text-xs px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                {subjectCode}
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {subjectName}
              </span>
              {assignment.isLocallyEdited && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                  Locally Modified
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {assignment.title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-100/50 dark:bg-slate-950/40 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "overview"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "ai"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Strategy
          </button>
          <button
            onClick={() => setActiveTab("attachments")}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "attachments"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            Classroom Documents ({attachments.length})
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Due Date & Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1">Due Date</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    {format(dueDateObj, "MMM dd, yyyy")}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1">Target Time</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {assignment.dueTime || "23:59"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1">Estimated Load</span>
                  <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    {+(assignment.estimatedMinutes / 60).toFixed(1)}h ({assignment.estimatedMinutes}m)
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1">Difficulty & Risk</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white">{assignment.difficulty}/5</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${riskTheme.badge}`}>
                      {risk.riskLevel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dedicated Deadline Risk & Urgency Analysis Card */}
              <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                risk.isOverdue || risk.riskLevel === "CRITICAL"
                  ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                  : risk.riskLevel === "HIGH"
                    ? "bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60"
              }`}>
                {/* Header: Title & Score Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg border ${riskTheme.badge}`}>
                      <Flame className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Deadline Risk Assessment
                      </h4>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {risk.isOverdue ? "Overdue deadline" : `${formatTimeRemaining(risk.remainingMinutes, risk.isOverdue)} until submission target`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-1 rounded-lg border ${riskTheme.badge}`}>
                      <span className={`w-2 h-2 rounded-full ${riskTheme.dot} ${risk.riskLevel === "CRITICAL" ? "animate-ping" : ""}`} />
                      {risk.riskLevel} • {risk.riskScore}/100
                    </span>
                  </div>
                </div>

                {/* Score Progress Bar */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <span>Risk Index</span>
                    <span>{risk.riskScore}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700/70 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${riskTheme.bar}`} 
                      style={{ width: `${Math.min(100, Math.max(5, risk.riskScore))}%` }}
                    />
                  </div>
                </div>

                {/* Dynamic "Why this risk?" explanation box */}
                <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
                  risk.riskLevel === "CRITICAL"
                    ? "bg-rose-100/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-200"
                    : risk.riskLevel === "HIGH"
                      ? "bg-orange-100/60 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/40 text-orange-800 dark:text-orange-200"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                    risk.riskLevel === "CRITICAL" ? "text-rose-600 dark:text-rose-400 animate-bounce" : "text-amber-500"
                  }`} />
                  <div>
                    <strong className="font-semibold block mb-0.5">Why this risk level?</strong>
                    <span>{risk.reason}</span>
                  </div>
                </div>

                {/* Quick 3-point Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/50 text-center">
                  <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Time Left</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {risk.isOverdue ? "0h (Passed)" : `${risk.remainingHours}h`}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Estimated Work</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {+(risk.estimatedCompletionMinutes / 60).toFixed(1)}h
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Load vs Time</span>
                    <span className={`text-xs font-bold ${
                      risk.isOverdue || risk.estimatedCompletionMinutes > risk.remainingMinutes
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {risk.isOverdue 
                        ? "Deficit" 
                        : risk.remainingMinutes > 0 
                          ? `${Math.round((risk.estimatedCompletionMinutes / risk.remainingMinutes) * 100)}%` 
                          : "100%"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructions & Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Description / Instructions
                </h4>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                  {assignment.description || "No specific instructions provided in Google Classroom."}
                </div>
              </div>

              {/* Personal Notes */}
              {assignment.notes && (
                <div>
                  <h4 className="text-xs font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                    Your Personal Notes
                  </h4>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                    {assignment.notes}
                  </div>
                </div>
              )}

              {/* Micro-tasks checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                    Decomposed Micro-Tasks ({assignment.microTasks?.filter(t => t.completed).length || 0} / {assignment.microTasks?.length || 0})
                  </h4>
                </div>

                <div className="space-y-2">
                  {assignment.microTasks && assignment.microTasks.length > 0 ? (
                    assignment.microTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => onToggleMicroTask && onToggleMicroTask(assignment.id, task.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                          task.completed 
                            ? "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-400" 
                            : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {task.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className={`text-xs font-medium ${task.completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                            {task.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {task.durationMinutes}m
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                      No micro-tasks generated yet. Use the NEXYRA AI tab to generate steps!
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: NEXYRA AI STRATEGY */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block mb-1">
                  AI Assessment Summary
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {aiData?.summary || "AI evaluation ready. Click Run Balancer on dashboard to refresh."}
                </p>
              </div>

              {aiData?.keyFocusAreas && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Key Focus Areas
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {aiData.keyFocusAreas.map((area, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiData?.tips && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl text-xs text-blue-800 dark:text-blue-200">
                  <span className="font-bold">Strategy Tip: </span>
                  {aiData.tips}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLASSROOM MATERIALS & DOCUMENTS */}
          {activeTab === "attachments" && (
            <div className="space-y-4">
              {attachments.length > 0 ? (
                attachments.map((att, idx) => {
                  const analysis = docAnalysisResults[att.name];
                  const isCurrentAnalyzing = analyzingDoc === att.name;

                  return (
                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">{att.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {att.mimeType || "Document"} • Google Classroom Source
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {att.url && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition flex items-center gap-1"
                            >
                              <span>Open / View</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAnalyzeDoc(att)}
                            disabled={isCurrentAnalyzing}
                            className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isCurrentAnalyzing ? "animate-spin" : ""}`} />
                            <span>{isCurrentAnalyzing ? "Analyzing..." : "Analyze with NEXYRA"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Text preview if present */}
                      {att.extractedText && !analysis && (
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-mono leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {att.extractedText}
                        </div>
                      )}

                      {/* Structured NEXYRA Analysis Results if generated */}
                      {analysis && (
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-500/30 space-y-3 animate-in fade-in">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>NEXYRA Analysis: {att.name}</span>
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            {analysis.summary}
                          </p>

                          {analysis.importantPoints && (
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Important Requirements</span>
                              <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                                {analysis.importantPoints.slice(0, 3).map((pt, i) => (
                                  <li key={i}>• {pt}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {analysis.suggestedApproach && (
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                              <strong>Suggested Approach: </strong>{analysis.suggestedApproach}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                  No documents or attachments are available for this assignment.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Actions: Edit, Mark as Done/Undone, Delete */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-between flex-wrap gap-2">
          
          <div className="flex items-center gap-2">
            {/* Delete button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(assignment);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Edit button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(assignment);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition active:scale-95 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>Edit Details</span>
            </button>

            {/* Mark as Done / Undone button */}
            <button
              type="button"
              onClick={() => {
                onToggleStatus(assignment);
                onClose();
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 shadow-md ${
                isCompleted
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
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
          </div>

        </div>

      </div>
    </div>
  );
}