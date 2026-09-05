#!/usr/bin/env python3
"""
現在のサイト内容を microCMS に一括登録するスクリプト（初回移行用）

使い方（プロジェクトのフォルダで実行）:
    MICROCMS_WRITE_KEY=書き込み用キー python3 scripts/import_to_microcms.py

  --dry-run を付けると、何も送らずに登録予定の内容だけ表示する。

必要な準備:
  microCMS の「APIキー」で、一時的な書き込み用キーを1つ追加する。
    - デフォルト権限: GET と POST をオン
    - メディアのアップロード: オン
  登録が終わったら、そのキーは削除する（サイトに埋め込む読み取り専用キーとは別物）。

動作:
  1. img/ 内の写真をメディアとしてアップロード（同じファイルは1回だけ）
  2. TOP / ABOUT / COURSE / PHOTO に、下の DATA の内容を「公開」状態で作成
  3. すでに1件以上あるAPIはスキップ（二重登録を防ぐ）。上書きしたい場合は管理画面で先に削除

標準ライブラリだけで動く（追加インストール不要）。
"""
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

SERVICE_ID = "aile-salon"
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(PROJECT_DIR, "img")

# ---------------------------------------------------------------
# 登録する内容（docs/content-list.md と同じ）
# ---------------------------------------------------------------
DATA = {
    "top": [
        {"order": 1, "image": "fv1.jpg"},
        {"order": 2, "image": "fv2.jpg", "image_sp": "fv2_sp.jpg"},
        {"order": 3, "image": "fv3_h_new.jpg"},
        {"order": 4, "image": "fv4.jpg"},
        {"order": 5, "image": "fv5.jpg"},
    ],
    "about": [
        {"order": 1, "image": "tumbnail1_new.jpg",
         "title": "わんちゃん、お子様連れOK",
         "body": "AILEでは、わんちゃん・お子様連れでのトレーニング大歓迎です！育児等で忙しい 時間の合間もトレーニングができます。"},
        {"order": 2, "image": "tumbnail2_new.jpg",
         "title": "管理栄養士監修の\n栄養バランスのとれた食事提供",
         "body": "ボディメイクには、美味しく健康的な食事が大切。サロンではトレーニング後のお食事はもちろん、テイクアウトでのご提供も行っています。"},
        {"order": 3, "image": "tumbnail3_new.jpg",
         "title": "安心の整体ケア",
         "body": "トレーニングだけでなく、一気通貫で体のメンテナンスを行えるので安心！日常の疲れや不調もご相談ください(^-^)"},
        {"order": 4, "image": "tumbnail4_new.jpg",
         "title": "手ぶらで気軽にトレーニング",
         "body": "ウェア・シューズ等は貸出しも行っています。お出かけやお仕事の帰りに、気軽にお立ち寄りください♪"},
        {"order": 5, "image": "tumbnail5_new.jpg",
         "title": "パウダールーム・シャワーブース完備",
         "body": "女性に人気のReFa製品を取り揃えてます。トレーニング後シャワーもご利用可能です。ReFaやMEGRYなどの、美容商品でゆっくりとケアやお直しをしていただけます。"},
    ],
    "course": [
        {"order": 1, "name": "パーソナルトレーニング",
         "description": "月4回・8回など、ご自身のペースに合った回数でご利用いただけます。まずは1回のみ体験してみたい方も大歓迎ですので、お気軽にご相談ください。",
         "price": "￥16,000/月4回~"},
        {"order": 2, "name": "EMSトレーニング",
         "description": "EMSスーツを使用し、全身の筋肉への刺激を感じながらトレーニングを行います。運動が苦手な方や、短時間でより効果的なトレーニングをしたい方におすすめです。",
         "price": "￥15,000/月2回~"},
        {"order": 3, "name": "整体",
         "description": "ストレッチポールを使用した整体で体の歪みを整えたり、体の不調を取り除いていきます。トレーニングと合わせて行うことで、トレーニング効果も上がり、より効果を感じていただくことができます。",
         "price": "¥4,500/1回30分~"},
        {"order": 4, "name": "スタジオレッスン",
         "description": "素敵なトレーナーをお呼びし、ダンス、ピラティス、コンディショニング等様々なレッスンを行います。1レッスン毎のご参加が可能ですので、是非気軽に体験ください。また、回数券をご利用いただく事で、お得に通っていただけます。",
         "price": "￥2,000/1レッスン\n￥8,000/5レッスン（回数券）"},
        {"order": 5, "name": "食事提供",
         "description": "管理栄養士監修の、栄養バランスのとれたお食事をご利用いただけます。トレーニング後の食事提供、テイクアウト、トレーニングと食事提供がセットになったプランもご用意しております。お食事のみの利用も可能ですので、お気軽にお越しください。",
         "price": "¥1,000/1食"},
    ],
    "photo": [
        {"order": i, "image": name} for i, name in enumerate([
            "photo1.jpg", "photo2.jpg", "photo3.jpg", "photo4.jpg", "photo5_new.jpg",
            "photo6.jpg", "photo7.jpg", "photo8_new.jpg", "photo9.jpg", "photo10.jpg",
            "photo11_new.jpg", "photo12.jpg", "photo13.jpg", "photo14.jpg",
        ], start=1)
    ],
}
IMAGE_FIELDS = ("image", "image_sp")

