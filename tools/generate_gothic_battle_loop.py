#!/usr/bin/env python3
"""Generate a seamless ten-second gothic battle loop using only stdlib."""

from __future__ import annotations

import math
import random
import struct
import wave
from array import array
from pathlib import Path


SR = 44_100
DURATION = 10.0
FRAMES = int(SR * DURATION)
TAU = math.tau
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "combat_battle_10s_loop.wav"


def hz(midi: float) -> float:
    # Quantize to the loop's 0.1 Hz fundamental so every oscillator closes exactly.
    raw = 440.0 * 2.0 ** ((midi - 69.0) / 12.0)
    return round(raw * DURATION) / DURATION


def circular_delta(t: float, event: float) -> float:
    return (t - event + DURATION / 2.0) % DURATION - DURATION / 2.0


def softclip(x: float) -> float:
    return math.tanh(x)


def pseudo_noise(x: float, seed: float) -> float:
    # Continuous deterministic noise; safe across the loop boundary.
    return (
        math.sin(TAU * 2067.1 * x + seed * 1.13) * 0.55
        + math.sin(TAU * 4137.2 * x + seed * 2.71) * 0.30
        + math.sin(TAU * 8346.4 * x + seed * 4.37) * 0.15
    )


def main() -> None:
    random.seed(0xB100DB0A)
    left = array("f", [0.0]) * FRAMES
    right = array("f", [0.0]) * FRAMES

    # Five two-second bars at 120 BPM. The final harmony resolves back into D minor.
    chords = [
        (38, 45, 50, 53),  # Dm(add5), low and austere
        (39, 46, 51, 55),  # Eb major: sacred lift with Phrygian friction
        (37, 43, 46, 52),  # C# diminished
        (43, 50, 55, 58),  # G minor
        (38, 45, 50, 53),  # D minor return
    ]
    ostinato = [38, 45, 50, 41, 38, 46, 45, 37]  # original, non-thematic 16th pattern

    for i in range(FRAMES):
        t = i / SR
        l = r = 0.0

        # Cathedral drone: D/A with slow, periodic movement and organ-like harmonics.
        breath = 0.78 + 0.22 * math.sin(TAU * t / DURATION - math.pi / 2) ** 2
        for midi, amp, pan in ((26, 0.085, -0.20), (33, 0.055, 0.22), (45, 0.025, 0.0)):
            f = hz(midi)
            sig = (
                math.sin(TAU * f * t)
                + 0.34 * math.sin(TAU * f * 2 * t + 0.4)
                + 0.14 * math.sin(TAU * f * 3 * t + 1.1)
            ) * amp * breath
            l += sig * (1.0 - pan)
            r += sig * (1.0 + pan)

        # Overlapping choir/strings chords, each raised-cosine window wrapping at 10 s.
        for bar, chord in enumerate(chords):
            center = bar * 2.0 + 1.0
            d = circular_delta(t, center)
            if abs(d) < 1.35:
                env = 0.5 + 0.5 * math.cos(math.pi * d / 1.35)
                for voice, midi in enumerate(chord):
                    f = hz(midi + 12)
                    phase = voice * 0.71 + bar * 0.23
                    vibrato_rate = round((4.2 + voice * 0.17) * DURATION) / DURATION
                    vibrato = 0.0027 * math.sin(TAU * vibrato_rate * t + phase)
                    choir = (
                        math.sin(TAU * f * t + vibrato + phase)
                        + 0.28 * math.sin(TAU * f * 2 * t + phase * 0.7)
                        + 0.10 * math.sin(TAU * f * 3 * t + phase * 1.3)
                    )
                    # Dark vowel/formant shimmer without resembling a sung melody.
                    formant_rate = round((0.31 + voice * 0.04) * DURATION) / DURATION
                    formant = 0.83 + 0.17 * math.sin(TAU * formant_rate * t + phase)
                    sig = choir * env * formant * (0.021 if voice < 2 else 0.016)
                    pan = (-0.48, 0.43, -0.18, 0.22)[voice]
                    l += sig * (1.0 - pan)
                    r += sig * (1.0 + pan)

        # Urgent low-string ostinato: 40 perfectly periodic sixteenth-note attacks.
        for step in range(40):
            d = circular_delta(t, step * 0.25)
            if 0.0 <= d < 0.24:
                env = (1.0 - math.exp(-d * 85.0)) * math.exp(-d * 12.0)
                midi = ostinato[step % len(ostinato)]
                f = hz(midi)
                bow = (
                    math.sin(TAU * f * d + 0.7)
                    + 0.42 * math.sin(TAU * 2 * f * d + 1.1)
                    + 0.18 * math.sin(TAU * 3 * f * d + 0.2)
                    + 0.10 * pseudo_noise(d, step + 3.0)
                )
                accent = 1.35 if step % 4 == 0 else (1.12 if step % 2 == 0 else 0.86)
                pan = -0.24 if step % 2 == 0 else 0.24
                sig = bow * env * 0.055 * accent
                l += sig * (1.0 - pan)
                r += sig * (1.0 + pan)

        # Timpani/war-drum half-beats with stronger downbeats and pitch dive.
        for beat in range(20):
            d = circular_delta(t, beat * 0.5)
            if 0.0 <= d < 0.46:
                env = math.exp(-d * (7.0 if beat % 4 == 0 else 10.0))
                f0 = 76.0 if beat % 4 == 0 else 91.0
                phase = TAU * (f0 * d - 16.0 * d * d)
                body = math.sin(phase) + 0.32 * math.sin(phase * 1.53 + 0.3)
                attack = pseudo_noise(d, beat + 19.0) * math.exp(-d * 55.0)
                onset = 1.0 - math.exp(-d * 220.0)
                sig = (body * 0.16 + attack * 0.08) * env * onset
                l += sig * (1.06 if beat % 2 == 0 else 0.92)
                r += sig * (0.92 if beat % 2 == 0 else 1.06)

        # Ritual metal strikes on alternating bars: sacred glint, kept restrained.
        for strike, event in enumerate((0.0, 2.0, 4.5, 6.0, 8.5)):
            d = circular_delta(t, event)
            if 0.0 <= d < 1.25:
                env = math.exp(-d * 3.0)
                base = (466.2, 523.3, 440.0, 622.3, 493.9)[strike]
                bell = sum(
                    a * math.sin(TAU * base * ratio * d + strike * 0.4)
                    for ratio, a in ((1.0, 0.50), (1.414, 0.30), (2.07, 0.16), (2.71, 0.09))
                )
                sig = bell * env * (1.0 - math.exp(-d * 180.0)) * 0.036
                pan = -0.58 if strike % 2 == 0 else 0.58
                l += sig * (1.0 - pan)
                r += sig * (1.0 + pan)

        # Subtle ten-second periodic air/noise bed.
        air = pseudo_noise(t, 77.0) * (0.006 + 0.003 * math.sin(TAU * t / DURATION) ** 2)
        l += air
        r += pseudo_noise(t, 93.0) * 0.007
        left[i] = l
        right[i] = r

    # Circular cathedral reverb: delayed taps wrap around, preserving a seamless boundary.
    dry_l = array("f", left)
    dry_r = array("f", right)
    for delay_s, gain, cross in ((0.137, 0.20, 0.05), (0.271, 0.14, 0.08), (0.431, 0.10, 0.10), (0.683, 0.065, 0.13)):
        delay = int(delay_s * SR)
        for i in range(FRAMES):
            j = (i - delay) % FRAMES
            left[i] += dry_l[j] * gain + dry_r[j] * cross
            right[i] += dry_r[j] * gain + dry_l[j] * cross

    # Normalize with headroom and a gentle soft clip for game-ready transients.
    peak = max(max(abs(x) for x in left), max(abs(x) for x in right))
    gain = 0.88 / max(peak, 1e-9)
    pcm = bytearray()
    for l, r in zip(left, right):
        pcm += struct.pack("<hh", int(32767 * softclip(l * gain)), int(32767 * softclip(r * gain)))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT), "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes(pcm)
    print(OUTPUT)


if __name__ == "__main__":
    main()
