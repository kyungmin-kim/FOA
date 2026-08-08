#!/usr/bin/env python3
"""
배경음 원본(wav)을 게임이 싣는 m4a 로 굽고, 길이를 HTML 에 되받아 적는다.

파일 이름은 곡이 아니라 '자리'를 가리킨다 — assets/bgm-<자리>.m4a.
곡이 바뀌어도 자리는 그대로이므로, 새 원본을 같은 자리에 다시 구우면 끝이다.

이 스크립트가 있는 이유는 손으로 하면 두 가지를 놓치기 때문이다.

  1) 무압축 wav 는 .gitignore 로 저장소에서 빠진다. 코드가 wav 를 가리킨 채
     푸시되면 내려받은 쪽에서는 소리가 통째로 사라진다.
  2) 루프 끝(seconds)은 원본 길이와 반드시 같아야 한다. 10 초짜리를 20 초로
     바꿔 놓고 이 값을 안 고치면, 긴 곡이 절반에서 되감기고 뒷부분은
     영영 들리지 않는다 — 소리는 나므로 버그인 줄도 모른다.

    python3 tools/encode-bgm.py                    # 전부 다시 굽는다
    python3 tools/encode-bgm.py ambient            # 한 자리만
    python3 tools/encode-bgm.py ambient=assets/new_loop.wav   # 원본을 바꿔 굽는다

원본을 바꿔 구웠다면 아래 SOURCES 도 함께 고쳐 두어야 다음번에 그대로 돈다
(스크립트가 끝에 알려 준다).

인코딩은 macOS 내장 afconvert 를 쓴다. 제한 VBR(천장 128k) — 천장만 두고
필요한 만큼만 쓰게 하면, 성긴 앰비언트는 알아서 낮게 굽고 촘촘한 구간에서만
비트를 올린다. 무손실 gapless 메타데이터가 남아 이음매 없이 되감긴다.
"""
import os, re, subprocess, sys, wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# 고치는 것은 산출물이 아니라 원본 조각이다. 산출물을 고치면 다음 빌드에 덮인다.
HTML = os.path.join(ROOT, 'src', 'game', '80-render.js')

# 자리 → 원본 wav. 곡을 갈아 끼우면 이 줄만 고친다.
SOURCES = {
    'ambient': 'assets/gothic_cathedral_main_loop.wav',
    'battle':  'assets/combat_battle_10s_loop.wav',
}
BITRATE_CEILING = '128000'


def wav_seconds(path):
    """원본의 정확한 길이. afinfo 문자열을 긁는 것보다 프레임 수가 확실하다."""
    with wave.open(path, 'rb') as w:
        return w.getnframes() / float(w.getframerate())


def encode(src, dst):
    subprocess.run(
        ['afconvert', '-f', 'm4af', '-d', 'aac', '-s', '2', '-b', BITRATE_CEILING, src, dst],
        check=True, capture_output=True)


def encoded_report(path):
    """굽고 난 파일의 실제 비트레이트와 gapless 프레임 수를 읽어 온다."""
    out = subprocess.run(['afinfo', path], check=True, capture_output=True, text=True).stdout
    bitrate = re.search(r'bit rate: (\d+)', out)
    valid   = re.search(r'audio (\d+) valid frames', out)
    return (int(bitrate.group(1)) if bitrate else 0,
            int(valid.group(1)) if valid else 0)


