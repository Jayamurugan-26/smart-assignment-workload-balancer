import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar.jsx";
import LandingPage from "./components/LandingPage.jsx";
import Logo from "./components/Logo.jsx";
import DashboardStats from "./components/DashboardStats.jsx";
import AssignmentCard from "./components/AssignmentCard.jsx";
import EditAssignmentModal from "./components/EditAssignmentModal.jsx";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog.jsx";
import AssignmentDetailsModal from "./components/AssignmentDetailsModal.jsx";
import CompletedAssignmentsView from "./components/CompletedAssignmentsView.jsx";
import WorkloadHeatmap from "./components/WorkloadHeatmap.jsx";
import CalendarView from "./components/CalendarView.jsx";
import AiChatbox from "./components/AiChatbox.jsx";
import DocumentAnalysisView from "./components/DocumentAnalysisView.jsx";
import StudentProfileView from "./components/StudentProfileView.jsx";
import ProductivityInsightsView from "./components/ProductivityInsightsView.jsx";
import NotificationsPanel from "./components/NotificationsPanel.jsx";
import TermsPage from "./components/TermsPage.jsx";
import PrivacyPage from "./components/PrivacyPage.jsx";
import ToastContainer from "./components/ToastContainer.jsx";
import GoogleConnectModal from "./components/GoogleConnectModal.jsx";
import { useTheme } from "./context/ThemeContext.jsx";
import { api } from "./services/api.js";
import { getSocket } from "./services/socket.js";
import { 
  RotateCw, 
  Sparkles, 
  CheckCircle2, 
  Inbox,
  Menu,
  Bell,
  Sun,
  Moon,
  ListTodo,
  CheckCheck
} from "lucide-react";

