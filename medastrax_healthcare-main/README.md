# MedAstraX Healthcare Platform

MedAstraX is a modern, premium healthcare management platform featuring patient workflows, digital prescriptions, activity histories, health record centers, and advanced clinician tools.

### 🌐 Live Production Deployment
- **Frontend App URL:** [https://medastrax-healthcare-1.onrender.com/](https://medastrax-healthcare-1.onrender.com/)

---

## Technical Architecture & Stack

- **Backend:** Java Spring Boot 3.2.x, Spring Security (JWT authentication), JPA/Hibernate.
- **Frontend:** React JS, Vite, Framer Motion, Vanilla CSS.
- **Database:** PostgreSQL (production) / H2 (local development).
- **Hosting Platform:** Render.

---

## Key Features

1. **Hospitals & Clinicians Center:** Patient dashboard for searching hospital directories, rating clinicians, booking offline/online consultations, and rescheduling/canceling appointments.
2. **Follow-up Visit Scheduler:** Book follow-up consultations dynamically based on doctor schedules and view upcoming slots marked with distinct badges.
3. **Health Records & AI Recommendations Center:** Visual dashboard for clinical summaries, clinician notes, and downloadable PDF reports.
4. **Persistent Prescription History:** Accumulate and display complete history logs of current and past prescriptions.
5. **Interactive Workflows & Observability:** Real-time background tasks monitor, step-by-step workflow orchestrations with human approval modals, and detailed system latency observability metrics.

---

## Local Development Setup

### Running Backend (Spring Boot)
1. Navigate to `/backend` directory.
2. Setup environment variables in `application-secret.properties`.
3. Run the application:
   ```bash
   mvn spring-boot:run
   ```

### Running Frontend (Vite)
1. Navigate to `/frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run local dev server:
   ```bash
   npm run dev
   ```
