# MedAstraX — Early Risk Detection & Personalized Care Platform

> **Hackathon Track 03 — Healthcare**
> AI-assisted platform that identifies early warning signs of critical health conditions from heterogeneous patient data and provides personalized risk assessment.

---

## 🧬 What is MedAstraX?

MedAstraX is a full-stack AI-powered healthcare platform built for the **Track 03 Healthcare** hackathon challenge. It provides early risk detection, personalized care recommendations, and a complete patient-doctor ecosystem — all in one platform.

---

## ✅ Track 03 Requirements Coverage

| Requirement | Implementation |
|---|---|
| **Patient Risk Prediction** | AI Risk Engine scores 0–100 using 15+ clinical factors (age, BP, heart rate, blood sugar, SpO2, chronic conditions) |
| **Time-Series Analysis** | Every risk assessment is timestamped and stored; trend chart shows last 30 assessments |
| **Anomaly Detection** | WHO standard reference ranges checked per vital — flags WARNING / CRITICAL anomalies |
| **Personalized Recommendations** | AI-generated care plan (medicine schedule, diet, exercise) from patient prescription history |
| **Explainable Predictions** | Factor breakdown shows every contributing factor with points, direction, and explanation |
| **Emergency-Risk Alerts** | SOS manual trigger + automatic SMS dispatch when risk score ≥ 75 |
| **Secure Patient Data** | JWT authentication, OTP verification, role-based access control |
| **Hard Mode: Missing Data** | Confidence % drops gracefully with incomplete vitals; score is dampened accordingly |
| **Hard Mode: Prediction Confidence** | Model confidence % displayed prominently alongside every risk score |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Java 17, Spring Boot 3.2, Spring Security (JWT), JPA / Hibernate |
| **Frontend** | React 18, Vite, Framer Motion, Vanilla CSS |
| **Database** | PostgreSQL (production) / H2 (local) |
| **AI / ML** | HuggingFace API — MedGemma-27B-IT (primary), Gemma-3-27B (fallback) |
| **SMS / Voice Alerts** | Twilio |
| **Hosting** | Render |

---

## 🔑 Core Features

### 1. 🧬 AI Risk Intelligence Engine
- Numeric risk score (0–100) computed from vitals + medical history
- Anomaly detection against WHO reference ranges
- Explainability panel — every factor explained with contribution points
- Time-series trend chart across all past assessments
- Auto SMS emergency alert when risk is critical

### 2. 🤖 Astra AI Medical Assistant
- Powered by MedGemma-27B (Google's medical LLM)
- Multi-turn conversation with full context memory
- Structured symptom assessment → differential → triage
- Language mirroring — English, Hindi, Hinglish
- Offline fallback with heuristic responses

### 3. 🏥 Hospital & Doctor Ecosystem
- Search, filter, and sort hospitals by city, rating, distance, price
- Book offline / online (video) consultations
- Reschedule, cancel, and follow-up booking management

### 4. 💊 Prescription & Pharmacy System
- Digital prescriptions issued by doctors
- Patients order medicines directly from registered pharmacies
- AI care plan generated from active prescription history

### 5. 🚨 Emergency & SOS System
- One-tap SOS dispatches ambulance + SMS + voice call to emergency contact
- Live ambulance tracking link sent automatically
- Proactive risk-triggered alerts (no manual button needed)

### 6. 🏆 Gamification & Rewards
- Daily health checklist (medicines, diet, exercise) earns EXP points
- Health badges unlock discounts and free consultations
- Patient leaderboard

### 7. 🔬 AI Clinical Scribe
- Doctor launches scribe in consultation room
- Web Speech API captures live dialogue
- Auto-generates structured clinical report (complaints, prescription, red flags)

### 8. 🧪 Diagnostics & Lab Integration
- Patients book diagnostic tests from registered labs
- Lab uploads reports directly to patient health records
- AI compares previous vs current reports for recovery tracking

### 9. 📊 Observability & Background Jobs
- Real-time system latency metrics
- Background job queue with retry support
- Step-by-step human-approval workflow engine

---

## 🗂️ Project Structure

```
medastrax_healthcare-main/
├── backend/                          # Spring Boot Application
│   └── src/main/java/com/mediverse/
│       ├── controller/               # REST Controllers (22 files)
│       │   ├── RiskAssessmentController.java   ← NEW (Risk Engine API)
│       │   ├── AiController.java               ← AI Chat, Care Plan, Reports
│       │   ├── EmergencyController.java         ← SOS + Proactive Alerts
│       │   └── ...
│       ├── service/                  # Business Logic (19 files)
│       │   ├── RiskAssessmentService.java       ← NEW (Risk Scoring Engine)
│       │   └── ...
│       ├── model/                    # JPA Entities
│       │   ├── RiskAssessment.java              ← NEW (Time-series storage)
│       │   └── ...
│       └── repository/               # Spring Data Repositories
│           ├── RiskAssessmentRepository.java    ← NEW
│           └── ...
│
└── frontend/                         # React + Vite Application
    └── src/
        ├── pages/
        │   └── patient/
        │       ├── RiskDashboardPage.jsx        ← NEW (Full Risk UI)
        │       ├── PatientDashboard.jsx         ← Risk Widget added
        │       └── ...
        └── services/
            └── api.js                           ← riskAPI added
```

---

## ⚙️ Local Development Setup

### Prerequisites
- Java 17+
- Maven 3.8+
- Node.js 18+

### Backend Setup

```bash
cd backend
```

Create `src/main/resources/application-secret.properties` with:

```properties
spring.datasource.url=jdbc:h2:mem:medastrax
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=

app.huggingface.token=YOUR_HUGGINGFACE_TOKEN
app.jwt.secret=your_jwt_secret_key_here

twilio.account.sid=YOUR_TWILIO_SID
twilio.auth.token=YOUR_TWILIO_TOKEN
twilio.phone.number=+1XXXXXXXXXX
```

Run the backend:

```bash
mvn spring-boot:run
```

Backend starts at: `http://localhost:8083`

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at: `http://localhost:5173`

---

## 🔗 Key API Endpoints

### Risk Engine (NEW)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/risk/assess` | Run full risk assessment (all vitals optional) |
| GET | `/api/risk/history` | Time-series history (last 30 assessments) |
| GET | `/api/risk/latest` | Latest risk summary for dashboard widget |

### AI Engine
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/chat` | Multi-turn medical AI assistant |
| POST | `/api/ai/analyze-reports` | Analyze patient prescriptions + lab data |
| POST | `/api/ai/care-plan` | Generate personalized care plan |
| POST | `/api/ai/analyze-body-symptoms` | Body map symptom analysis |

### Emergency
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sos` | Trigger manual SOS alert |

---

## 👥 User Roles

| Role | Access |
|---|---|
| **Patient** | Dashboard, Risk Engine, Book appointments, Order medicines, Emergency SOS |
| **Doctor** | Manage schedule, Write prescriptions, AI Scribe, Video consultations |
| **Hospital** | Manage doctors, view bookings, bed availability |
| **Pharmacy** | Receive orders, manage medicine pricing |
| **Lab** | Manage diagnostic bookings, upload reports |
| **Admin** | Full system observability, broadcast messages |

---

## 🔐 Security Architecture

- **JWT Tokens** — stateless authentication on every request
- **OTP Verification** — phone/email OTP before account activation
- **Role-Based Access** — Spring Security method-level and route-level protection
- **HTTPS** — enforced in production via Render
- **No sensitive data in logs** — patient data never logged

---

*Built for Hackathon Track 03 — Healthcare | Early Risk Detection & Personalized Care Platform*