export default function App() {
  // Centralized theme state from ThemeContext
  const { theme, setTheme, toggleTheme, isDark } = useTheme();

  // 5-second Splash / Landing state
  const [showLanding, setShowLanding] = useState(() => {
    const path = window.location.pathname;
    if (path.includes("terms") || path.includes("privacy")) return false;
    return true;
  });

  // Current navigation tab
  const [currentTab, setCurrentTab] = useState(() => {
    const path = window.location.pathname;
    if (path.includes("terms")) return "terms";
    if (path.includes("privacy")) return "privacy";
    return "dashboard";
  });

  // Mobile sidebar open state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Assignments filter in assignments tab ("active" vs "completed")
  const [assignmentSubTab, setAssignmentSubTab] = useState("active");

  // Notifications unread badge count
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // App core states
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [completedAssignments, setCompletedAssignments] = useState([]);
  const [balancerData, setBalancerData] = useState(null);
  const [courses, setCourses] = useState([]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isBalancing, setIsBalancing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deletingAssignment, setDeletingAssignment] = useState(null);
  const [detailedAssignment, setDetailedAssignment] = useState(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = (type, message, title) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initial Data Fetch
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Check for OAuth callback token in URL query params
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");
      if (urlToken) {
        localStorage.setItem("token", urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
        addToast("success", "Successfully connected Google Classroom!", "Google Authenticated");
      }

      // 2. Authenticate: try current user from token, otherwise login demo student
      let currentUser = null;
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        try {
          const res = await api.getCurrentUser();
          currentUser = res.user;
        } catch (e) {
          console.warn("Stored token expired or invalid, switching to demo", e);
          localStorage.removeItem("token");
        }
      }

      if (!currentUser) {
        const { user: demoUser, token: demoToken } = await api.loginDemo();
        currentUser = demoUser;
        localStorage.setItem("token", demoToken);
      }
      setUser(currentUser);

      // 3. Fetch statistics
      const statsData = await api.getStatistics();
      setStats(statsData);

      // 4. Fetch active assignments
      const { assignments: activeList } = await api.getAssignments("ALL");
      setAssignments(activeList.filter((a) => a.status !== "COMPLETED"));

      // 5. Fetch completed assignments
      const { assignments: doneList } = await api.getCompletedAssignments();
      setCompletedAssignments(doneList);

      // 6. Fetch workload balance
      const balanceRes = await api.calculateWorkload();
      setBalancerData(balanceRes);

      // 7. Fetch unread notifications count
      try {
        const notifsRes = await api.getNotifications();
        if (notifsRes && typeof notifsRes.unreadCount === "number") {
          setUnreadNotificationsCount(notifsRes.unreadCount);
        }
      } catch (e) {
        console.warn("Could not fetch notifications count", e);
      }

      // 8. Fetch courses
      try {
        const coursesRes = await api.getCourses();
        if (coursesRes && coursesRes.courses) {
          setCourses(coursesRes.courses);
        }
      } catch (e) {
        console.warn("Could not fetch courses", e);
      }

      // 8. Connect Socket.IO for real-time events
      if (currentUser) {
        const socket = getSocket(currentUser.id);
        
        socket.off("assignment:updated");
        socket.on("assignment:updated", ({ assignment }) => {
          setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? assignment : a)));
          if (detailedAssignment?.id === assignment.id) setDetailedAssignment(assignment);
          refreshStats();
        });

        socket.off("assignment:status_changed");
        socket.on("assignment:status_changed", ({ assignment }) => {
          if (assignment.status === "COMPLETED") {
            setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
            setCompletedAssignments((prev) => [assignment, ...prev.filter((a) => a.id !== assignment.id)]);
          } else {
            setCompletedAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
            setAssignments((prev) => [assignment, ...prev.filter((a) => a.id !== assignment.id)]);
          }
          refreshStats();
        });

        socket.off("assignment:deleted");
        socket.on("assignment:deleted", ({ assignmentId }) => {
          setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
          setCompletedAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
          refreshStats();
        });

        socket.off("notification:new");
        socket.on("notification:new", (notification) => {
          setUnreadNotificationsCount((c) => c + 1);
          addToast("info", notification.message, notification.title || "New Notification");
        });

        socket.off("productivity:updated");
        socket.on("productivity:updated", () => {
          refreshStats();
        });
      }
    } catch (err) {
      console.error("Initialization error:", err);
      addToast("error", err.message || "Failed to load coursework data", "Error");
    } finally {
      setLoading(false);
    }
  }, [detailedAssignment?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Periodic background refresh (every 60s) to keep deadline risk & remaining time current
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const { assignments: activeList } = await api.getAssignments("ALL");
        if (activeList) {
          setAssignments(activeList.filter((a) => a.status !== "COMPLETED"));
        }
      } catch (e) {
        // silent fail on background polling
      }
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const refreshStats = async () => {
    try {
      const statsData = await api.getStatistics();
      setStats(statsData);
    } catch (e) {
      console.warn("Could not refresh stats", e);
    }
  };

  // Google Classroom Sync
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncClassroom();
      addToast(
        "success", 
        `Synced ${res.syncedCount} coursework items without duplicates.`,
        "Classroom Synchronized"
      );
      // Reload lists
      const { assignments: activeList } = await api.getAssignments("ALL");
      setAssignments(activeList.filter((a) => a.status !== "COMPLETED"));

      const { assignments: doneList } = await api.getCompletedAssignments();
      setCompletedAssignments(doneList);

      refreshStats();

      const balanceRes = await api.calculateWorkload();
      setBalancerData(balanceRes);
    } catch (err) {
      addToast("error", err.message || "Failed to sync with Google Classroom", "Sync Failed");
    } finally {
      setIsSyncing(false);
    }
  };

  // Workload Balancer trigger
  const handleBalance = async () => {
    setIsBalancing(true);
    try {
      const res = await api.calculateWorkload();
      setBalancerData(res);
      addToast("success", `Smoothed deadlines into ${res.scheduledBlocksCount} balanced study blocks.`, "Workload Balanced");
    } catch (err) {
      addToast("error", err.message || "Failed to calculate workload", "Balancing Error");
    } finally {
      setIsBalancing(false);
    }
  };

  // Edit Assignment Save
  const handleEditSave = async (id, updatedFields) => {
    try {
      const res = await api.updateAssignment(id, updatedFields);
      setAssignments((prev) => prev.map((a) => (a.id === id ? res.assignment : a)));
      setCompletedAssignments((prev) => prev.map((a) => (a.id === id ? res.assignment : a)));
      if (detailedAssignment?.id === id) setDetailedAssignment(res.assignment);

      addToast("success", "Assignment details updated in your local workspace.", "Changes Saved");
      refreshStats();
    } catch (err) {
      addToast("error", err.message || "Failed to save assignment changes", "Error");
      throw err;
    }
  };

  // Mark as Done / Mark as Undone toggle
  const handleToggleStatus = async (assignment) => {
    const isCurrentlyDone = assignment.status === "COMPLETED";
    const newStatus = isCurrentlyDone ? "PENDING" : "COMPLETED";

    try {
      const res = await api.updateAssignmentStatus(assignment.id, newStatus);
      const updated = res.assignment;

      if (newStatus === "COMPLETED") {
        setAssignments((prev) => prev.filter((a) => a.id !== updated.id));
        setCompletedAssignments((prev) => [updated, ...prev.filter((a) => a.id !== updated.id)]);
        addToast("success", `Marked "${updated.title}" as completed. Great job!`, "Coursework Completed");
      } else {
        setCompletedAssignments((prev) => prev.filter((a) => a.id !== updated.id));
        setAssignments((prev) => [updated, ...prev.filter((a) => a.id !== updated.id)]);
        addToast("info", `Restored "${updated.title}" back to active workload.`, "Restored to Pending");
      }

      if (detailedAssignment?.id === updated.id) {
        setDetailedAssignment(updated);
      }

      refreshStats();

      // Recalculate balance to remove completed hours from active workload
      const balanceRes = await api.calculateWorkload();
      setBalancerData(balanceRes);
    } catch (err) {
      addToast("error", err.message || "Failed to update status", "Error");
    }
  };

  // Delete Assignment Confirm
  const handleDeleteConfirm = async (id) => {
    try {
      await api.deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setCompletedAssignments((prev) => prev.filter((a) => a.id !== id));
      if (detailedAssignment?.id === id) setDetailedAssignment(null);

      addToast("info", "Assignment removed from your dashboard. Google Classroom original remains untouched.", "Assignment Removed");
      refreshStats();

      const balanceRes = await api.calculateWorkload();
      setBalancerData(balanceRes);
    } catch (err) {
      addToast("error", err.message || "Failed to remove assignment", "Error");
    }
  };

  // Toggle Micro-task checkbox
  const handleToggleMicroTask = async (assignmentId, taskId) => {
    try {
      const res = await api.toggleMicroTask(assignmentId, taskId);
      const updatedTask = res.microTask;

      const updateList = (list) =>
        list.map((asg) => {
          if (asg.id !== assignmentId) return asg;
          return {
            ...asg,
            microTasks: (asg.microTasks || []).map((t) => (t.id === taskId ? updatedTask : t)),
          };
        });

      setAssignments(updateList);
      setCompletedAssignments(updateList);
      if (detailedAssignment?.id === assignmentId) {
        setDetailedAssignment((prev) => ({
          ...prev,
          microTasks: (prev.microTasks || []).map((t) => (t.id === taskId ? updatedTask : t)),
        }));
      }
    } catch (err) {
      addToast("error", "Failed to update microtask", "Error");
    }
  };

  // Sync individual study block to Google Calendar
  const handleSyncStudyBlock = async (assignmentId) => {
    const sb = balancerData?.dailyTimeline?.flatMap((s) => s.studyBlocks).find((b) => b.assignmentId === assignmentId);
    if (!sb) {
      addToast("info", "Study block scheduled locally.", "Calendar");
      return;
    }
    try {
      await api.syncStudyBlockToCalendar(sb.assignmentId);
      addToast("success", `Study session pushed to your primary Google Calendar!`, "Calendar Synced");
    } catch (err) {
      addToast("info", `Event saved to your academic schedule view.`, "Calendar Updated");
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    try {
      const { user: demoUser, token: demoToken } = await api.loginDemo();
      localStorage.setItem("token", demoToken);
      setUser(demoUser);
      addToast("info", "Switched to Demo Student profile.", "Signed Out");
      await loadData();
    } catch (e) {
      window.location.reload();
    }
  };

  // 1. Splash / Landing Page Display (First 5 seconds)
  if (showLanding) {
    return (
      <LandingPage
        onComplete={() => {
          setShowLanding(false);
        }}
      />
    );
  }

  // 2. Public Legal Pages (accessible directly or via navigation)
  if (currentTab === "terms") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 transition-colors">
        <TermsPage onBack={() => setCurrentTab("dashboard")} />
      </div>
    );
  }

  if (currentTab === "privacy") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 transition-colors">
        <PrivacyPage onBack={() => setCurrentTab("dashboard")} />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 transition-colors font-serif relative"
      style={{ backgroundColor: isDark ? "#0b1120" : "#f5f7fb", color: isDark ? "#f8fafc" : "#1f2937" }}
    >
      
      {/* Ambient Academic Background Mesh for Glassmorphism Depth */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-12 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/[0.05] dark:bg-blue-600/[0.08] blur-[120px] transition-colors duration-500" />
        <div className="absolute top-1/3 right-10 w-[460px] h-[460px] rounded-full bg-indigo-500/[0.04] dark:bg-purple-600/[0.07] blur-[130px] transition-colors duration-500" />
        <div className="absolute bottom-12 left-1/3 w-[520px] h-[520px] rounded-full bg-emerald-500/[0.035] dark:bg-emerald-600/[0.05] blur-[140px] transition-colors duration-500" />
      </div>

      {/* 1. Responsive Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
        unreadNotificationsCount={unreadNotificationsCount}
        onSync={handleSync}
        isSyncing={isSyncing}
        onBalance={handleBalance}
        isBalancing={isBalancing}
        onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        onSignOut={handleSignOut}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        
        {/* Desktop Top Header Bar (md and above) */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white/80 dark:bg-[#0b1120]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 transition-colors">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white capitalize">
              {currentTab === "dashboard" && "Academic Dashboard"}
              {currentTab === "assignments" && "Coursework & Assignments"}
              {currentTab === "calendar" && "Study Schedule & Calendar"}
              {currentTab === "ai-chat" && "NEXYRA AI Academic Assistant"}
              {currentTab === "document-analysis" && "Photo & Document Analysis"}
              {(currentTab === "productivity" || currentTab === "analytics") && "Productivity Insights"}
              {currentTab === "notifications" && "Academic Notifications"}
              {currentTab === "profile" && "Student Profile & Capacity"}
              {currentTab === "settings" && "System Settings"}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quick Actions */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
              title="Re-sync Google Classroom"
            >
              <RotateCw className={`w-3.5 h-3.5 text-blue-500 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync"}</span>
            </button>

            <button
              onClick={handleBalance}
              disabled={isBalancing}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1.5 shadow-sm"
              title="Run AI Workload Balancer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isBalancing ? "animate-spin" : ""}`} />
              <span>{isBalancing ? "Balancing..." : "Balance"}</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setCurrentTab("notifications")}
              className="relative p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            {/* Prominent Desktop Segmented Theme Switch */}
            <div className="p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-0.5 select-none">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-bold transition-all ${
                  theme === "light"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
                title="Switch to Light theme"
              >
                <Sun className={`w-3.5 h-3.5 ${theme === "light" ? "text-amber-500" : ""}`} />
                <span>Light</span>
              </button>
              
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-bold transition-all ${
                  theme === "dark"
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
                title="Switch to Dark theme"
              >
                <Moon className={`w-3.5 h-3.5 ${theme === "dark" ? "text-indigo-400" : ""}`} />
                <span>Dark</span>
              </button>
            </div>

            {/* Student Profile & Email Badge */}
            <button
              type="button"
              onClick={() => setCurrentTab("profile")}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition border text-left cursor-pointer group ${
                currentTab === "profile"
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20"
                  : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
              }`}
              title={`View Profile: ${user?.name || "Student"} (${user?.email || ""})`}
            >
              <div className="relative shrink-0">
                <img
                  src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                  alt={user?.name || "Student"}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";
                  }}
                  className="w-7 h-7 rounded-full object-cover border border-emerald-500/80 shadow-sm"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />
              </div>
              <div className="hidden lg:flex flex-col text-left leading-tight max-w-[200px]">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {user?.name || "Student"}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={user?.email}>
                  {user?.email || "student@university.edu"}
                </span>
              </div>
            </button>
          </div>
        </header>

        {/* Mobile Top Header (hidden on md and above) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div 
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => setCurrentTab("dashboard")}
            >
              <Logo size="xs" />
              <span className="font-bold text-sm text-slate-900 dark:text-white">Smart Balancer</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Notification Bell */}
            <button
              onClick={() => setCurrentTab("notifications")}
              className="relative p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            {/* Quick Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={theme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-600" />
              )}
            </button>

            {/* Student Avatar Button */}
            <button
              onClick={() => setCurrentTab("profile")}
              className="relative p-0.5 rounded-full border-2 border-emerald-500 hover:opacity-85 transition shrink-0"
              title={`Student: ${user?.name || "Student"} (${user?.email || ""})`}
            >
              <img
                src={user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                alt={user?.name || "Student"}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";
                }}
                className="w-7 h-7 rounded-full object-cover"
              />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center animate-pulse">
                <RotateCw className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading Smart Workload Balancer...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: DASHBOARD */}
              {currentTab === "dashboard" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  
                  {/* Real Database Statistics Cards */}
                  <DashboardStats stats={stats} />

                  {/* Workload Density & Burnout Bar Chart */}
                  <WorkloadHeatmap
                    balancerData={balancerData}
                    onBalance={handleBalance}
                    isBalancing={isBalancing}
                    onSyncStudyBlock={handleSyncStudyBlock}
                  />

                  {/* Active Assignments Card Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          Active Coursework & Deadlines
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {assignments.length} Active
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Click Subject Code or Title for detailed rubrics, Drive attachments, and AI decomposition.
                        </p>
                      </div>

                      <button
                        onClick={() => setCurrentTab("assignments")}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition"
                      >
                        View All →
                      </button>
                    </div>

                    {assignments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assignments.map((asg) => (
                          <AssignmentCard
                            key={asg.id}
                            assignment={asg}
                            onEdit={(a) => setEditingAssignment(a)}
                            onToggleStatus={handleToggleStatus}
                            onDelete={(a) => setDeletingAssignment(a)}
                            onOpenDetails={(a) => setDetailedAssignment(a)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">All Caught Up!</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                          You have completed all pending coursework. Check the Completed tab to review finished assignments or click Re-sync to pull new tasks from Google Classroom.
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 2: ASSIGNMENTS (Active + Completed) */}
              {currentTab === "assignments" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Assignments & Coursework</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Manage local parameters, inspect Classroom attachments, and balance study sessions.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Sub-tab switcher: Active vs Completed */}
                      <div className="flex items-center p-1 rounded-xl bg-slate-200 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700">
                        <button
                          onClick={() => setAssignmentSubTab("active")}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            assignmentSubTab === "active"
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <ListTodo className="w-3.5 h-3.5" />
                          <span>Active ({assignments.length})</span>
                        </button>
                        <button
                          onClick={() => setAssignmentSubTab("completed")}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            assignmentSubTab === "completed"
                              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Completed ({completedAssignments.length})</span>
                        </button>
                      </div>

                      <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition active:scale-95 shadow-sm"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-blue-500" : ""}`} />
                        <span className="hidden sm:inline">Re-sync Classroom</span>
                      </button>
                    </div>
                  </div>

                  {assignmentSubTab === "active" ? (
                    assignments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assignments.map((asg) => (
                          <AssignmentCard
                            key={asg.id}
                            assignment={asg}
                            onEdit={(a) => setEditingAssignment(a)}
                            onToggleStatus={handleToggleStatus}
                            onDelete={(a) => setDeletingAssignment(a)}
                            onOpenDetails={(a) => setDetailedAssignment(a)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
                        <Inbox className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">No Active Assignments</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">All coursework has been completed.</p>
                      </div>
                    )
                  ) : (
                    <CompletedAssignmentsView
                      completedAssignments={completedAssignments}
                      onRestore={handleToggleStatus}
                      onEdit={(a) => setEditingAssignment(a)}
                      onDelete={(a) => setDeletingAssignment(a)}
                      onOpenDetails={(a) => setDetailedAssignment(a)}
                    />
                  )}
                </div>
              )}

              {/* TAB 3: CALENDAR */}
              {currentTab === "calendar" && (
                <div className="animate-in fade-in duration-300">
                  <CalendarView onNotify={addToast} />
                </div>
              )}

              {/* TAB 4: NEXYRA AI ASSISTANT */}
              {currentTab === "ai-chat" && (
                <div className="animate-in fade-in duration-300">
                  <AiChatbox assignments={assignments} onNotify={addToast} />
                </div>
              )}

              {/* TAB 5: PHOTO / DOCUMENT ANALYSIS */}
              {currentTab === "document-analysis" && (
                <div className="animate-in fade-in duration-300">
                  <DocumentAnalysisView onNotify={addToast} />
                </div>
              )}

              {/* TAB 6: PRODUCTIVITY INSIGHTS */}
              {(currentTab === "productivity" || currentTab === "analytics") && (
                <div className="animate-in fade-in duration-300">
                  <ProductivityInsightsView
                    assignments={assignments}
                    courses={courses}
                    onNotify={addToast}
                    onOpenDetails={(a) => setDetailedAssignment(a)}
                  />
                </div>
              )}

              {/* TAB 7: NOTIFICATIONS */}
              {currentTab === "notifications" && (
                <div className="animate-in fade-in duration-300">
                  <NotificationsPanel 
                    onNotify={addToast} 
                    onNavigateTab={(tab) => setCurrentTab(tab)} 
                  />
                </div>
              )}

              {/* TAB 8 & 9: STUDENT PROFILE / SETTINGS */}
              {(currentTab === "profile" || currentTab === "settings") && (
                <div className="animate-in fade-in duration-300">
                  <StudentProfileView
                    user={user}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    onSignOut={handleSignOut}
                    onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
                    onNotify={addToast}
                    onProfileUpdated={loadData}
                  />
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* 3. APPLICATION MODALS */}
      {/* Edit Assignment Modal */}
      <EditAssignmentModal
        assignment={editingAssignment}
        isOpen={Boolean(editingAssignment)}
        onClose={() => setEditingAssignment(null)}
        onSave={handleEditSave}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        assignment={deletingAssignment}
        isOpen={Boolean(deletingAssignment)}
        onClose={() => setDeletingAssignment(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Detailed Assignment View (Includes Classroom Document access & NEXYRA analysis) */}
      <AssignmentDetailsModal
        assignment={detailedAssignment}
        isOpen={Boolean(detailedAssignment)}
        onClose={() => setDetailedAssignment(null)}
        onEdit={(a) => setEditingAssignment(a)}
        onToggleStatus={handleToggleStatus}
        onDelete={(a) => setDeletingAssignment(a)}
        onToggleMicroTask={handleToggleMicroTask}
      />

      {/* Google Classroom Connect Modal */}
      <GoogleConnectModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

    </div>
  );
}