#!/usr/bin/env python3
"""Generate an original seamless gothic-cathedral main ambience loop."""

from __future__ import annotations

import math
import struct
import wave
from array import array
from pathlib import Path


SR = 44_100
DURATION = 20.0
FRAMES = int(SR * DURATION)
TAU = math.tau
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "gothic_cathedral_main_loop.wav"


def hz(midi: float) -> float:
    raw = 440.0 * 2.0 ** ((midi - 69.0) / 12.0)
    return round(raw * DURATION) / DURATION


def delta(t: float, event: float) -> float:
    return (t - event + DURATION / 2.0) % DURATION - DURATION / 2.0


def periodic_noise(t: float, seed: float) -> float:
    return (
        0.50 * math.sin(TAU * 1373.15 * t + seed * 1.71)
        + 0.31 * math.sin(TAU * 2741.80 * t + seed * 2.37)
        + 0.19 * math.sin(TAU * 5497.35 * t + seed * 4.13)
    )


def main() -> None:
    left = array("f", [0.0]) * FRAMES
    right = array("f", [0.0]) * FRAMES

    # Slow, original harmonic cycle: Dm(add9) → Eb/D → C#dim/D → Dm(add4).
    # Each cloud overlaps the next so the harmony seems to move inside the reverb.
    chord_clouds = [
        (0.0, (38, 45, 50, 53, 64)),
        (5.0, (38, 46, 51, 55, 63)),
        (10.0, (38, 49, 52, 55, 61)),
        (15.0, (38, 45, 50, 55, 62)),
    ]

    for i in range(FRAMES):
        t = i / SR
        l = r = 0.0

        # Stone-vault organ pedal. All rates close exactly over twenty seconds.
        slow_breath = 0.86 + 0.14 * math.cos(TAU * t / DURATION)
        for voice, (midi, amp, pan) in enumerate(((26, 0.070, -0.12), (33, 0.047, 0.15), (38, 0.028, 0.0))):
            f = hz(midi)
            phase = voice * 0.63
            organ = (
                math.sin(TAU * f * t + phase)
                + 0.29 * math.sin(TAU * f * 2.0 * t + phase + 0.2)
                + 0.11 * math.sin(TAU * f * 3.0 * t + phase + 0.9)
                + 0.045 * math.sin(TAU * f * 5.0 * t + phase + 1.4)
            )
            sig = organ * amp * slow_breath
            l += sig * (1.0 - pan)
            r += sig * (1.0 + pan)

        # Male/female choir cloud with restrained formant motion; no borrowed melody.
        for cloud, (center, notes) in enumerate(chord_clouds):
            d = delta(t, center)
            if abs(d) < 5.2:
                env = 0.5 + 0.5 * math.cos(math.pi * d / 5.2)
                for voice, midi in enumerate(notes):
                    f = hz(midi + (0 if voice < 2 else 12))
                    phase = cloud * 0.29 + voice * 0.77
                    vibrato_rate = round((3.35 + voice * 0.15) * DURATION) / DURATION
                    vibrato = 0.0021 * math.sin(TAU * vibrato_rate * t + phase)
                    vowel = (
                        math.sin(TAU * f * t + phase + vibrato)
                        + 0.24 * math.sin(TAU * f * 2.0 * t + phase * 0.7)
                        + 0.075 * math.sin(TAU * f * 3.0 * t + phase * 1.4)
                    )
                    formant_rate = round((0.20 + voice * 0.035) * DURATION) / DURATION
                    formant = 0.82 + 0.18 * math.sin(TAU * formant_rate * t + phase)
                    amp = 0.020 if voice < 2 else 0.013
                    pan = (-0.50, 0.42, -0.24, 0.18, 0.05)[voice]
                    sig = vowel * env * formant * amp
                    l += sig * (1.0 - pan)
                    r += sig * (1.0 + pan)

        # Bowed-bass swells breathe between the four harmonic pillars.
        for swell, event in enumerate((1.0, 6.0, 11.0, 16.0)):
            d = delta(t, event)
            if abs(d) < 2.1:
                env = 0.5 + 0.5 * math.cos(math.pi * d / 2.1)
                note = (38, 39, 37, 38)[swell]
                f = hz(note)
                bow = (
                    math.sin(TAU * f * t + swell * 0.4)
                    + 0.38 * math.sin(TAU * 2.0 * f * t + 0.7)
                    + 0.09 * periodic_noise(t, swell + 11.0)
                )
                pan = -0.32 if swell % 2 == 0 else 0.32
                sig = bow * env * 0.038
                l += sig * (1.0 - pan)
                r += sig * (1.0 + pan)

        # A sparse four-tone invocation, widely spaced and deliberately non-thematic.
        for strike, (event, midi) in enumerate(((2.5, 74), (7.5, 75), (12.5, 69), (17.5, 73))):
            d = (t - event) % DURATION
            if d < 3.8:
                onset = 1.0 - math.exp(-d * 90.0)
                env = onset * math.exp(-d * 1.05)
                base = hz(midi)
                bell = sum(
                    amp * math.sin(TAU * base * ratio * d + strike * 0.31)
                    for ratio, amp in ((1.0, 0.45), (1.414, 0.27), (2.12, 0.14), (2.69, 0.08))
                )
                pan = (-0.60, 0.55, -0.38, 0.45)[strike]
                sig = bell * env * 0.028
                l += sig * (1.0 - pan)
                r += sig * (1.0 + pan)

        # Cold air in the nave, periodic by construction.
        air_level = 0.0045 + 0.0015 * math.sin(TAU * t / DURATION) ** 2
        l += periodic_noise(t, 71.0) * air_level
        r += periodic_noise(t, 89.0) * air_level
        left[i], right[i] = l, r

    # Long circular reflection taps imitate a large stone nave while preserving the seam.
    dry_l, dry_r = array("f", left), array("f", right)
    reflections = (
        (0.089, 0.13, 0.04),
        (0.173, 0.12, 0.05),
        (0.311, 0.10, 0.07),
        (0.557, 0.085, 0.08),
        (0.887, 0.065, 0.10),
        (1.337, 0.045, 0.11),
    )
    for delay_s, gain, cross in reflections:
        delay = int(delay_s * SR)
        for i in range(FRAMES):
            j = (i - delay) % FRAMES
            left[i] += dry_l[j] * gain + dry_r[j] * cross
            right[i] += dry_r[j] * gain + dry_l[j] * cross

    # Conservative ambience master: softer than combat and with generous headroom.
    peak = max(max(abs(x) for x in left), max(abs(x) for x in right))
    gain = 0.34 / max(peak, 1e-9)
    pcm = bytearray()
    for l, r in zip(left, right):
        pcm += struct.pack("<hh", int(32767 * math.tanh(l * gain)), int(32767 * math.tanh(r * gain)))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT), "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes(pcm)
    print(OUTPUT)


if __name__ == "__main__":
    main()
