import math, wave, struct, random

SR = 44100
random.seed(7)

def write_wav(path, seconds, bpm, battle=False):
    n = int(SR * seconds)
    beat = 60.0 / bpm
    frames = bytearray()
    roots = [36, 34, 31, 29] if battle else [36, 35, 33, 31]
    scale = [0, 3, 5, 7, 10] if battle else [0, 1, 3, 6, 7]
    for i in range(n):
        t = i / SR
        phase = (t / seconds) % 1.0
        # tiny equal-power loop crossfade makes the rendered endpoints meet smoothly
        fade = min(1.0, phase / 0.035, (1.0 - phase) / 0.035)
        sample = 0.0
        bar = int(t / (beat * 4)) % len(roots)
        root = roots[bar]
        hz = 440.0 * 2 ** ((root - 69) / 12)
        sample += 0.16 * math.sin(2 * math.pi * hz * t)
        sample += 0.07 * math.sin(2 * math.pi * hz * 2.01 * t)
        if battle:
            step = int(t / (beat / 2))
            note = root + scale[step % len(scale)] + (12 if step % 8 in (3, 7) else 0)
            nhz = 440.0 * 2 ** ((note - 69) / 12)
            env = 0.65 + 0.35 * math.sin(math.pi * ((t / (beat / 2)) % 1))
            sample += 0.12 * env * math.sin(2 * math.pi * nhz * t)
            if (t % beat) < 0.16:
                k = math.exp(-22 * (t % beat))
                sample += 0.24 * k * math.sin(2 * math.pi * 62 * t)
            if (t % (beat * 2)) < 0.08:
                sample += 0.12 * math.exp(-45 * (t % (beat * 2))) * random.uniform(-1, 1)
        else:
            for mult, amp in ((1.498, .05), (2.997, .035), (4.01, .02)):
                sample += amp * math.sin(2 * math.pi * hz * mult * t)
            sample += 0.018 * math.sin(2 * math.pi * 0.17 * t)
        # gentle saturation and fade at exact loop boundary
        sample = math.tanh(sample * 1.8) * 0.52 * fade
        val = int(max(-1, min(1, sample)) * 32767)
        frames += struct.pack('<hh', val, val)
    with wave.open(path, 'wb') as out:
        out.setnchannels(2); out.setsampwidth(2); out.setframerate(SR); out.writeframes(frames)

write_wav('/tmp/foa-ambient.wav', 20, 60, False)
write_wav('/tmp/foa-battle.wav', 10, 140, True)
