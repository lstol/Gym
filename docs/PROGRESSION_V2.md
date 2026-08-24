# Progression rules v2

Written in English to match the repo convention. UI strings are Norwegian and specified
inline. Patch 1 has been folded in; where it replaced a section, only the replacement remains.

---

## Why this exists

The three open questions in the old `docs/HANDOFF.md` are resolved:

1. **Shoulder press, 12/9/7 at RIR 0.** The old rule was wrong because it read the *top* set.
   A set of 12 at RIR 0 in a 12–15 range means the load is right for one set and too heavy to
   repeat. The job is to make the sets even, not to add a rep. The progression target moves to
   the **lowest** working set, and ragged sets block any increase.
2. **Loads far too light (RIR 5–10).** "Add one rep" is the wrong response to a load 20–25 %
   under target. The fix cannot be driven by RIR either, because RIR is exactly the instrument
   that is broken — a novice reporting RIR 8 may well have had 12. Calibration must use a
   **verifiable** input: an AMRAP set, counted.
3. **Rep ranges.** A function of the station's step size and of joint tolerance, not one
   global range.

`PCT_PER_REP` is gone entirely; one Epley model now covers both the forecast and calibration.

---

## 1. Terminology

For one exercise, over its logged working sets from **any session template it appears in**
(warmups **and AMRAP sets** excluded — see §3a). History is not siloed per template: §5 fixes
`rep_min`/`rep_max` as the same wherever an exercise appears, so a template only changes the
RIR target, never what counts as "on track." Siloing by template was tried first and reverted
2026-08-24 — with most exercises shared across A/B/C and each template recurring only weekly,
per-template history meant calibration effectively never converged; see `docs/HANDOFF.md`.

```
reps[]       reps of each completed working set, in order
rirs[]       RIR of each completed working set
topReps      = max(reps)
minReps      = min(reps)
spread       = topReps − minReps
minRir       = min(rirs)          // unknown/null RIR counts as 0 — never as readiness
stepKg       = machine.plate_kg × station.factor
currentKg    = effectiveKg(pin, station)
```

`prescribedSetsComplete` means the number of logged non-AMRAP working sets equals
`target_sets`.

`targetRir` does not exist. Everywhere a midpoint of `rir_min..rir_max` was once implied, read
**`rir_min`**.

---

## 2. Decision tree — evaluate in order, first match wins

Implement as an ordered list of predicates returning a tagged recommendation, not nested ifs.

| # | Condition | Recommendation | `reason` |
|---|---|---|---|
| 0 | No previous session (any template) containing this exercise | none | `no_history` |
| 1 | Exercise is in **calibration mode** (§3) | see §3 | `calibrating` / `calibration_jump` |
| 2 | Proposed load would exceed 90 % of `station.max_effective_kg` | hold pin, flag ceiling | `station_ceiling` |
| 3 | `minRir == 0` **and** `topReps < rep_max` | hold pin, target = `topReps` on **all** sets | `failure_below_target` |
| 4 | `spread >= 3` | hold pin, target = `topReps` on all sets | `ragged_sets` |
| 5 | `prescribedSetsComplete` and all `reps >= rep_max` and all `rirs >= 1` | **next pin**, predicted reps (§4) | `progress_load` |
| 6 | all `reps >= rep_max` but `minRir == 0` | hold pin, same reps | `consolidate` |
| 7 | Same pin ≥ 3 consecutive sessions with no increase in `minReps` | drop to ≈ 90 % of `currentKg`, min 1 pin | `stalled` |
| 8 | otherwise | hold pin, target = `minReps + 1` | `progress_reps` |

**The core fix is rule 8**: the target is driven by the lowest working set, not the highest.
When sets are even the two are identical, so it does not misfire in the normal case.

**Why `spread >= 3` and not 2.** Losing 1–2 reps across three sets at fixed load and fixed RIR
target is normal fatigue. Three or more means the load is not sustainable for the prescribed
set count.

