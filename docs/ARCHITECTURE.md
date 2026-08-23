# SchedulAI Architecture & System Design

## 1. System Overview

SchedulAI is an enterprise-grade AI Timetable Generator & Academic Resource Optimization Platform designed for universities and higher education institutions. The architecture follows a microservices / monorepo design pattern separating core application logic, database orchestration, mathematical constraint optimization, and responsive frontend interaction.

```
+-----------------------------------------------------------------------------------+
|                                Client Web Browser                                 |
|         (React 18 + Vite + TanStack Query + Tailwind CSS + Lucide Icons)          |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ HTTP / REST
+-----------------------------------------------------------------------------------+
|                           Node.js Express Gateway (API)                          |
|  - JWT Authentication & RBAC (Admin, Teacher, Staff, Viewer)                     |
|  - Zod Request Validation & Error Interceptor                                     |
|  - Immutable Audit Logging Middleware                                             |
|  - Bulk Excel / CSV Ingestion Engine & Column Normalizer                         |
|  - Natural Language AI Preference Parsing & Conflict Explainer                    |
|  - Multi-format Export Generator (Excel, CSV, PDF HTML)                           |
+------------------------------------+----------------------------------------------+
                                     │
                   ┌─────────────────┴─────────────────┐
                   ▼                                   ▼
+-----------------------------------+ +---------------------------------------------+
|        MongoDB Database           | |    Python FastAPI Scheduler Microservice    |
| - 11 Mongoose Schemas with        | | - Google OR-Tools CP-SAT Solver             |
|   Compound Unique Indexes         | | - Hard & Soft Constraint Formulations       |
| - Departments, Teachers, Subjects | | - Interactive Move Validator                |
|   Classrooms, Semesters, Slots    | | - Weighted Fallback Suggestion Engine       |
| - Audit Logs & Import Jobs        | | - Microsecond Health & Diagnostic Metrics   |
+-----------------------------------+ +---------------------------------------------+
```

---

## 2. Optimization Model & Solver Formulation

The scheduling engine is powered by **Google OR-Tools CP-SAT (Constraint Programming - Satisfiability)**.

### Mathematical Representation

Let:
- $T$ = Set of teaching assignments (Faculty $f$, Subject $s$, Semester $m$, Period count $p$).
- $S$ = Set of active time slots (Day $d$, Period index $k$).
- $C$ = Set of classrooms (Capacity $cap_c$, Type $type_c$).

We define boolean decision variables:
$$X_{t, s, c} \in \{0, 1\} \quad \forall t \in T, s \in S, c \in C$$
Where $X_{t, s, c} = 1$ if assignment $t$ is scheduled at time slot $s$ in classroom $c$, and $0$ otherwise.

### Hard Constraints (Satisfiability: Must Never Be Violated)

1. **Exact Allocation**: Each assignment $t$ must be scheduled exactly for its required periods:
   $$\sum_{s \in S} \sum_{c \in C} X_{t, s, c} = \text{periodsPerWeek}(t)$$

2. **Teacher Non-Clashing**: A teacher $f$ cannot teach more than one class at any time slot $s$:
   $$\forall f, \forall s \in S: \quad \sum_{t \in T_f} \sum_{c \in C} X_{t, s, c} \le 1$$

3. **Classroom Non-Clashing**: A classroom $c$ cannot host more than one class at any time slot $s$:
   $$\forall c, \forall s \in S: \quad \sum_{t \in T} X_{t, s, c} \le 1$$

4. **Semester Cohort Non-Clashing**: A student semester group $m$ cannot attend more than one lecture at any time slot $s$:
   $$\forall m, \forall s \in S: \quad \sum_{t \in T_m} \sum_{c \in C} X_{t, s, c} \le 1$$

5. **Teacher Availability & Blackouts**: If teacher $f$ is unavailable at slot $s$, no assignment of $f$ can be scheduled:
   $$X_{t, s, c} = 0 \quad \forall t \in T_f, s \in \text{UnavailableSlots}(f), \forall c$$

