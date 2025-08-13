#!/usr/bin/env python3
import os, argparse, requests, pathlib, re

def parse_issue(md_path: pathlib.Path):
    text = md_path.read_text(encoding='utf-8')
    lines = text.splitlines()
    title = re.sub(r'^#\s*', '', lines[0]).strip()
    labels = []
    m = re.search(r'Labels:\*\*\s*(.+?)\s*\•', text) or re.search(r'Labels:\s*(.+)', text)
    if m:
        labels = [l.strip() for l in re.split(r'[;,]', m.group(1)) if l.strip()]
    body = text
    return title, labels, body

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True, help='owner/repo')
    ap.add_argument('--dir', default='docs/issues', help='directory with .md issues')
    ap.add_argument('--label', default='mvp', help='extra label to apply to all issues')
    args = ap.parse_args()
    token = os.getenv('GITHUB_TOKEN')
    if not token: raise SystemExit('GITHUB_TOKEN env var is required')
    owner, repo = args.repo.split('/')
    s = requests.Session()
    s.headers.update({'Authorization': f'token {token}', 'Accept': 'application/vnd.github+json'})
    # ensure label exists
    s.post(f'https://api.github.com/repos/{owner}/{repo}/labels', json={'name': args.label})
    base = pathlib.Path(args.dir)
    for md in sorted(base.glob('D*.md')):
        title, labels, body = parse_issue(md)
        if args.label and args.label not in labels: labels.append(args.label)
        r = s.post(f'https://api.github.com/repos/{owner}/{repo}/issues', json={'title': title, 'body': body, 'labels': labels})
        print(('Created' if r.ok else 'Failed'), md.name, r.json().get('html_url', r.text))

if __name__ == '__main__':
    main()
