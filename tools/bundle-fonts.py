#!/usr/bin/env python3
"""
갈무리 글꼴을 게임에 쓰이는 글자만 추려 HTML 안에 박아 넣는다.

CDN 을 그대로 두면 비행기 모드에서 글꼴이 통째로 날아간다 — 앱으로 내려면
오프라인에서 돌아야 하므로 번들이 필수다. 다만 다섯 벌을 통째로 넣으면 2.3MB,
base64 로는 3MB 가 넘는다. 실제로 화면에 뜨는 글자만 남기면 그 몇십 분의 일이다.

새 한글 문구를 추가했다면 이 스크립트를 다시 돌려야 한다 —
추려낸 글꼴에 없는 글자는 네모로 뜬다.

    python3 tools/bundle-fonts.py

글꼴: Galmuri (SIL Open Font License 1.1) — https://github.com/quiple/galmuri
"""
import base64, os, re, subprocess, sys, tempfile

HERE  = os.path.dirname(os.path.abspath(__file__))
ROOT  = os.path.dirname(HERE)
HTML  = os.path.join(ROOT, 'DeepCovernant.html')
BASE  = 'https://cdn.jsdelivr.net/gh/quiple/galmuri/dist/'
FACES = ['Galmuri9', 'Galmuri11', 'Galmuri14', 'GalmuriMono9', 'GalmuriMono11']

MARK_A = '  /* ==== BUNDLED FONTS (tools/bundle-fonts.py 가 생성한다 — 직접 고치지 말 것) ==== */'
MARK_B = '  /* ==== /BUNDLED FONTS ==== */'

def used_chars(src):
    """HTML 전체에서 쓰인 문자. 넉넉하게 잡아도 원본 글꼴보다 한참 작다."""
    body = re.sub(MARK_A + r'.*?' + MARK_B, '', src, flags=re.S)   # 이전 번들은 제외
    chars = set(body)
    chars |= set(' 0123456789')
    chars |= set('abcdefghijklmnopqrstuvwxyz')
    chars |= set('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    chars |= set('·—…‘’“”×÷±°%()[]{}<>/\\|+-=~!?,.:;\'"#$&*@^_`')
    return {c for c in chars if c.isprintable() and ord(c) > 31}

def main():
    src = open(HTML, encoding='utf-8').read()
    keep = used_chars(src)
    print(f'추려낼 글자 {len(keep)}자')

    faces_css, total_raw, total_sub = [], 0, 0
    for face in FACES:
        # python 의 SSL 인증서 경로가 환경마다 달라 curl 로 받는다
        raw = subprocess.run(['curl', '-sSfL', BASE + face + '.woff2'],
                             check=True, capture_output=True).stdout
        total_raw += len(raw)
        with tempfile.TemporaryDirectory() as td:
            src_f = os.path.join(td, face + '.woff2')
            out_f = os.path.join(td, face + '.sub.woff2')
            open(src_f, 'wb').write(raw)
            subprocess.run([sys.executable, '-m', 'fontTools.subset', src_f,
                            '--text=' + ''.join(sorted(keep)),
                            '--flavor=woff2', '--layout-features=*',
                            '--output-file=' + out_f], check=True,
                           stdout=subprocess.DEVNULL)
            sub = open(out_f, 'rb').read()
        total_sub += len(sub)
        print(f'  {face:<15} {len(raw)//1024:>4} KB → {len(sub)//1024:>3} KB')
        b64 = base64.b64encode(sub).decode()
        faces_css.append(
            "  @font-face{font-family:'%s';font-style:normal;font-weight:400;"
            "font-display:block;src:url(data:font/woff2;base64,%s) format('woff2');}" % (face, b64))

    print(f'  합계            {total_raw//1024:>4} KB → {total_sub//1024:>3} KB')

    block = MARK_A + '\n' + '\n'.join(faces_css) + '\n' + MARK_B
    if MARK_A in src:
        src = re.sub(re.escape(MARK_A) + r'.*?' + re.escape(MARK_B), lambda _: block, src, flags=re.S)
    else:
        src = src.replace('<style>', '<style>\n' + block, 1)
    open(HTML, 'w', encoding='utf-8').write(src)
    print('DeepCovernant.html 갱신')

if __name__ == '__main__':
    main()