Rules 3 and 4 often fire together. Rule 3 wins; its wording is more specific.

---

## 3. Calibration mode

An exercise is **uncalibrated** until either:

- three or more completed sessions (any template) contain it, **or**
- any logged session had `minRir <= 3`.

While uncalibrated, rule 1 matches and the following applies.

### 3a. No AMRAP on record → request one

Same pin, and ask for an AMRAP on the **last set only**.

```
nb: "Kalibrering: samme pinne. Ta siste sett så langt du kommer med god teknikk og
     noter antall. Da regner appen ut riktig last."
```

**AMRAP is not allowed on every exercise.** `exercise.amrap_allowed` (boolean, default true)
is `false` for: shoulder press, chest press, Bulgarian split squat, hip hinge / RDL — shoulder
injury history, balance limits, leg fatigue costing the running, and spinal loading at failure
with a novice hinge. Those fall back to §3c, marked as an estimate.

**Recording**: `set_entry.is_amrap boolean not null default false`, a per-row toggle offered
only on the last set, and only when the engine has asked for one. Three consequences:

1. `is_amrap = true` **forces `rir = 0`** and hides the RIR control — an all-out set has no
   reps in reserve by definition. Enforced by a CHECK constraint.
2. AMRAP sets are **excluded** from `reps[]`, `rirs[]`, `minRir` and `spread` in rules 3–8.
   Otherwise a 22-rep AMRAP after 12/12 makes `spread = 10` and trips `ragged_sets`, and its
   forced RIR 0 trips `failure_below_target`. An AMRAP is a measuring instrument, read only by
   §3b.
3. They still count as working sets for volume and still appear in `v_working_set`.

### 3b. AMRAP on record → compute the jump

```
targetCapacity = rep_max + rir_min          // integer by construction; no half-rounding
targetKg       = currentKg × (1 + min(amrapReps, 25) / k) / (1 + targetCapacity / k)
pinDelta       = clamp(Math.round((targetKg − currentKg) / stepKg), 0, 3)
```

Cap at **3 pins per session**. If the uncapped value exceeded 3, say so:

```
nb: "Stort sprang — appen tar det over to økter."
```

Never propose a pin whose effective load exceeds 90 % of `station.max_effective_kg`; if that
clamp bites, `station_ceiling` wins.

### 3c. RIR fallback (only when `amrap_allowed = false`)

```
rirGap    = minRir − rir_min
pinDelta  = clamp(round(currentKg × rirGap × (100 / (k + minReps)) / 100 / stepKg), 0, 2)
```

Cap at 2, not 3 — the input is a self-report and novice RIR is biased.
`nb: "Anslag basert på RIR — mindre presist enn en AMRAP."`

### 3d. Leaving calibration

Rule 1 stops matching; the tree falls through to rules 2–8. Show once:
`nb: "Kalibrert. Fra nå gjelder vanlig progresjon."`

---

## 4. Rep-cost forecast

One Epley model, no linear constant:

```ts
const EPLEY_K_DEFAULT = 30

function e1rm(kg: number, reps: number, k: number): number {
  return kg * (1 + reps / k)
}

function predictedReps(currentKg: number, currentReps: number, newKg: number, k: number) {
  return Math.round(k * (e1rm(currentKg, currentReps, k) / newKg - 1))
}
```

Why the constant went: Epley implies the load cost of one rep, as a fraction of current load,
is `1 / (k + reps)` — about 2.6 % at 8 reps, 2.4 % at 12, 2.2 % at 15, 2.0 % at 20. It is not
constant. This programme spans 8 to 20 reps, so any single value is wrong at one end.

### 4a. Per-exercise calibration of `k`

Table `rep_cost_observation`: `exercise_id, session_template_id, observed_at, from_kg, to_kg,
from_reps, to_reps, epley_k`.

