import axios from 'axios';

// figure out base URL based on environment
const BASE_URL = import.meta.env.VITE_API_URL ||
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8083/api'
    : 'https://mediverse-ke9x.onrender.com/api');

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// attach JWT to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('medastrax_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthRoute = url.includes('/auth/login') ||
                        url.includes('/auth/google-login') ||
                        url.includes('/auth/signup');

    const status = error.response?.status;
    if ((status === 401 || status === 403) && !isAuthRoute) {
      localStorage.removeItem('medastrax_token');
      localStorage.removeItem('medastrax_user');
      localStorage.removeItem('medastrax_active_profile');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (email) => api.post('/auth/google-login', { email }),
  updateAvatar: (avatarUrl) => api.put('/auth/profile/avatar', { avatarUrl }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  verifyUpi: (upiId) => api.get(`/auth/verify-upi?upiId=${upiId}`),
  resetPassword: (email, newPassword) => api.post('/auth/reset-password', { email, newPassword }),
  verifyLicense: (licenseNo) => api.get(`/auth/verify-license?licenseNo=${licenseNo}`),
  verifyPharmacyLicense: (licenseNo) => api.get(`/auth/verify-pharmacy-license?licenseNo=${licenseNo}`),
  verifyLabLicense: (licenseNo) => api.get(`/auth/verify-lab-license?licenseNo=${licenseNo}`),
  getPatientProfileForDoctor: (patientId) => api.get(`/auth/patient/${patientId}`),
  getDoctors: () => api.get('/auth/doctors'),
  getPatients: () => api.get('/auth/patients'),
  getBookings: () => api.get('/auth/bookings'),
  getOrders: () => api.get('/auth/orders'),
  getLabBookings: () => api.get('/auth/lab-bookings'),
};

export const otpAPI = {
  sendOtp: (identifier, type) => api.post('/auth/otp/send', { identifier, type }),
  verifyOtp: (identifier, type, otp) => api.post('/auth/otp/verify', { identifier, type, otp }),
  checkStatus: (identifier, type) => api.get(`/auth/otp/status?identifier=${identifier}&type=${type}`),
};

export const hospitalAPI = {
  getAll: () => api.get('/hospitals'),
  getById: (id) => api.get(`/hospitals/${id}`),
  search: (query) => api.get(`/hospitals/search?query=${query}`),
  getByDoctor: (doctorId) => api.get(`/hospitals/doctor/${doctorId}`),
  create: (data) => api.post('/hospitals', data),
  update: (id, data) => api.put(`/hospitals/${id}`, data),
  updateBeds: (id, beds) => api.put(`/hospitals/${id}/beds?availableBeds=${beds}`),
  getDoctors: (id) => api.get(`/hospitals/${id}/doctors`),
  verify: (id, verified) => api.put(`/hospitals/${id}/verify?verified=${verified}`),
};

export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  getPatientBookings: (familyMemberId) =>
    api.get(`/bookings/patient${familyMemberId ? `?familyMemberId=${familyMemberId}` : ''}`),
  getDoctorBookings: () => api.get('/bookings/doctor'),
  getById: (id) => api.get(`/bookings/${id}`),
  updateStatus: (id, status) => api.put(`/bookings/${id}/status?status=${status}`),
  getAvailableSlots: (doctorId, date) => api.get(`/bookings/slots?doctorId=${doctorId}&date=${date}`),
  updateMeetingLink: (id, meetingLink) =>
    api.put(`/bookings/${id}/meeting-link?meetingLink=${encodeURIComponent(meetingLink)}`),
  updateAiReport: (id, aiReport) => api.put(`/bookings/${id}/ai-report`, { aiReport }),
  reschedule: (id, date, timeSlot) =>
    api.put(`/bookings/${id}/reschedule?date=${date}&timeSlot=${encodeURIComponent(timeSlot)}`),
  updateFollowUp: (id, data) => api.put(`/bookings/${id}/follow-up`, data),
  getRoleRecords: (role, status) => api.get(`/bookings/role-records?role=${role}${status ? `&status=${status}` : ''}`),
};

export const prescriptionAPI = {
  create: (data) => api.post('/prescriptions', data),
  getPatientPrescriptions: (familyMemberId) =>
    api.get(`/prescriptions/patient${familyMemberId ? `?familyMemberId=${familyMemberId}` : ''}`),
  getDoctorPrescriptions: () => api.get('/prescriptions/doctor'),
  getById: (id) => api.get(`/prescriptions/${id}`),
  analyze: (id) => api.get(`/prescriptions/${id}/analyze`),
  analyzeRaw: (data) => api.post('/prescriptions/analyze-raw', data),
  analyzeReportDocument: (data) => api.post('/prescriptions/analyze-document', data),
  getPharmacyQueue: () => api.get('/prescriptions/pharmacy-queue'),
  uploadReport: (id, reportUrl) => api.put(`/prescriptions/${id}/upload-report`, { reportUrl }),
};

