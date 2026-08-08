#!/usr/bin/env python3
"""
게임에 쓰이는 웹폰트를 화면에 실제로 쓰이는 글자만 추려 HTML 안에 박아 넣는다.

CDN 을 그대로 두면 비행기 모드에서 글꼴이 통째로 날아간다 — 앱으로 내려면
오프라인에서 돌아야 하므로 번들이 필수다. 다만 전부 통째로 넣으면 여러 MB,
base64 로는 그보다도 크다. 실제로 화면에 뜨는 글자만 남기면 그 몇십 분의 일이다.

새 한글 문구를 추가했다면 이 스크립트를 다시 돌려야 한다 —
추려낸 글꼴에 없는 글자는 네모로 뜬다.

    python3 tools/bundle-fonts.py

글꼴:
  - Galmuri (SIL Open Font License 1.1) — https://github.com/quiple/galmuri
  - Nanum Myeongjo / 나눔명조 (SIL Open Font License 1.1) — https://github.com/naver
    google/fonts 미러(OFL 원본 그대로 재배포)에서 받는다. 제목·카드 이름 등 명조체로
    쓰이는 자리(font-family:'Nanum Myeongjo')가 있는데 정작 번들에는 빠져 있어서
    그 글꼴이 없는 기기에서는 기본 세리프체로 조용히 대체되고 있었다 — 이 스크립트가
    Galmuri 와 같은 방식으로 함께 추려 넣는다.
"""
import base64, os, re, subprocess, sys, tempfile

HERE  = os.path.dirname(os.path.abspath(__file__))
ROOT  = os.path.dirname(HERE)
# 쓰이는 글자는 완성된 화면에서 모아야 빠짐이 없으므로 산출물을 읽고,
# 쓰기는 폰트 조각에만 한다 — 산출물에 쓰면 다음 빌드에 덮인다.
HTML  = os.path.join(ROOT, 'FathomOfAbyss.html')
FONTS = os.path.join(ROOT, 'src', 'styles', '00-fonts.css')

GALMURI_BASE = 'https://cdn.jsdelivr.net/gh/quiple/galmuri/dist/'
GALMURI_FACES = ['Galmuri9', 'Galmuri11', 'Galmuri14', 'GalmuriMono9', 'GalmuriMono11']

# (font-family 이름, 소스 URL, 원본 확장자) — 원본이 woff2 가 아니어도
# fontTools.subset 이 --flavor=woff2 로 그 자리에서 변환해 준다.
NANUM_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanummyeongjo/NanumMyeongjo-Regular.ttf'
EXTRA_FACES = [('Nanum Myeongjo', NANUM_URL, 'ttf')]

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

def subset_face(family, url, ext, keep):
    """URL에서 원본을 받아 쓰이는 글자만 남긴 woff2 base64 @font-face 규칙 하나를 만든다."""
    # python 의 SSL 인증서 경로가 환경마다 달라 curl 로 받는다
    raw = subprocess.run(['curl', '-sSfL', url], check=True, capture_output=True).stdout
    with tempfile.TemporaryDirectory() as td:
        src_f = os.path.join(td, 'src.' + ext)
        out_f = os.path.join(td, 'out.woff2')
        open(src_f, 'wb').write(raw)
        subprocess.run([sys.executable, '-m', 'fontTools.subset', src_f,
                        '--text=' + ''.join(sorted(keep)),
                        '--flavor=woff2', '--layout-features=*',
                        '--output-file=' + out_f], check=True,
                       stdout=subprocess.DEVNULL)
        sub = open(out_f, 'rb').read()
    print(f'  {family:<16} {len(raw)//1024:>4} KB → {len(sub)//1024:>3} KB')
    b64 = base64.b64encode(sub).decode()
    rule = ("  @font-face{font-family:'%s';font-style:normal;font-weight:400;"
            "font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');}" % (family, b64))
    return rule, len(raw), len(sub)

def main():
    src = open(HTML, encoding='utf-8').read()      # 글자 수집용(산출물)
    keep = used_chars(src)
    print(f'추려낼 글자 {len(keep)}자')

    faces_css, total_raw, total_sub = [], 0, 0
    for face in GALMURI_FACES:
        rule, raw_len, sub_len = subset_face(face, GALMURI_BASE + face + '.woff2', 'woff2', keep)
        faces_css.append(rule); total_raw += raw_len; total_sub += sub_len
    for family, url, ext in EXTRA_FACES:
        rule, raw_len, sub_len = subset_face(family, url, ext, keep)
        faces_css.append(rule); total_raw += raw_len; total_sub += sub_len

    print(f'  합계             {total_raw//1024:>4} KB → {total_sub//1024:>3} KB')

    block = MARK_A + '\n' + '\n'.join(faces_css) + '\n' + MARK_B
    frag = open(FONTS, encoding='utf-8').read()
    if MARK_A in frag:
        src = re.sub(re.escape(MARK_A) + r'.*?' + re.escape(MARK_B), lambda _: block, frag, flags=re.S)
    else:
        src = src.replace('<style>', '<style>\n' + block, 1)
    open(FONTS, 'w', encoding='utf-8').write(src if src.endswith('\n') else src + '\n')
    print('src/styles/00-fonts.css 갱신 — 반영하려면 python3 tools/build.py')

if __name__ == '__main__':
    main()
