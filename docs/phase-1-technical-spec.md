<<<<<<< HEAD
# DrivX Phase 1: Technical Specification

**Version:** 1.0  
**Status:** In Development  
**Last Updated:** May 2026  
**License:** MIT

---

## Overview

This document specifies the technical architecture, algorithms, and data flows for DrivX Phase 1 — the foundation layer that collects driving behavior data, computes Safety Scores, and stores verified trip records. Phase 1 operates without any blockchain or token mechanics visible to the user.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Drive Detection Algorithm](#drive-detection-algorithm)
3. [Trip Recording](#trip-recording)
4. [Scoring Algorithm](#scoring-algorithm)
5. [Data Validation & Anomaly Detection](#data-validation--anomaly-detection)
6. [Offline-First Architecture](#offline-first-architecture)
7. [Privacy & Data Handling](#privacy--data-handling)
8. [API Specification](#api-specification)
9. [Database Schema](#database-schema)
10. [Testing Strategy](#testing-strategy)

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│              MOBILE CLIENT                       │
│  React Native + Expo                            │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Drive   │  │   Trip   │  │  Local   │     │
│  │ Detector │→ │ Recorder │→ │ Storage  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│       ↑                           │             │
│  Accelerometer                    │ Sync        │
│  Gyroscope                        ↓             │
│  GPS                        ┌──────────┐       │
│                             │   Sync   │       │
│                             │Controller│       │
│                             └──────────┘       │
└───────────────────────────────────┼─────────────┘
                                    │ HTTPS
                                    ↓
┌─────────────────────────────────────────────────┐
│              BACKEND                             │
│  Node.js + Express                              │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   Trip   │  │ Scoring  │  │   API    │     │
│  │Verifier  │→ │  Engine  │→ │ Gateway  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│       │              │                          │
│       ↓              ↓                          │
│  ┌──────────┐  ┌──────────┐                    │
│  │  Object  │  │PostgreSQL│                    │
│  │ Storage  │  │          │                    │
│  └──────────┘  └──────────┘                    │
└─────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Mobile Client | React Native, Expo | Sensor access, drive detection, trip recording, local storage |
| API Gateway | Express.js | Authentication, rate limiting, request routing |
| Trip Verifier | Node.js service | Validates GPS integrity, detects anomalies, rejects invalid trips |
| Scoring Engine | Node.js service | Computes per-trip scores, updates rolling Safety Score |
| PostgreSQL | v15+ | Trip records, driver profiles, score history |
| Object Storage | S3-compatible | Encrypted raw GPS coordinate data |
| Redis | v7+ | Session cache, rate limiting counters |

---

## Drive Detection Algorithm

### Objective

Automatically detect when the user is driving a vehicle, without manual intervention, with ≥95% accuracy distinguishing driving from walking, cycling, and public transit.

### Sensor Inputs

| Sensor | Sample Rate | Purpose |
|--------|-------------|---------|
| Accelerometer | 10 Hz | Motion classification, braking/acceleration events |
| Gyroscope | 10 Hz | Cornering detection, rotation patterns |
| GPS | 1 Hz (active), 0.1 Hz (monitoring) | Velocity, route, distance |

### Detection State Machine

```
                    ┌─────────┐
                    │  IDLE   │
                    └────┬────┘
                         │ velocity > 15 km/h for 30s
                         ↓
                    ┌─────────┐
                    │DETECTING│
                    └────┬────┘
                         │ motion pattern = driving
                         ↓
                    ┌─────────┐
              ┌─────│ DRIVING │
              │     └────┬────┘
              │          │ stationary > 2 min
              │          ↓
              │     ┌─────────┐
              │     │ ENDING  │
              │     └────┬────┘
              │          │ confirm or timeout
              │          ↓
              │     ┌─────────┐
              └─────│  IDLE   │
                    └─────────┘
```

### State Transitions

| From | To | Condition |
|------|----|-----------|
| IDLE | DETECTING | GPS velocity > 15 km/h sustained for 30 seconds |
| DETECTING | DRIVING | Motion classifier confirms driving pattern (not transit/cycling) |
| DETECTING | IDLE | Velocity drops below 15 km/h before confirmation |
| DRIVING | ENDING | Vehicle stationary (velocity < 3 km/h) for > 2 minutes |
| ENDING | IDLE | Trip finalized and submitted |

### Motion Classification

The classifier distinguishes driving from other transport modes using:

```
Feature vector per 10-second window:
- mean_acceleration_magnitude
- std_acceleration_magnitude  
- mean_gyro_rotation_rate
- max_lateral_acceleration
- velocity_variance
- heading_change_rate
```

**Decision rules:**
- **Driving:** High velocity variance, moderate acceleration, low rotation rate, heading changes consistent with road geometry
- **Public transit:** High velocity, very low acceleration variance (smooth), stops at fixed intervals
- **Cycling:** Lower velocity (< 30 km/h typical), high gyro rotation, rhythmic acceleration
- **Walking:** Low velocity (< 7 km/h), high step-frequency in accelerometer

### Passenger Detection

When driving is detected, a secondary heuristic determines if the user is likely the driver or a passenger:

```
Indicators of DRIVER:
- Phone mounted (stable orientation, minimal rotation)
- Acceleration correlates with vehicle motion (same axis)
- Phone on left side of vehicle (driver side in LHD countries)

Indicators of PASSENGER:
- Phone in hand (frequent orientation changes)
- Acceleration axis misaligned with vehicle motion
- Phone on right side of vehicle
```

If confidence < 70% that user is driver → prompt confirmation within 10 minutes of trip end. Discard if unconfirmed after 24 hours.

### Battery Optimization

| State | GPS Rate | Sensor Rate | Target Battery |
|-------|----------|-------------|----------------|
| IDLE | 0.1 Hz (significant location changes only) | Motion coprocessor only | < 1%/hr |
| DETECTING | 1 Hz | 10 Hz | ~3%/hr |
| DRIVING | 1 Hz (0.1 Hz = every 10s for recording) | 10 Hz | < 5%/hr |

**Key optimizations:**
- Use motion coprocessor (CMMotionActivityManager / Activity Recognition API) for IDLE state — near-zero battery
- GPS activates only after motion coprocessor signals automotive activity
- Batch sensor readings in memory, write to disk every 60 seconds
- Network requests batched (sync on trip end, not during)

---

## Trip Recording

### Data Captured Per Trip

| Data Point | Sample Rate | Storage |
|-----------|-------------|---------|
| GPS coordinates (lat, lng, altitude) | Every 10 seconds | Object storage (encrypted) |
| Speed (from GPS) | Every 10 seconds | Trip record |
| Accelerometer (x, y, z) | 10 Hz, aggregated to events | Trip record (events only) |
| Gyroscope (x, y, z) | 10 Hz, aggregated to events | Trip record (events only) |
| Screen state (on/off) | Event-based | Trip record |
| Timestamp | Per reading | All |

### Trip Record Structure

```json
{
  "tripId": "uuid-v4",
  "driverId": "uuid-v4",
  "startTime": 1717200000,
  "endTime": 1717203600,
  "durationSeconds": 3600,
  "distanceKm": 42.5,
  "category": "commute",
  "coordinates": [
    { "lat": 12.9716, "lng": 77.5946, "alt": 920, "speed": 45.2, "ts": 1717200000 },
    { "lat": 12.9718, "lng": 77.5950, "alt": 920, "speed": 47.1, "ts": 1717200010 }
  ],
  "events": {
    "harshBraking": [{ "ts": 1717201200, "magnitude": 0.52, "durationMs": 1200 }],
    "harshAcceleration": [{ "ts": 1717201800, "magnitude": 0.35, "durationMs": 2100 }],
    "harshCornering": [{ "ts": 1717202400, "lateralG": 0.38, "durationMs": 800 }],
    "phoneUsage": [{ "tsStart": 1717202000, "tsEnd": 1717202015, "speedAtEvent": 52.3 }]
  },
  "gpsGaps": [{ "tsStart": 1717202500, "tsEnd": 1717202580, "durationSeconds": 80 }],
  "metadata": {
    "deviceModel": "iPhone 14",
    "osVersion": "iOS 17.4",
    "appVersion": "1.0.0",
    "passengerConfirmed": false
  }
}
```

---

## Scoring Algorithm

### Per-Trip Score

Each trip produces a score S ∈ [0, 1000] computed as a weighted sum of six factors:

```
S = 0.25 × F_speed + 0.20 × F_braking + 0.15 × F_accel + 0.15 × F_cornering + 0.15 × F_phone + 0.10 × F_time
```

### Factor Computation

#### F_speed (Speed Compliance) — Weight: 25%

```
For each GPS reading:
  overspeed_ratio = max(0, (actual_speed - posted_limit) / posted_limit)

F_speed = 1000 × (1 - mean(overspeed_ratios))
Clamped to [0, 1000]
```

Posted speed limits sourced from OpenStreetMap / map API based on GPS coordinates.

#### F_braking (Braking Smoothness) — Weight: 20%

```
harsh_braking_events = count of deceleration events > 0.4g
events_per_km = harsh_braking_events / distance_km

F_braking = 1000 × max(0, 1 - (events_per_km / 2.0))
```

Threshold: > 0.4g longitudinal deceleration sustained for > 500ms.

#### F_accel (Acceleration Patterns) — Weight: 15%

```
harsh_accel_events = count of acceleration events > 0.3g sustained > 2s
events_per_km = harsh_accel_events / distance_km

F_accel = 1000 × max(0, 1 - (events_per_km / 1.5))
```

#### F_cornering (Cornering Safety) — Weight: 15%

```
harsh_corner_events = count of lateral g-force events > 0.3g
events_per_km = harsh_corner_events / distance_km

F_cornering = 1000 × max(0, 1 - (events_per_km / 1.0))
```

#### F_phone (Phone Usage Avoidance) — Weight: 15%

```
phone_usage_seconds = total seconds screen was on while speed > 5 km/h
trip_duration_seconds = total trip duration

F_phone = 1000 × max(0, 1 - (phone_usage_seconds / (trip_duration_seconds × 0.05)))
```

Any phone interaction while moving penalizes. 5% threshold = if phone used for more than 5% of trip time, score approaches 0.

#### F_time (Time-of-Day Risk) — Weight: 10%

```
If trip occurs between 00:00–05:00:
  F_time = 700  (higher risk period, capped score)
Else:
  F_time = 1000
```

### Aggregate Safety Score (Rolling Average)

The overall Safety Score uses exponential decay over the most recent N trips (N = min(total_trips, 100)):

```
λ = 0.97 (decay factor)

S_aggregate = Σ(i=1..N) [λ^(N-i) × S_i] / Σ(i=1..N) [λ^(N-i)]
```

More recent trips have higher weight. A driver's score reflects their current behavior, not historical averages.

### Score Status

| Condition | Status |
|-----------|--------|
| < 10 trips OR < 100 km total | Provisional |
| ≥ 10 trips AND ≥ 100 km total | Verified |

### Grade Mapping

| Score Range | Grade |
|-------------|-------|
| 900–1000 | A |
| 750–899 | B |
| 600–749 | C |
| 400–599 | D |
| 0–399 | F |

---

## Data Validation & Anomaly Detection

### Rejection Criteria

A trip record is rejected if ANY of the following are true:

| Check | Threshold | Action |
|-------|-----------|--------|
| Speed exceeds physical limit | > 250 km/h at any reading | Reject entire trip |
| GPS teleportation | > 5 km between consecutive 10-second readings | Reject entire trip |
| Duration too short | < 60 seconds | Discard (not a real trip) |
| Distance too short | < 0.5 km | Discard |
| Timestamp anomaly | Non-monotonic timestamps | Reject |
| Future timestamps | Any timestamp > server time + 5 minutes | Reject |

### GPS Gap Handling

| Gap Duration | Action |
|-------------|--------|
| < 60 seconds | Interpolate, include in scoring |
| 60–300 seconds | Mark segment as unverified, exclude from scoring |
| > 300 seconds | Split into two separate trips |

### Unverified Distance Calculation

```
verified_distance = total_distance - Σ(unverified_segment_distances)
```

Only verified distance counts toward the 100 km threshold and scoring.

---

## Offline-First Architecture

### Local Storage

| Item | Storage | Limit |
|------|---------|-------|
| Pending trips | SQLite | 50 trips max |
| GPS coordinates (current trip) | In-memory → SQLite on trip end | Unlimited during trip |
| Score cache | SQLite | Latest score + last 10 trips |
| Auth tokens | Secure Keychain / Keystore | 1 token |

### Sync Strategy

```
On trip end:
  1. Save trip to local SQLite
  2. Attempt immediate upload
  3. If network unavailable → queue for later

On network restored:
  1. Upload oldest pending trip first (FIFO)
  2. Wait for server confirmation
  3. Delete local copy on success
  4. Continue until queue empty

On app foreground:
  1. Check pending trip count
  2. If > 0 and network available → sync
```

### Conflict Resolution

- Server is source of truth for Safety Score
- If local score differs from server after sync → overwrite local with server value
- Duplicate trip submissions (same tripId) are idempotent on server

---

## Privacy & Data Handling

### Data Classification

| Data | Sensitivity | Storage | Encryption |
|------|-------------|---------|------------|
| Raw GPS coordinates | High | Object storage | AES-256, driver-specific key |
| Trip scores & events | Medium | PostgreSQL | At-rest encryption |
| Email, phone | High (PII) | PostgreSQL | Column-level encryption |
| Safety Score | Low (public by design) | PostgreSQL + on-chain (Phase 2) | None (intentionally public) |
| Device info | Low | PostgreSQL | At-rest encryption |

### Data Retention

| Data | Retention | Deletion |
|------|-----------|----------|
| Raw GPS | Until driver requests deletion | Within 30 days of request |
| Trip records | Indefinite (needed for scoring) | Anonymized on deletion request |
| PII (email, phone) | Until account deletion | Within 30 days |
| Score history | Indefinite | Anonymized on deletion request |

### Phase 1 Privacy Guarantees

- No data shared with third parties in Phase 1
- No on-chain writes in Phase 1 (all data is off-chain)
- GPS data encrypted at rest with per-driver key
- Driver can export all data (GDPR compliance) within 72 hours
- Driver can delete account and all associated data within 30 days

---

## API Specification

### Base URL

```
https://api.drivx.xyz/v1  (placeholder)
```

### Authentication

JWT-based. Token issued on login, 30-minute expiry, refresh token for renewal.

### Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register with email + phone |
| POST | `/auth/login` | Login, receive JWT |
| POST | `/auth/refresh` | Refresh expired token |
| POST | `/trips/submit` | Submit a completed trip record |
| GET | `/trips/history` | Get paginated trip history |
| GET | `/trips/:tripId` | Get single trip detail |
| GET | `/score` | Get current Safety Score + breakdown |
| GET | `/score/history` | Get score trend (monthly averages) |
| GET | `/profile` | Get driver profile |
| PUT | `/profile` | Update profile (language, preferences) |

### Rate Limits

| Tier | Limit |
|------|-------|
| Unauthenticated | 20 req / 15 min |
| Authenticated (driver) | 200 req / 15 min |
| Trip submission | 10 req / min (prevents spam) |

### Error Responses

```json
{
  "error": "TRIP_REJECTED",
  "code": "ANOMALY_SPEED_EXCEEDED",
  "message": "Trip contains speed readings exceeding 250 km/h",
  "details": { "maxSpeedDetected": 312.4, "threshold": 250 }
}
```

---

## Database Schema

### Core Tables (Phase 1)

```sql
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    safety_score INTEGER DEFAULT 0 CHECK (safety_score >= 0 AND safety_score <= 1000),
    score_status VARCHAR(20) DEFAULT 'Provisional',
    total_trips INTEGER DEFAULT 0,
    total_kilometers DECIMAL(12, 2) DEFAULT 0,
    preferred_language VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trip_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    distance_km DECIMAL(8, 2) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    category VARCHAR(20) DEFAULT 'commute',
    trip_score INTEGER CHECK (trip_score >= 0 AND trip_score <= 1000),
    grade CHAR(1) CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
    speed_compliance_score INTEGER,
    braking_score INTEGER,
    acceleration_score INTEGER,
    cornering_score INTEGER,
    phone_avoidance_score INTEGER,
    time_risk_score INTEGER,
    gps_data_ref VARCHAR(255),
    verification_status VARCHAR(20) DEFAULT 'verified',
    rejection_reason TEXT,
    unverified_segments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trips_driver ON trip_records(driver_id, created_at DESC);
CREATE INDEX idx_score_history ON score_history(driver_id, recorded_at DESC);
CREATE INDEX idx_drivers_email ON drivers(email);
```

---

## Testing Strategy

### Unit Tests

| Component | Framework | Coverage Target |
|-----------|-----------|-----------------|
| Scoring algorithm | Jest | 100% of scoring logic |
| Anomaly detection | Jest | All rejection criteria |
| Drive detection state machine | Jest | All state transitions |
| API route handlers | Jest + Supertest | All endpoints |

### Property-Based Tests

Using [fast-check](https://github.com/dubzzz/fast-check):

| Property | Description |
|----------|-------------|
| Score bounds | For any valid trip data, score ∈ [0, 1000] |
| Weight sum | Factor weights always sum to 1.0 |
| Rolling average bounds | Aggregate score ∈ [0, 1000] for any trip sequence |
| Anomaly detection | Trips with speed > 250 always rejected |
| GPS gap exclusion | Gaps > 60s always excluded from scoring |
| Monotonic decay | More recent trips always weighted higher |

### Integration Tests

| Test | Description |
|------|-------------|
| Trip submission flow | Submit trip → verify → score → update aggregate |
| Offline sync | Record trips offline → restore connection → verify sync |
| Rejection flow | Submit invalid trip → verify rejection → no score change |
| Score progression | Submit 10 trips → verify status changes to "Verified" |

### Mobile Tests

| Test | Framework | Focus |
|------|-----------|-------|
| Drive detection | Detox / Jest | State machine transitions with mocked sensors |
| Battery usage | Manual profiling | Verify < 5% per hour in background |
| Offline storage | Jest | Verify 50-trip limit, FIFO sync |

---

## Open Questions (Phase 1)

- [ ] Speed limit data source: OpenStreetMap vs. commercial API (accuracy tradeoff)
- [ ] Passenger detection accuracy: acceptable false-positive rate?
- [ ] Minimum trip frequency before score decays (inactive driver handling)
- [ ] Device attestation in Phase 1 or defer to Phase 5 (Sybil resistance)?

---

*This specification is open source under the MIT License. Contributions welcome.*
=======
# DrivX Phase 1: Technical Specification

**Version:** 1.0  
**Status:** In Development  
**Last Updated:** May 2026  
**License:** MIT

---

## Overview

This document specifies the technical architecture, algorithms, and data flows for DrivX Phase 1 — the foundation layer that collects driving behavior data, computes Safety Scores, and stores verified trip records. Phase 1 operates without any blockchain or token mechanics visible to the user.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Drive Detection Algorithm](#drive-detection-algorithm)
3. [Trip Recording](#trip-recording)
4. [Scoring Algorithm](#scoring-algorithm)
5. [Data Validation & Anomaly Detection](#data-validation--anomaly-detection)
6. [Offline-First Architecture](#offline-first-architecture)
7. [Privacy & Data Handling](#privacy--data-handling)
8. [API Specification](#api-specification)
9. [Database Schema](#database-schema)
10. [Testing Strategy](#testing-strategy)

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│              MOBILE CLIENT                       │
│  React Native + Expo                            │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Drive   │  │   Trip   │  │  Local   │     │
│  │ Detector │→ │ Recorder │→ │ Storage  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│       ↑                           │             │
│  Accelerometer                    │ Sync        │
│  Gyroscope                        ↓             │
│  GPS                        ┌──────────┐       │
│                             │   Sync   │       │
│                             │Controller│       │
│                             └──────────┘       │
└───────────────────────────────────┼─────────────┘
                                    │ HTTPS
                                    ↓
┌─────────────────────────────────────────────────┐
│              BACKEND                             │
│  Node.js + Express                              │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   Trip   │  │ Scoring  │  │   API    │     │
│  │Verifier  │→ │  Engine  │→ │ Gateway  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│       │              │                          │
│       ↓              ↓                          │
│  ┌──────────┐  ┌──────────┐                    │
│  │  Object  │  │PostgreSQL│                    │
│  │ Storage  │  │          │                    │
│  └──────────┘  └──────────┘                    │
└─────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Mobile Client | React Native, Expo | Sensor access, drive detection, trip recording, local storage |
| API Gateway | Express.js | Authentication, rate limiting, request routing |
| Trip Verifier | Node.js service | Validates GPS integrity, detects anomalies, rejects invalid trips |
| Scoring Engine | Node.js service | Computes per-trip scores, updates rolling Safety Score |
| PostgreSQL | v15+ | Trip records, driver profiles, score history |
| Object Storage | S3-compatible | Encrypted raw GPS coordinate data |
| Redis | v7+ | Session cache, rate limiting counters |

---

## Drive Detection Algorithm

### Objective

Automatically detect when the user is driving a vehicle, without manual intervention, with ≥95% accuracy distinguishing driving from walking, cycling, and public transit.

### Sensor Inputs

| Sensor | Sample Rate | Purpose |
|--------|-------------|---------|
| Accelerometer | 10 Hz | Motion classification, braking/acceleration events |
| Gyroscope | 10 Hz | Cornering detection, rotation patterns |
| GPS | 1 Hz (active), 0.1 Hz (monitoring) | Velocity, route, distance |

### Detection State Machine

```
                    ┌─────────┐
                    │  IDLE   │
                    └────┬────┘
                         │ velocity > 15 km/h for 30s
                         ↓
                    ┌─────────┐
                    │DETECTING│
                    └────┬────┘
                         │ motion pattern = driving
                         ↓
                    ┌─────────┐
              ┌─────│ DRIVING │
              │     └────┬────┘
              │          │ stationary > 2 min
              │          ↓
              │     ┌─────────┐
              │     │ ENDING  │
              │     └────┬────┘
              │          │ confirm or timeout
              │          ↓
              │     ┌─────────┐
              └─────│  IDLE   │
                    └─────────┘
```

### State Transitions

| From | To | Condition |
|------|----|-----------|
| IDLE | DETECTING | GPS velocity > 15 km/h sustained for 30 seconds |
| DETECTING | DRIVING | Motion classifier confirms driving pattern (not transit/cycling) |
| DETECTING | IDLE | Velocity drops below 15 km/h before confirmation |
| DRIVING | ENDING | Vehicle stationary (velocity < 3 km/h) for > 2 minutes |
| ENDING | IDLE | Trip finalized and submitted |

### Motion Classification

The classifier distinguishes driving from other transport modes using:

```
Feature vector per 10-second window:
- mean_acceleration_magnitude
- std_acceleration_magnitude  
- mean_gyro_rotation_rate
- max_lateral_acceleration
- velocity_variance
- heading_change_rate
```

**Decision rules:**
- **Driving:** High velocity variance, moderate acceleration, low rotation rate, heading changes consistent with road geometry
- **Public transit:** High velocity, very low acceleration variance (smooth), stops at fixed intervals
- **Cycling:** Lower velocity (< 30 km/h typical), high gyro rotation, rhythmic acceleration
- **Walking:** Low velocity (< 7 km/h), high step-frequency in accelerometer

### Passenger Detection

When driving is detected, a secondary heuristic determines if the user is likely the driver or a passenger:

```
Indicators of DRIVER:
- Phone mounted (stable orientation, minimal rotation)
- Acceleration correlates with vehicle motion (same axis)
- Phone on left side of vehicle (driver side in LHD countries)

Indicators of PASSENGER:
- Phone in hand (frequent orientation changes)
- Acceleration axis misaligned with vehicle motion
- Phone on right side of vehicle
```

If confidence < 70% that user is driver → prompt confirmation within 10 minutes of trip end. Discard if unconfirmed after 24 hours.

### Battery Optimization

| State | GPS Rate | Sensor Rate | Target Battery |
|-------|----------|-------------|----------------|
| IDLE | 0.1 Hz (significant location changes only) | Motion coprocessor only | < 1%/hr |
| DETECTING | 1 Hz | 10 Hz | ~3%/hr |
| DRIVING | 1 Hz (0.1 Hz = every 10s for recording) | 10 Hz | < 5%/hr |

**Key optimizations:**
- Use motion coprocessor (CMMotionActivityManager / Activity Recognition API) for IDLE state — near-zero battery
- GPS activates only after motion coprocessor signals automotive activity
- Batch sensor readings in memory, write to disk every 60 seconds
- Network requests batched (sync on trip end, not during)

---

## Trip Recording

### Data Captured Per Trip

| Data Point | Sample Rate | Storage |
|-----------|-------------|---------|
| GPS coordinates (lat, lng, altitude) | Every 10 seconds | Object storage (encrypted) |
| Speed (from GPS) | Every 10 seconds | Trip record |
| Accelerometer (x, y, z) | 10 Hz, aggregated to events | Trip record (events only) |
| Gyroscope (x, y, z) | 10 Hz, aggregated to events | Trip record (events only) |
| Screen state (on/off) | Event-based | Trip record |
| Timestamp | Per reading | All |

### Trip Record Structure

```json
{
  "tripId": "uuid-v4",
  "driverId": "uuid-v4",
  "startTime": 1717200000,
  "endTime": 1717203600,
  "durationSeconds": 3600,
  "distanceKm": 42.5,
  "category": "commute",
  "coordinates": [
    { "lat": 12.9716, "lng": 77.5946, "alt": 920, "speed": 45.2, "ts": 1717200000 },
    { "lat": 12.9718, "lng": 77.5950, "alt": 920, "speed": 47.1, "ts": 1717200010 }
  ],
  "events": {
    "harshBraking": [{ "ts": 1717201200, "magnitude": 0.52, "durationMs": 1200 }],
    "harshAcceleration": [{ "ts": 1717201800, "magnitude": 0.35, "durationMs": 2100 }],
    "harshCornering": [{ "ts": 1717202400, "lateralG": 0.38, "durationMs": 800 }],
    "phoneUsage": [{ "tsStart": 1717202000, "tsEnd": 1717202015, "speedAtEvent": 52.3 }]
  },
  "gpsGaps": [{ "tsStart": 1717202500, "tsEnd": 1717202580, "durationSeconds": 80 }],
  "metadata": {
    "deviceModel": "iPhone 14",
    "osVersion": "iOS 17.4",
    "appVersion": "1.0.0",
    "passengerConfirmed": false
  }
}
```

---

## Scoring Algorithm

### Per-Trip Score

Each trip produces a score S ∈ [0, 1000] computed as a weighted sum of six factors:

```
S = 0.25 × F_speed + 0.20 × F_braking + 0.15 × F_accel + 0.15 × F_cornering + 0.15 × F_phone + 0.10 × F_time
```

### Factor Computation

#### F_speed (Speed Compliance) — Weight: 25%

```
For each GPS reading:
  overspeed_ratio = max(0, (actual_speed - posted_limit) / posted_limit)

F_speed = 1000 × (1 - mean(overspeed_ratios))
Clamped to [0, 1000]
```

Posted speed limits sourced from OpenStreetMap / map API based on GPS coordinates.

#### F_braking (Braking Smoothness) — Weight: 20%

```
harsh_braking_events = count of deceleration events > 0.4g
events_per_km = harsh_braking_events / distance_km

F_braking = 1000 × max(0, 1 - (events_per_km / 2.0))
```

Threshold: > 0.4g longitudinal deceleration sustained for > 500ms.

#### F_accel (Acceleration Patterns) — Weight: 15%

```
harsh_accel_events = count of acceleration events > 0.3g sustained > 2s
events_per_km = harsh_accel_events / distance_km

F_accel = 1000 × max(0, 1 - (events_per_km / 1.5))
```

#### F_cornering (Cornering Safety) — Weight: 15%

```
harsh_corner_events = count of lateral g-force events > 0.3g
events_per_km = harsh_corner_events / distance_km

F_cornering = 1000 × max(0, 1 - (events_per_km / 1.0))
```

#### F_phone (Phone Usage Avoidance) — Weight: 15%

```
phone_usage_seconds = total seconds screen was on while speed > 5 km/h
trip_duration_seconds = total trip duration

F_phone = 1000 × max(0, 1 - (phone_usage_seconds / (trip_duration_seconds × 0.05)))
```

Any phone interaction while moving penalizes. 5% threshold = if phone used for more than 5% of trip time, score approaches 0.

#### F_time (Time-of-Day Risk) — Weight: 10%

```
If trip occurs between 00:00–05:00:
  F_time = 700  (higher risk period, capped score)
Else:
  F_time = 1000
```

### Aggregate Safety Score (Rolling Average)

The overall Safety Score uses exponential decay over the most recent N trips (N = min(total_trips, 100)):

```
λ = 0.97 (decay factor)

S_aggregate = Σ(i=1..N) [λ^(N-i) × S_i] / Σ(i=1..N) [λ^(N-i)]
```

More recent trips have higher weight. A driver's score reflects their current behavior, not historical averages.

### Score Status

| Condition | Status |
|-----------|--------|
| < 10 trips OR < 100 km total | Provisional |
| ≥ 10 trips AND ≥ 100 km total | Verified |

### Grade Mapping

| Score Range | Grade |
|-------------|-------|
| 900–1000 | A |
| 750–899 | B |
| 600–749 | C |
| 400–599 | D |
| 0–399 | F |

---

## Data Validation & Anomaly Detection

### Rejection Criteria

A trip record is rejected if ANY of the following are true:

| Check | Threshold | Action |
|-------|-----------|--------|
| Speed exceeds physical limit | > 250 km/h at any reading | Reject entire trip |
| GPS teleportation | > 5 km between consecutive 10-second readings | Reject entire trip |
| Duration too short | < 60 seconds | Discard (not a real trip) |
| Distance too short | < 0.5 km | Discard |
| Timestamp anomaly | Non-monotonic timestamps | Reject |
| Future timestamps | Any timestamp > server time + 5 minutes | Reject |

### GPS Gap Handling

| Gap Duration | Action |
|-------------|--------|
| < 60 seconds | Interpolate, include in scoring |
| 60–300 seconds | Mark segment as unverified, exclude from scoring |
| > 300 seconds | Split into two separate trips |

### Unverified Distance Calculation

```
verified_distance = total_distance - Σ(unverified_segment_distances)
```

Only verified distance counts toward the 100 km threshold and scoring.

---

## Offline-First Architecture

### Local Storage

| Item | Storage | Limit |
|------|---------|-------|
| Pending trips | SQLite | 50 trips max |
| GPS coordinates (current trip) | In-memory → SQLite on trip end | Unlimited during trip |
| Score cache | SQLite | Latest score + last 10 trips |
| Auth tokens | Secure Keychain / Keystore | 1 token |

### Sync Strategy

```
On trip end:
  1. Save trip to local SQLite
  2. Attempt immediate upload
  3. If network unavailable → queue for later

On network restored:
  1. Upload oldest pending trip first (FIFO)
  2. Wait for server confirmation
  3. Delete local copy on success
  4. Continue until queue empty

On app foreground:
  1. Check pending trip count
  2. If > 0 and network available → sync
```

### Conflict Resolution

- Server is source of truth for Safety Score
- If local score differs from server after sync → overwrite local with server value
- Duplicate trip submissions (same tripId) are idempotent on server

---

## Privacy & Data Handling

### Data Classification

| Data | Sensitivity | Storage | Encryption |
|------|-------------|---------|------------|
| Raw GPS coordinates | High | Object storage | AES-256, driver-specific key |
| Trip scores & events | Medium | PostgreSQL | At-rest encryption |
| Email, phone | High (PII) | PostgreSQL | Column-level encryption |
| Safety Score | Low (public by design) | PostgreSQL + on-chain (Phase 2) | None (intentionally public) |
| Device info | Low | PostgreSQL | At-rest encryption |

### Data Retention

| Data | Retention | Deletion |
|------|-----------|----------|
| Raw GPS | Until driver requests deletion | Within 30 days of request |
| Trip records | Indefinite (needed for scoring) | Anonymized on deletion request |
| PII (email, phone) | Until account deletion | Within 30 days |
| Score history | Indefinite | Anonymized on deletion request |

### Phase 1 Privacy Guarantees

- No data shared with third parties in Phase 1
- No on-chain writes in Phase 1 (all data is off-chain)
- GPS data encrypted at rest with per-driver key
- Driver can export all data (GDPR compliance) within 72 hours
- Driver can delete account and all associated data within 30 days

---

## API Specification

### Base URL

```
https://api.drivx.xyz/v1  (placeholder)
```

### Authentication

JWT-based. Token issued on login, 30-minute expiry, refresh token for renewal.

### Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register with email + phone |
| POST | `/auth/login` | Login, receive JWT |
| POST | `/auth/refresh` | Refresh expired token |
| POST | `/trips/submit` | Submit a completed trip record |
| GET | `/trips/history` | Get paginated trip history |
| GET | `/trips/:tripId` | Get single trip detail |
| GET | `/score` | Get current Safety Score + breakdown |
| GET | `/score/history` | Get score trend (monthly averages) |
| GET | `/profile` | Get driver profile |
| PUT | `/profile` | Update profile (language, preferences) |

### Rate Limits

| Tier | Limit |
|------|-------|
| Unauthenticated | 20 req / 15 min |
| Authenticated (driver) | 200 req / 15 min |
| Trip submission | 10 req / min (prevents spam) |

### Error Responses

```json
{
  "error": "TRIP_REJECTED",
  "code": "ANOMALY_SPEED_EXCEEDED",
  "message": "Trip contains speed readings exceeding 250 km/h",
  "details": { "maxSpeedDetected": 312.4, "threshold": 250 }
}
```

---

## Database Schema

### Core Tables (Phase 1)

```sql
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    safety_score INTEGER DEFAULT 0 CHECK (safety_score >= 0 AND safety_score <= 1000),
    score_status VARCHAR(20) DEFAULT 'Provisional',
    total_trips INTEGER DEFAULT 0,
    total_kilometers DECIMAL(12, 2) DEFAULT 0,
    preferred_language VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trip_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    distance_km DECIMAL(8, 2) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    category VARCHAR(20) DEFAULT 'commute',
    trip_score INTEGER CHECK (trip_score >= 0 AND trip_score <= 1000),
    grade CHAR(1) CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
    speed_compliance_score INTEGER,
    braking_score INTEGER,
    acceleration_score INTEGER,
    cornering_score INTEGER,
    phone_avoidance_score INTEGER,
    time_risk_score INTEGER,
    gps_data_ref VARCHAR(255),
    verification_status VARCHAR(20) DEFAULT 'verified',
    rejection_reason TEXT,
    unverified_segments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trips_driver ON trip_records(driver_id, created_at DESC);
CREATE INDEX idx_score_history ON score_history(driver_id, recorded_at DESC);
CREATE INDEX idx_drivers_email ON drivers(email);
```

---

## Testing Strategy

### Unit Tests

| Component | Framework | Coverage Target |
|-----------|-----------|-----------------|
| Scoring algorithm | Jest | 100% of scoring logic |
| Anomaly detection | Jest | All rejection criteria |
| Drive detection state machine | Jest | All state transitions |
| API route handlers | Jest + Supertest | All endpoints |

### Property-Based Tests

Using [fast-check](https://github.com/dubzzz/fast-check):

| Property | Description |
|----------|-------------|
| Score bounds | For any valid trip data, score ∈ [0, 1000] |
| Weight sum | Factor weights always sum to 1.0 |
| Rolling average bounds | Aggregate score ∈ [0, 1000] for any trip sequence |
| Anomaly detection | Trips with speed > 250 always rejected |
| GPS gap exclusion | Gaps > 60s always excluded from scoring |
| Monotonic decay | More recent trips always weighted higher |

### Integration Tests

| Test | Description |
|------|-------------|
| Trip submission flow | Submit trip → verify → score → update aggregate |
| Offline sync | Record trips offline → restore connection → verify sync |
| Rejection flow | Submit invalid trip → verify rejection → no score change |
| Score progression | Submit 10 trips → verify status changes to "Verified" |

### Mobile Tests

| Test | Framework | Focus |
|------|-----------|-------|
| Drive detection | Detox / Jest | State machine transitions with mocked sensors |
| Battery usage | Manual profiling | Verify < 5% per hour in background |
| Offline storage | Jest | Verify 50-trip limit, FIFO sync |

---

## Open Questions (Phase 1)

- [ ] Speed limit data source: OpenStreetMap vs. commercial API (accuracy tradeoff)
- [ ] Passenger detection accuracy: acceptable false-positive rate?
- [ ] Minimum trip frequency before score decays (inactive driver handling)
- [ ] Device attestation in Phase 1 or defer to Phase 5 (Sybil resistance)?

---

*This specification is open source under the MIT License. Contributions welcome.*
>>>>>>> 7263682f57dca58a6d0ab9bf8d36c3dd4e320d43