6. **Classroom Capacity**: A room $c$ cannot host a cohort larger than its capacity:
   $$X_{t, s, c} = 0 \quad \text{if } \text{studentCount}(m_t) > \text{capacity}(c)$$

7. **Lab / Facility Compatibility**: Practical lab subjects requiring specialized equipment must be assigned to matching lab rooms:
   $$X_{t, s, c} = 0 \quad \text{if } \text{isLab}(s_t) \neq \text{isLab}(c)$$

8. **Daily Teacher Workload Limits**: Teacher $f$ cannot exceed $\text{maxClassesPerDay}(f)$:
   $$\forall f, \forall d \in \text{Days}: \quad \sum_{s \in S_d} \sum_{t \in T_f} \sum_{c \in C} X_{t, s, c} \le \text{maxClassesPerDay}(f)$$

### Soft Constraints (Weighted Objective Function Maximization)

The solver maximizes an objective function $Z = \sum w_i \cdot \text{Score}_i$:
- **Teacher Gap Minimization ($w=6$)**: Minimizes idle gaps between classes on the same day.
- **Morning Load Balancing ($w=5$)**: Distributes difficult subjects across morning periods.
- **Teacher Preferred Slots ($w=7$)**: Incentivizes placement in teacher-selected preferred hours.
- **Student Workload Distribution ($w=6$)**: Limits exhausting streaks of 4+ consecutive lectures.
- **Classroom Continuity ($w=4$)**: Keeps faculty in the same block/building when teaching consecutive hours.

---

## 3. Microservices & Directory Structure

```
SchedulAI/
├── apps/
│   ├── api/                  # Express.js REST API service
│   │   ├── src/
│   │   │   ├── config/       # Environment variables & MongoDB connection
│   │   │   ├── middleware/   # Auth (JWT), RBAC, Zod, Audit, Rate limiting
│   │   │   ├── models/       # 11 Mongoose schema definitions & indexes
│   │   │   ├── modules/      # Domain controllers & services (Auth, Timetable, AI, Import, Export)
│   │   │   └── utils/        # Logger, API response helpers, Scheduler client
│   │   └── tests/            # Vitest unit & integration test suites
│   └── web/                  # Vite + React + Tailwind CSS client
│       ├── src/
│       │   ├── api/          # Axios client & TanStack Query service hooks
│       │   ├── components/   # Layout, Sidebar, Navbar, Drag-Drop Grid, UI elements
│       │   ├── context/      # AuthContext & Session management
│       │   ├── pages/        # 12 interactive responsive management views
│       │   └── types/        # Client UI state definitions
│       └── tests/            # Vitest React Testing Library suites
├── packages/
│   ├── shared-types/         # Shared TypeScript DTOs and database models
│   ├── config/               # Roles, default constraints, period definitions
│   └── validation/           # Zod validation schemas for all entities
├── services/
│   └── scheduler/            # Python FastAPI OR-Tools scheduling microservice
│       ├── app/
│       │   ├── core/         # FastAPI config and server setup
│       │   ├── models/       # Pydantic v2 schemas for solver requests
│       │   └── solver/       # CP-SAT constraint engine, move validator, suggestion ranker
│       └── tests/            # Pytest test suite for solver algorithms
└── docs/                     # Architectural, deployment, and API documentation
```

---

## 4. Security & Compliance

- **Role-Based Access Control (RBAC)**: Fine-grained access matrix across `ADMIN`, `TEACHER`, `STAFF`, and `VIEWER`.
- **Immutable Audit Trail**: All mutations, deletions, bulk imports, and timetable generations record actor ID, IP address, user agent, entity type, and before/after diffs.
- **Input Sanitization & Validation**: 100% of incoming payloads pass through strict Zod schemas with type-safe error boundaries.
- **JWT & Token Refresh**: Industry-standard cryptographic JWT signing with short-lived access tokens and secure rotation tokens.
