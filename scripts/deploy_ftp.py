#!/usr/bin/env python3
"""
本番サーバー（エックスサーバー）へ FTP でアップロードするスクリプト

使い方（プロジェクトのフォルダで実行）:
    FTP_HOST=sv14315.xserver.jp FTP_USER=ユーザー名 FTP_PASS=パスワード \
    python3 scripts/deploy_ftp.py

  --dry-run   接続してリモートの構成を表示するだけ（何も上げない）
  --no-backup バックアップを省略する（通常は付けない）

動作:
  1. FTPS（FTP over TLS）で接続
  2. リモートの public_html を探す（FTP_REMOTE_DIR で明示も可）
  3. 上書き対象（index.html, css/, js/, img/）をローカルの backup/ に日付付きで保存
  4. ローカルの index.html, css/, js/, img/ をアップロード（同名は上書き）

パスワードは環境変数で渡すだけで、ファイルには保存しない。
"""
import os
import sys
import time
from ftplib import FTP_TLS, error_perm

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = ["index.html", "css", "js", "img"]
DOMAIN = "aile-personalbodycaresalon.com"


def connect():
    host = os.environ.get("FTP_HOST", "").strip()
    user = os.environ.get("FTP_USER", "").strip()
    password = os.environ.get("FTP_PASS", "")
    if not (host and user and password):
        raise SystemExit(
            "✗ 接続情報が足りません。次の形で実行してください:\n"
            "  FTP_HOST=ホスト名 FTP_USER=ユーザー名 FTP_PASS=パスワード python3 scripts/deploy_ftp.py"
        )
    ftp = FTP_TLS(timeout=60)
    ftp.connect(host, 21)
    ftp.login(user, password)
    ftp.prot_p()  # データ通信も暗号化
    ftp.set_pasv(True)
    return ftp


def find_public_html(ftp):
    explicit = os.environ.get("FTP_REMOTE_DIR", "").strip()
    if explicit:
        return explicit
    # エックスサーバーの典型: /<ドメイン>/public_html  または ログイン直下が public_html
    candidates = [f"/{DOMAIN}/public_html", f"{DOMAIN}/public_html", "/public_html", "public_html"]
    for c in candidates:
        try:
            ftp.cwd(c)
            path = ftp.pwd()
            ftp.cwd("/")
            return path
        except error_perm:
            continue
    raise SystemExit(
        "✗ public_html が見つかりません。ログイン直下の一覧:\n  " + "\n  ".join(ftp.nlst()) +
        "\n  → FTP_REMOTE_DIR=/正しいパス を付けて再実行してください"
    )


def is_dir(ftp, name):
    cur = ftp.pwd()
    try:
        ftp.cwd(name)
        ftp.cwd(cur)
        return True
    except error_perm:
        return False


def download_tree(ftp, remote_name, local_path):
    if is_dir(ftp, remote_name):
        os.makedirs(local_path, exist_ok=True)
        ftp.cwd(remote_name)
        for entry in ftp.nlst():
            if entry in (".", ".."):
                continue
            download_tree(ftp, entry, os.path.join(local_path, entry))
        ftp.cwd("..")
    else:
        with open(local_path, "wb") as f:
            ftp.retrbinary(f"RETR {remote_name}", f.write)


def upload_tree(ftp, local_path, remote_name, log):
    if os.path.isdir(local_path):
        try:
            ftp.mkd(remote_name)
        except error_perm:
            pass  # すでにある
        ftp.cwd(remote_name)
        for entry in sorted(os.listdir(local_path)):
            if entry.startswith("."):
                continue
            upload_tree(ftp, os.path.join(local_path, entry), entry, log)
        ftp.cwd("..")
    else:
        with open(local_path, "rb") as f:
            ftp.storbinary(f"STOR {remote_name}", f)
        log.append(remote_name)
        print(f"  ↑ {ftp.pwd()}/{remote_name}")


def main():
    dry_run = "--dry-run" in sys.argv
    do_backup = "--no-backup" not in sys.argv

    ftp = connect()
    print(f"✓ 接続しました: {ftp.host}")
    remote_dir = find_public_html(ftp)
    ftp.cwd(remote_dir)
    print(f"✓ アップロード先: {remote_dir}")
    print("  現在の中身:", ", ".join(sorted(n for n in ftp.nlst() if n not in ('.', '..'))))

    if dry_run:
        print("\n[DRY RUN] 何もアップロードしていません。")
        ftp.quit()
        return

    if do_backup:
        stamp = time.strftime("%Y%m%d-%H%M%S")
        backup_dir = os.path.join(PROJECT_DIR, "backup", f"production-{stamp}")
        print(f"\n== バックアップ → {backup_dir}")
        existing = ftp.nlst()
        for name in TARGETS:
            if name in existing:
                download_tree(ftp, name, os.path.join(backup_dir, name))
                print(f"  ↓ {name}")
        ftp.cwd(remote_dir)

    print("\n== アップロード")
    uploaded = []
    for name in TARGETS:
        upload_tree(ftp, os.path.join(PROJECT_DIR, name), name, uploaded)
        ftp.cwd(remote_dir)

    ftp.quit()
    print(f"\n完了。{len(uploaded)} ファイルをアップロードしました。")
    print(f"→ https://{DOMAIN}/ を開いて確認してください（キャッシュが残る場合はスーパーリロード）")


if __name__ == "__main__":
    main()