export const familyMemberAPI = {
  add: (data) => api.post('/family-members', data),
  getAll: () => api.get('/family-members'),
  delete: (id) => api.delete(`/family-members/${id}`),
};

export const pharmacyAPI = {
  setPrices: (data) => api.post('/pharmacy/prices', data),
  getMedicines: () => api.get('/pharmacy/medicines'),
  getForPrescription: (prescriptionId) => api.get(`/pharmacy/prescription/${prescriptionId}`),
  getAll: () => api.get('/pharmacy/all'),
  updateProfile: (data) => api.put('/pharmacy/profile', data),
  createOrder: (data) => api.post('/orders', data),
  getOrdersForPharmacy: (pharmacyName) =>
    api.get(`/orders/pharmacy?pharmacyName=${encodeURIComponent(pharmacyName)}`),
  updateOrderStatus: (orderId, status) => api.put(`/orders/${orderId}/status`, { status }),
};

export const labAPI = {
  getAll: () => api.get('/labs/all'),
  createBooking: (data) => api.post('/labs/bookings', data),
  getPatientBookings: () => api.get('/labs/bookings/patient'),
  updateBookingStatus: (id, status) => api.put(`/labs/bookings/${id}/status`, { status }),
  getLabBookings: () => api.get('/labs/bookings/lab'),
};

export const paymentAPI = {
  createOrder: (data) => api.post('/payments/order', data),
  verifyPayment: (data) => api.post('/payments/verify', data),
};

export const notificationAPI = {
  getNotifications: ({ role, userId } = {}) => {
    const parts = [];
    if (role) parts.push(`role=${encodeURIComponent(role)}`);
    if (userId) parts.push(`userId=${encodeURIComponent(userId)}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    return api.get(`/notifications${qs}`);
  }
};

export const fileAPI = {
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const aiAPI = {
  chat: (message, sessionId) => api.post('/ai/chat', { message, sessionId }),
  resetChat: (sessionId) => api.post('/ai/chat/reset', { sessionId }),
  queryChat: (message, sessionId) => api.post('/ai/query-chat', { message, sessionId }),
  resetQueryChat: (sessionId) => api.post('/ai/query-chat/reset', { sessionId }),
  analyzeConsultation: (transcript, patientName, doctorName) =>
    api.post('/ai/analyze-consultation', { transcript, patientName, doctorName }),
  getCarePlan: () => api.get('/ai/care-plan'),
  compareReports: (previousReport, currentReport) =>
    api.post('/ai/compare-reports', { previousReport, currentReport }),
  analyzePatientReports: () => api.post('/ai/analyze-reports'),
  analyzeBodySymptoms: (data) => api.post('/ai/analyze-body-symptoms', data),
  assessSkinCare: (data) => api.post('/ai/skin-assessment', data),
};

export const rewardsAPI = {
  updateChecklist: (data) => api.post('/rewards/checklist', data),
  getLeaderboard: () => api.get('/rewards/leaderboard'),
};

export const emergencyAPI = {
  triggerSOS: (data) => api.post('/sos', data),
};

export const activityAPI = {
  getHistory: (page = 0, size = 20, type = 'ALL') =>
    api.get(`/activity?page=${page}&size=${size}&type=${type}`),
  getRecent: () => api.get('/activity/recent'),
};

export const jobsAPI = {
  submit: (jobType, input) => api.post('/jobs/submit', { jobType, input }),
  getJobs: (page = 0, size = 10) => api.get(`/jobs?page=${page}&size=${size}`),
  retryJob: (jobId) => api.post(`/jobs/${jobId}/retry`),
};

export const observabilityAPI = {
  getRuns: (page = 0, size = 20) => api.get(`/observability/runs?page=${page}&size=${size}`),
  getStats: () => api.get('/observability/stats'),
};

export const workflowAPI = {
  start: (workflowType, data) => api.post('/workflows/start', { workflowType, ...data }),
  getWorkflows: (page = 0, size = 10) => api.get(`/workflows?page=${page}&size=${size}`),
  approveStep: (workflowId, stepIndex) => api.post(`/workflows/${workflowId}/approve/${stepIndex}`),
  rejectStep: (workflowId, stepIndex, reason) =>
    api.post(`/workflows/${workflowId}/reject/${stepIndex}`, { reason }),
  getPendingCount: () => api.get('/workflows/pending-count'),
};

export default api;