# ---------------------------------------------------------------
# HTTP まわり
# ---------------------------------------------------------------
def request(method, url, key, body=None, content_type=None):
    headers = {
        "X-MICROCMS-API-KEY": key,
        # Python 標準の User-Agent は Cloudflare に弾かれる（403 error code 1010）ため明示する
        "User-Agent": "Mozilla/5.0 (Macintosh) aile-import/1.0",
    }
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        raise SystemExit(f"\n✗ {method} {url}\n  HTTP {e.code}: {raw}\n  → キーの権限（GET/POST/メディアのアップロード）を確認してください")


def count_contents(api, key):
    url = f"https://{SERVICE_ID}.microcms.io/api/v1/{api}?limit=1"
    _, body = request("GET", url, key)
    return body.get("totalCount", 0)


def upload_media(filename, key):
    path = os.path.join(IMG_DIR, filename)
    if not os.path.isfile(path):
        raise SystemExit(f"✗ 画像が見つかりません: {path}")
    if os.path.getsize(path) > 5 * 1024 * 1024:
        raise SystemExit(f"✗ 5MB を超えています: {filename}")
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    boundary = "----microcms" + uuid.uuid4().hex
    with open(path, "rb") as f:
        data = f.read()
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {mime}\r\n\r\n".encode(),
        data, b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ])
    url = f"https://{SERVICE_ID}.microcms-management.io/api/v1/media"
    _, res = request("POST", url, key, body, f"multipart/form-data; boundary={boundary}")
    return res["url"]


def create_content(api, payload, key):
    url = f"https://{SERVICE_ID}.microcms.io/api/v1/{api}"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    _, res = request("POST", url, key, body, "application/json")
    return res.get("id")


# ---------------------------------------------------------------
def main():
    dry_run = "--dry-run" in sys.argv
    key = os.environ.get("MICROCMS_WRITE_KEY", "").strip()
    if not dry_run and not key:
        raise SystemExit(
            "✗ 書き込み用キーが未指定です。次の形で実行してください:\n"
            "  MICROCMS_WRITE_KEY=キー python3 scripts/import_to_microcms.py"
        )

    print(f"サービス: {SERVICE_ID}   {'[DRY RUN: 送信しません]' if dry_run else ''}\n")

    uploaded = {}  # filename -> url

    def image_url(filename):
        if filename in uploaded:
            return uploaded[filename]
        if dry_run:
            uploaded[filename] = f"(dry) img/{filename}"
        else:
            uploaded[filename] = upload_media(filename, key)
            print(f"    ↑ 画像アップロード: {filename}")
            time.sleep(0.3)
        return uploaded[filename]

    for api, items in DATA.items():
        print(f"== {api.upper()} ({len(items)}件) ==")
        if not dry_run:
            existing = count_contents(api, key)
            if existing > 0:
                print(f"  すでに {existing} 件あるためスキップします（二重登録防止）\n")
                continue
        for item in items:
            payload = {}
            for field, value in item.items():
                if field in IMAGE_FIELDS:
                    payload[field] = image_url(value)
                else:
                    payload[field] = value
            label = item.get("name") or item.get("title", "").replace("\n", " ") or item.get("image")
            if dry_run:
                print(f"  - {label}")
            else:
                cid = create_content(api, payload, key)
                print(f"  ✓ 登録: {label}  (id: {cid})")
                time.sleep(0.3)
        print()

    print("完了。" if not dry_run else "確認のみ完了。--dry-run を外すと実際に登録します。")
    if not dry_run:
        print("→ 書き込み用キーは microCMS の管理画面から削除してください。")


if __name__ == "__main__":
    main()