Write one row whenever consecutive logged sessions — any template — show a **pin change** with
both sessions' `minRir` within ±1 of each other. `session_template_id` records which template
was active for the later of the two sessions (provenance only, no longer part of the row's
identity — see `docs/HANDOFF.md`, 2026-08-24). Closed-form fit (the `k` at which both sessions
imply the same e1RM):

```
k = (to_kg × to_reps − from_kg × from_reps) / (from_kg − to_kg)
```

Discard when `from_kg == to_kg`, when `from_reps == to_reps`, or when the result falls outside
`[15, 60]`.

`epleyK(exercise)` returns the **median** of that exercise's observations once there are three
or more, clamped to `[15, 60]`; otherwise `EPLEY_K_DEFAULT`.

Settings shows the value, the observation count, and whether it is still the default. A lower
`k` means reps fall away faster as load rises; higher, the opposite. Caveat shown once:
`nb: "Anslaget er grovere jo høyere repetisjoner."`

---

## 5. Rep ranges

`rep_min` and `rep_max` are the same wherever an exercise appears. Only RIR differs by session.

| Exercise | Station | rep_min | rep_max | RIR in A/B | RIR in C |
|---|---|---|---|---|---|
| Chest press | press_arm | 10 | 15 | 2–2 | 3–4 |
| Shoulder press | press_arm | 10 | 15 | 2–2 | 3–4 |
| Lat pulldown | upper_pulley | 8 | 13 | 1–2 | 3–4 |
| Seated row | press_arm | 8 | 12 | 1–2 | 3–4 |
| Hip hinge / RDL | low_pulley | 8 | 12 | 2–3 | — |
| Bulgarian split squat | external | 8 | 12 | 2–3 | — |
| Calf raise | low_pulley | 12 | 20 | 1–2 | — |
| Biceps curl | low_pulley | 10 | 16 | 1–2 | 3–4 |
| Triceps pushdown | upper_pulley | 10 | 20 | 1–2 | 3–4 |
| Cable crunch | mid_pulley | 10 | 20 | 1–2 | 3–4 |
| Pallof press | mid_pulley | 10 | 12 per side | 2–3 | 3–4 |

Session C is light because `rir_min = 3` holds the loads down, and because it is the session
dropped when the legs are empty. It is not where progression happens.

`range_advisory` is evaluated at **block review only**, never mid-block: if `repCost` for an
exercise consistently exceeds `rep_max − rep_min`, suggest widening. Never rewrite the
template automatically.

---

## 6. The recommendation banner

One line, Norwegian, always with a reason.

| `reason` | Banner text |
|---|---|
| `progress_load` | `"Opp til pinne {pin} ({kg} kg). Anslagsvis {predictedReps} reps."` |
| `progress_reps` | `"Samme pinne. Mål: {minReps + 1} reps på alle sett."` |
| `failure_below_target` | `"Samme pinne. Du gikk til utmattelse på alle sett — mål å ta {topReps} på alle tre før du øker."` |
| `ragged_sets` | `"Ujevne sett ({reps.join('/')}). Samme pinne til alle tre er like."` |
| `consolidate` | `"Samme pinne — siste sett gikk til utmattelse."` |
| `stalled` | `"Stått stille i {n} økter. Ned til pinne {pin} og bygg opp igjen."` |
| `station_ceiling` | `"Nær maks for denne stasjonen ({kg} av {max} kg). Bytt øvelse i stedet."` |
| `calibrating` | as §3a |
| `calibration_jump` | `"Kalibrering: opp {n} pinner til pinne {pin} ({kg} kg)."` |
| `no_history` | no banner |

"Bruk" pre-sets the pin control and writes nothing. Every acceptance or override goes to
`suggestion_feedback`, now including `reason`. Settings shows `epley_k`, not `PCT_PER_REP`.

---

## 7. Test cases

Ranges per §5. Session C, so `rir_min = 3`. `stackKg(pin) = 6.804 + 4.536 × pin`. `k = 30`.