def sync_seconds(slot, seconds):
    """HTML 의 BGM_TRACKS 에서 그 자리의 seconds 만 갈아 끼운다.

    블록을 먼저 잘라내고 그 안에서만 바꾼다 — 파일 전체에 정규식을 풀면
    엉뚱한 곳의 같은 낱말을 건드린다.
    """
    src = open(HTML, encoding='utf-8').read()
    m = re.search(r'const BGM_TRACKS = \{.*?\n  \};', src, re.S)
    if not m:
        raise SystemExit(f'BGM_TRACKS 블록을 찾지 못했다 — {os.path.relpath(HTML, ROOT)} 를 확인할 것')
    block = m.group(0)

    # 정수로 떨어지면 정수로 적는다 (20.0 이 아니라 20)
    text = str(int(seconds)) if abs(seconds - round(seconds)) < 1e-6 else repr(round(seconds, 3))
    pat = re.compile(r"(\b%s:\s*\{[^}]*?seconds:\s*)([0-9.]+)" % re.escape(slot))
    if not pat.search(block):
        print(f'  ! {slot}: BGM_TRACKS 에 자리가 없다 — seconds 를 적지 못했다')
        return None
    before = pat.search(block).group(2)
    if before == text:
        return before                      # 이미 같으면 파일을 건드리지 않는다
    new_block = pat.sub(lambda mm: mm.group(1) + text, block, count=1)
    open(HTML, 'w', encoding='utf-8').write(src.replace(block, new_block, 1))
    return before


def check_src_path(slot, dst_rel):
    """HTML 이 이 자리에서 정말 m4a 를 가리키는지 확인한다."""
    src = open(HTML, encoding='utf-8').read()
    m = re.search(r"\b%s:\s*\{[^}]*?src:\s*'([^']+)'" % re.escape(slot), src)
    if m and m.group(1) != dst_rel:
        print(f"  ! {slot}: HTML 이 '{m.group(1)}' 를 가리킨다 — '{dst_rel}' 이어야 한다")


def parse_args(argv):
    """인자 없으면 전부. 'slot' 이면 그 자리만. 'slot=경로' 면 원본을 바꿔서."""
    if not argv:
        return dict(SOURCES)
    picked, overridden = {}, {}
    for a in argv:
        slot, _, path = a.partition('=')
        if slot not in SOURCES:
            raise SystemExit(f"모르는 자리: {slot} (쓸 수 있는 것: {', '.join(SOURCES)})")
        picked[slot] = path or SOURCES[slot]
        if path:
            overridden[slot] = path
    parse_args.overridden = overridden
    return picked


def main():
    parse_args.overridden = {}
    targets = parse_args(sys.argv[1:])

    for slot, rel in targets.items():
        src = os.path.join(ROOT, rel)
        dst_rel = f'assets/bgm-{slot}.m4a'
        dst = os.path.join(ROOT, dst_rel)
        print(f'── {slot}')
        if not os.path.exists(src):
            print(f'  ! 원본이 없다: {rel}')
            print('    생성 스크립트를 먼저 돌렸는지 확인할 것 (tools/generate_*.py)')
            parse_args.overridden.pop(slot, None)   # 굽지 못한 자리는 안내하지 않는다
            continue

        seconds = wav_seconds(src)
        encode(src, dst)
        bitrate, valid = encoded_report(dst)
        size_kb = os.path.getsize(dst) / 1024.0
        src_kb  = os.path.getsize(src) / 1024.0

        print(f'  {rel}')
        print(f'    → {dst_rel}')
        print(f'    길이 {seconds:g}초 · {src_kb:,.0f} KB → {size_kb:,.0f} KB'
              f' ({(1 - size_kb / src_kb) * 100:.0f}% 감소) · {bitrate / 1000:.0f} kbps')

        expected = round(seconds * 44100)
        if valid and abs(valid - expected) > 2:
            print(f'    ! gapless 프레임이 어긋난다: {valid} (기대 {expected})')
            print('      되감을 때 이음매가 들릴 수 있다')
        before = sync_seconds(slot, seconds)
        if before is not None and before != (str(int(seconds)) if abs(seconds - round(seconds)) < 1e-6
                                             else repr(round(seconds, 3))):
            print(f'    seconds {before} → {seconds:g} (HTML 갱신)')
        check_src_path(slot, dst_rel)

    if parse_args.overridden:
        print('\n원본을 바꿔 구웠다. 다음번에도 그대로 돌게 하려면 이 스크립트의 SOURCES 를 고칠 것:')
        for slot, path in parse_args.overridden.items():
            print(f"    '{slot}': '{path}',")
    print('\n조각을 고쳤다면 빌드해야 화면에 반영된다:  python3 tools/build.py')


if __name__ == '__main__':
    main()
