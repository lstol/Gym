# Briefing prompt — paste everything below into a new Claude conversation

---

I want to think through a training-progression question with you. Everything you
need is below — you don't have access to the code, so treat this as the full
picture. Please push back where you disagree; I'd rather be corrected than
agreed with.

## Who and what

I'm a 54-year-old male runner. I train at home on an **Inspire M2 multi-gym**
(single weight stack feeding several stations through different pulley ratios).
Three strength sessions a week alongside three runs, currently in a **moderate
calorie deficit** (~300–500 kcal/day), protein around 160 g/day. The strength
work exists to support the running, not to compete with it — I care whether the
running gets better or worse.

I've built a small web app to log the training and tell me what to do next. It
is deliberately for one athlete, with a two-year life expectancy, not a product.

## The machine — this part matters for the numbers

One weight stack, several stations, different mechanical ratios. Stack:

- Top plate **6.804 kg** (15 lb) + 15 plates of **4.536 kg** (10 lb) each
- `stackKg(pin) = 6.804 + 4.536 × pin`, so pin 15 = **74.84 kg** = 165 lb (matches
  the manufacturer's figure exactly)
- **There are no micro-plates and none are planned.** The smallest possible jump
  is one whole pin.

Manufacturer resistance ratios, written stack:resistance, so factor = right ÷ left:

| Station | Ratio | Factor | Step per pin | Max effective |
|---|---|---|---|---|
| Lat / upper pulley | 1:1 | 1.0 | 4.54 kg | 74.8 kg |
| Mid pulley | 2:1 | 0.5 | 2.27 kg | 37.4 kg |
| Low pulley | 2:1 | 0.5 | 2.27 kg | 37.4 kg |
| Press arm | 2:1.2 | 0.6 | 2.72 kg | 44.9 kg |
| Leg extension | 1:1 | 1.0 | 4.54 kg | 74.8 kg |
| Seated leg curl | 4:3 | 0.75 | 3.40 kg | 56.1 kg |
| Leg press (optional) | 1:2 | 2.0 | 9.07 kg | 149.7 kg |

The app stores **the pin number and the station**, never kilograms — effective kg
is computed from the factor. That way, if a ratio turns out to be wrong, the
whole history recomputes correctly instead of being permanently corrupted.

**The consequence that drives everything:** one pin is a *large* relative jump at
the bottom of the stack and a small one at the top. On the upper pulley at pin 2
you are adding **28.6 %**. At pin 12 on the low pulley you are adding **7.4 %**.
This is why a fixed 8–12 rep range doesn't work uniformly across the machine.

## The programme

Three sessions, currently 3 working sets on every exercise:

- **A (Monday)** — legs + upper: Bulgarian split squat, hip hinge/RDL (low
  cable), chest press, lat pulldown, seated row, calf raise, cable crunch
- **B (Wednesday)** — upper + core: seated row, lat pulldown (alt grip), chest
  press, shoulder press, Pallof press, biceps curl, triceps pushdown
- **C (Sunday)** — light upper body, dropped entirely if legs are empty

Main lifts 8–12 reps at 1–3 RIR; smaller lifts 10–15 at 2–3 RIR. Session C is
12–15 reps at 2–3 RIR. Warm-up sets are not logged at all.

## The progression rules currently implemented

Double progression, with a rep-drop forecast:

1. If **all** prescribed work sets hit `rep_max` **and every set had RIR ≥ 1** →
   propose the next pin.
2. Else if the top set was below `rep_max` → same pin, target = top set + 1.
3. If sets reached `rep_max` but any set was at **RIR 0** → same pin (that's
   fatigue, not readiness).
4. Same pin for 3 consecutive sessions with no rep increase → flag **stalled**,
   propose ~90 % and rebuild.
5. Never increase load and sets in the same session.

When a pin increase is proposed, it forecasts the rep cost:

```
pctIncrease   = stepKg / currentEffectiveKg
repCost       = (pctIncrease × 100) / PCT_PER_REP     // PCT_PER_REP = 2.5
predictedReps = round(currentReps − repCost)
```

The engine **forecasts, it never blocks** — since there are no micro-plates,
refusing a big jump would mean never progressing on the upper pulley at all. If
the forecast lands below `rep_min`, the increase still goes ahead but the app
says the rep range is too narrow for that position on the stack and suggests a
wider one. It never rewrites the programme by itself.

`PCT_PER_REP = 2.5` is a crude approximation from rep-max tables. It varies by
person and exercise and is least reliable above 12 reps, which is exactly where
I use it most. It's a calibration target, not a law.

## My actual first session (session C, 23 August)

Every exercise 3 sets, range 12–15 reps, target 2–3 RIR:

| Exercise | Station | Pin | Effective | Reps | RIR |
|---|---|---|---|---|---|
| Chest press | press arm | 4 | 15.0 kg | 12 / 12 / 12 | 4 / 3 / 2 |
| Lat pulldown | upper | 7 | 38.6 kg | 12 / 12 / 12 | 6 / 6 / 6 |
| Seated row | low | 7 | 19.3 kg | 12 / 12 / 12 | 10 / 10 / 8 |
| **Shoulder press** | press arm | 4 | 15.0 kg | **12 / 9 / 7** | **0 / 0 / 0** |
| Biceps curl | low | 6 | 17.0 kg | 10 / 10 / 10 | 5 / 3 / 1 |
| Triceps pushdown | upper | 4 | 24.9 kg | 10 / 10 / 10 | 3 / 2 / 2 |
| Cable crunch | upper | 9 | 47.6 kg | 10 / 10 / 10 | 5 / 5 / 5 |

## What I actually want to discuss

**1. The shoulder press problem.** By rule 2 the app tells me to aim for 13 reps
next time, because my top set (12) was below `rep_max` (15). But I was at **RIR 0
on every set** and my reps collapsed 12 → 9 → 7. Telling me to add a rep looks
wrong. The rules have no clause for "below the rep target but already at
failure". What should happen instead — hold the reps, reduce the load, reduce
the sets, something else? And how would you word the rule so it doesn't
misfire in normal cases?

**2. Is the rest of that session even calibrated right?** Several exercises show
RIR 5–10, which means the loads are far too light and the 12–15 range plus
2–3 RIR target isn't being met from the other direction. Is "add a rep a week"
the right response to a load that is obviously much too light, or should the
first few sessions be treated as calibration and jumped more aggressively?

**3. Rep ranges versus the machine.** Given one pin is 28.6 % at the bottom of
the upper pulley and 7.4 % high on the low pulley, does a single rep range per
exercise make sense at all, or should the range be a function of where the
exercise sits on the stack?

**4. Sanity-check `PCT_PER_REP = 2.5`.** Is that a reasonable constant for a
54-year-old in a calorie deficit, and is there a better rule of thumb — ideally
one I could recalibrate from my own logged data after a couple of training
blocks?

## Constraints — please don't suggest these

- Micro-plates or fractional loading. Not available, not happening.
- Barbell work, or exercises the M2 can't do.
- Changing the equipment.
- More than 3 strength sessions a week — the running has priority.

One more piece of context that may matter: the press arm ratio is the single
number I'm least sure of. The M2 spec sheet says 2:1.2 (= 0.6), but Inspire's own
exercise chart prints the press arm as "1 to 1.2" (= 1.2) — double. Every other
station agrees between the two sources. So the two chest/shoulder press numbers
above could be understated by a factor of two. I haven't measured it yet.
