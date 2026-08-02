#!/usr/bin/env python3
"""
src/ 의 조각들을 이어 붙여 FathomOfAbyss.html 한 장을 만든다.

    python3 tools/build.py            # 빌드
    python3 tools/build.py --check    # 빌드하지 않고, 지금 파일과 같은지만 본다

왜 모듈이 아니라 이어 붙이기인가.

  게임은 통째로 하나의 IIFE 안에 산다. 266 개의 함수와 열아홉 개의 가변 상태가
  같은 클로저를 공유한다. 이것을 import/export 로 쪼개려면 그 공유 상태를 먼저
  풀어야 하는데, 그건 이 갈래의 작업이 아니다.

  그래서 '순서대로 자르기만' 한다. 자르고 다시 이어 붙이면 글자 하나까지 원본과
  같아진다 — 그래서 이 스크립트는 결과를 원본과 대조해 다르면 멈춘다. 동작이
  달라질 여지가 없다는 것을 매번 기계가 확인해 준다.

  그리고 한 장으로 나오므로 file:// 로 열어도, 웹뷰에 그대로 넣어도 돈다.
  쪼갠 것은 사람이 읽고 고치기 위한 것이고, 나가는 것은 여전히 한 장이다.

조각의 순서는 파일 이름의 숫자가 정한다. 새 조각은 번호를 끼워 넣으면 되고,
자리를 옮기려면 번호만 바꾸면 된다.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC  = os.path.join(ROOT, 'src')
OUT  = os.path.join(ROOT, 'FathomOfAbyss.html')

# 붙는 차례. 디렉터리 안에서는 파일 이름의 숫자 순서를 따른다.
ORDER = [
    ('shell',  '10-head.html'),      # <!doctype> ~ <style>
    ('styles', '*'),                 # 글꼴 · 층 선언 · base · pixel · art
    ('shell',  '20-between.html'),   # </style> ~ <script>
    ('game',   '*'),                 # 게임 전체 (하나의 IIFE)
    ('shell',  '30-tail.html'),      # </script> ~ </html>
]


def fragments():
    """붙일 조각들을 차례대로 돌려준다."""
    out = []
    for folder, pick in ORDER:
        d = os.path.join(SRC, folder)
        if pick == '*':
            names = sorted(n for n in os.listdir(d) if not n.startswith('.'))
        else:
            names = [pick]
        for n in names:
            out.append(os.path.join(d, n))
    return out


def read_fragment(path):
    """조각은 파일이라 끝에 줄바꿈이 하나 붙는다. 이어 붙일 때는 그것을 뺀다 —
    빼지 않으면 조각 사이마다 빈 줄이 하나씩 늘어난다."""
    s = open(path, encoding='utf-8').read()
    return s[:-1] if s.endswith('\n') else s


def build():
    parts = [read_fragment(p) for p in fragments()]
    return '\n'.join(parts)


def main():
    check = '--check' in sys.argv
    built = build()
    current = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else None

    n_frag = len(fragments())
    if current is not None and built == current:
        print(f'조각 {n_frag}개 → 지금 파일과 글자까지 같다 ✓')
        if not check:
            print('(바뀐 것이 없어 쓰지 않았다)')
        return 0

    if check:
        print(f'✗ 빌드 결과가 {os.path.basename(OUT)} 와 다르다')
        if current is not None:
            a, b = current.split('\n'), built.split('\n')
            print(f'  지금 {len(a)}줄 / 빌드 {len(b)}줄')
            for i in range(min(len(a), len(b))):
                if a[i] != b[i]:
                    print(f'  첫 차이 {i+1}번째 줄')
                    print(f'    지금 |{a[i][:70]}')
                    print(f'    빌드 |{b[i][:70]}')
                    break
        return 1

    open(OUT, 'w', encoding='utf-8').write(built)
    print(f'조각 {n_frag}개 → {os.path.basename(OUT)} ({len(built.split(chr(10)))}줄)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
