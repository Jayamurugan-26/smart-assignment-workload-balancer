const BACKEND_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const API_BASE = `${BACKEND_URL}/api`;

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  const headers = { ...getHeaders(), ...(options.headers || {}) };
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.details || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // Auth
  getGoogleAuthUrl: () => request("/auth/google/url"),
  loginDemo: () => request("/auth/demo", { method: "POST" }),
  getCurrentUser: () => request("/auth/me"),
  updateCapacity: (weekdayCapacity, weekendCapacity) =>
    request("/auth/capacity", {
      method: "PUT",
      body: JSON.stringify({ weekdayCapacity, weekendCapacity }),
    }),

  // Student Profile & Academic Details
  getStudentProfile: () => request("/profile"),
  updateStudentProfile: (payload) =>
    request("/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Assignments
  getAssignments: (status = "ALL") => request(`/assignments?status=${status}`),
  getCompletedAssignments: () => request("/assignments/completed"),
  getAssignmentDetails: (id) => request(`/assignments/${id}`),
  updateAssignment: (id, payload) =>
    request(`/assignments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  updateAssignmentStatus: (id, status, actualMinutes) =>
    request(`/assignments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, actualMinutes }),
    }),
  deleteAssignment: (id) =>
    request(`/assignments/${id}`, {
      method: "DELETE",
    }),
  toggleMicroTask: (assignmentId, taskId) =>
    request(`/assignments/${assignmentId}/microtasks/${taskId}/toggle`, {
      method: "POST",
    }),

  // Google Classroom & Calendar
  syncClassroom: () => request("/classroom/sync", { method: "POST" }),
  getCourses: () => request("/classroom/courses"),
  getCalendarEvents: (start, end) =>
    request(`/calendar/events?start=${encodeURIComponent(start || "")}&end=${encodeURIComponent(end || "")}`),
  syncStudyBlockToCalendar: (blockId) =>
    request(`/calendar/sync-block/${blockId}`, { method: "POST" }),

  // Workload Balancer & Statistics
  getStatistics: () => request("/balancer/statistics"),
  calculateWorkload: () => request("/balancer/calculate", { method: "POST" }),

  // NEXYRA AI Chatbox
  getChatHistory: () => request("/ai/chat/history"),
  getAiHealth: () => request("/ai/health"),
  sendChatMessage: (payload) =>
    request("/ai/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  clearChatHistory: () =>
    request("/ai/chat/history", {
      method: "DELETE",
    }),

  // Document & Photo Analysis
  uploadAndAnalyzeDocument: (formData) =>
    request("/documents/upload-analyze", {
      method: "POST",
      body: formData,
    }),
  analyzeAttachment: (payload) =>
    request("/documents/analyze-attachment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Analysis Session History
  getAnalysisHistory: () => request("/analysis-history"),
  getAnalysisSession: (id) => request(`/analysis-history/${id}`),
  deleteAnalysisHistory: (id) =>
    request(`/analysis-history/${id}`, {
      method: "DELETE",
    }),

  // Notifications
  getNotifications: () => request("/notifications"),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, {
      method: "PATCH",
    }),
  markAllNotificationsRead: () =>
    request("/notifications/read-all", {
      method: "POST",
    }),
  deleteNotification: (id) =>
    request(`/notifications/${id}`, {
      method: "DELETE",
    }),

  // NEXYRA AI Decomposition
  decomposeAssignment: (id) => request(`/ai/decompose/${id}`, { method: "POST" }),

  // Productivity Insights Analytics
  getProductivityInsights: (params = {}) => {
    const query = new URLSearchParams();
    if (params.preset) query.set("preset", params.preset);
    if (params.startDate) query.set("startDate", params.startDate);
    if (params.endDate) query.set("endDate", params.endDate);
    const qs = query.toString();
    return request(`/analytics/productivity${qs ? `?${qs}` : ""}`);
  },

  // Study Sessions & Focus Timer
  getActiveStudySession: () => request("/study-sessions/active"),
  startStudySession: (payload = {}) =>
    request("/study-sessions/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  pauseStudySession: (id) =>
    request(`/study-sessions/${id}/pause`, {
      method: "POST",
    }),
  resumeStudySession: (id) =>
    request(`/study-sessions/${id}/resume`, {
      method: "POST",
    }),
  endStudySession: (id) =>
    request(`/study-sessions/${id}/end`, {
      method: "POST",
    }),
  cancelStudySession: (id) =>
    request(`/study-sessions/${id}/cancel`, {
      method: "POST",
    }),
};