### From the real session of 23 August

> **Station correction, 2026-08-24.** Seated row and cable crunch were logged against the
> wrong station — seated row runs on `press_arm` on this unit, not `low_pulley`; cable crunch
> runs on `mid_pulley`, not `upper_pulley`. `exercise.default_station_id` and the affected
> `set_entry.station_id` rows from this session have been corrected in the database (kg is
> computed, never stored, so the fix recomputes correctly). The `low_pulley 7 → 19.278 kg` and
> `upper_pulley 9 → 47.628 kg` figures below are left as originally worked — they are still
> arithmetically valid demonstrations of the model, just no longer what seated row and cable
> crunch actually resolve to. See §5 for the corrected station assignments.

| Exercise | Station / pin | kg | Reps | RIR | rep_max | Expected |
|---|---|---|---|---|---|---|
| Shoulder press | press_arm 4 | 14.969 | 12/9/7 | 0/0/0 | 15 | `failure_below_target` — hold pin 4, target 12. **Must not return 13.** |
| Chest press | press_arm 4 | 14.969 | 12/12/12 | 4/3/2 | 15 | calibrated (minRir 2 ≤ 3) → rule 8, target 13 |
| Seated row | low_pulley 7 | 19.278 | 12/12/12 | 10/10/8 | 12 | `calibrating` — request AMRAP. **Rule 5 must not pre-empt it** |
| Lat pulldown | upper_pulley 7 | 38.556 | 12/12/12 | 6/6/6 | 13 | `calibrating` — request AMRAP |
| Biceps curl | low_pulley 6 | 17.010 | 10/10/10 | 5/3/1 | 16 | calibrated (minRir 1) → rule 8, target 11 |
| Triceps pushdown | upper_pulley 4 | 24.948 | 10/10/10 | 3/2/2 | 20 | calibrated (minRir 2) → rule 8, target 11 |
| Cable crunch | upper_pulley 9 | 47.628 | 10/10/10 | 5/5/5 | 20 | `calibrating` — request AMRAP |

### Calibration jump

| Case | Computation | Expected |
|---|---|---|
| Seated row, pin 7, AMRAP 22 | `cap = 12+3 = 15`; `targetKg = 19.278 × (1+22/30)/(1+15/30) = 22.277`; `(22.277−19.278)/2.268 = 1.322` | **pin 8** (21.546 kg) |
| Same, AMRAP 40 | clamped to 25 before Epley | finite, no throw |
| Uncapped `pinDelta` 6 | clamp to 3 | banner mentions the split |
| Jump crossing 90 % of station max | clamp | `station_ceiling` wins |

### Rep-cost forecast

| Case | Computation | Expected |
|---|---|---|
| Seated row, low 12→13, 12 reps | e1RM 42.865; `30 × (42.865/32.886 − 1)` | 9 |
| Lat pulldown, upper 6→7, 12 reps | e1RM 47.628; `30 × (47.628/38.556 − 1)` | 7 |
| Triceps, upper 2→3, 14 reps | e1RM 23.285; `30 × (23.285/20.412 − 1)` | 4 |

### Edge cases

- `spread = 2` (12/11/10) → not ragged → rule 8, target 11
- `spread = 3` (12/10/9) → `ragged_sets`
- RIR null → 0, never readiness
- 2 of 3 prescribed sets logged → `prescribedSetsComplete = false`, rule 5 cannot fire
- AMRAP present → excluded from `spread`, `minRir`, rules 3–8
- `epley_k` fit with `from_kg == to_kg` → discarded, no division by zero
- `epley_k` with 2 observations → returns 30
- `epley_k` observations 28, 31.5, 70 → 70 filtered at write; 2 remain; returns 30
- `epley_k` observations 28, 31.5, 34 → median 31.5

### Rounding

`Math.round` throughout (half away from zero). `targetCapacity` is an integer by construction,
which was the only place half-rounding could have mattered.
