# G2 IMU — measured findings

Source: `newdata` (463 samples, 46.1 s, scripted motion: look up, look down,
look left, look right, tilt left, tilt right, return to center).
Earlier corroborating capture: `imu-capture-1788310582.jsonl` (46 samples).

## Summary

| Property | Measured value |
| --- | --- |
| Units | **normalized g** (1.0 = 1 gravity), not m/s² |
| Report rate | **10.0 Hz** at `ImuReportPace.P100` (mean dt 99.9 ms) |
| Sensor type | **3-axis accelerometer only** — no gyroscope, no magnetometer |
| +Z | up (rest ≈ +0.97 g) |
| X | pitch axis |
| Y / Z | roll axis (roll = `atan2(y, z)`) |

Magnitude |v| averages 1.0027; 454/463 samples fall within 5 % of 1.00 and
0/463 fall near 9.81, which pins the unit as g rather than m/s².

## Axis map (from the scripted run)

| Motion | Signature |
| --- | --- |
| look up | X strongly negative — pitch +90° at x = −1.010 |
| look down | X strongly positive — pitch −90° at x = +1.008 |
| tilt left | Y and Z rotate together — roll +127° (y = +0.188, z = −0.144) |
| tilt right | Y and Z rotate oppositely — roll −128° (y = −0.151, z = −0.117) |
| look left / right (yaw) | **no signature** |

Pitch range observed: −90° … +90°. Roll range: −128° … +127°.

## Why heading is unobservable

For a body-frame accelerometer under gravity, with yaw ψ, pitch θ, roll φ:

```
ax = −g · sin(θ)
ay =  g · sin(φ) · cos(θ)
az =  g · cos(φ) · cos(θ)
```

ψ does not appear in any term. Gravity in world frame is (0, 0, g), and
rotating about the vertical axis leaves the vertical unchanged, so yaw is
annihilated before pitch and roll are ever applied. This is an observability
limit, not a noise or calibration problem — no amount of filtering recovers it.

### Two independent confirmations from this capture

1. **Return-to-rest.** Start of run: pitch −2.6°, roll −7.6°. End of run after
   ~6 scripted motions: pitch −2.6°, roll +9.5°. Pitch is identical to 0.1°.
   Accumulated yaw from looking left and right would have shown up here.
2. **Tilt-azimuth noise.** For the 288 near-level samples, `atan2(ay, ax)`
   ranges −172° … +174° with 80° standard deviation. That is amplified jitter
   from tiny (ax, ay) values, not heading.

## Consequences

- A live magnetic compass cannot be built from this sensor.
- Calibrate-then-dead-reckon also cannot work: dead reckoning needs a Δ-yaw
  per sample, which is precisely the unobservable variable. The needle would
  freeze at the calibrated heading, yielding the static bearing we already ship.
- `AppLocation.heading` remains the only true-north source, but it is GPS
  course-over-ground — valid only while moving, and it describes travel
  direction rather than head orientation.
- Head tilt (pitch/roll) *is* accurately measurable and needs no calibration.
