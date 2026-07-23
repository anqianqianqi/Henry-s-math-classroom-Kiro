#!/usr/bin/env python3
"""
One-time TA bootstrap script.
Reads graded submissions from Supabase, sends them to GPT-4o,
writes TA-agent/grading-style.md and TA-agent/correction-log.md
"""

import json
import urllib.request
import urllib.error
import os
import sys
from datetime import datetime

# ── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL  = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://thgaokonzsabpvhfbfdy.supabase.co")
SERVICE_KEY   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
OPENAI_KEY    = os.environ.get("OPENAI_API_KEY", "")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

SB_HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def sb_get(path):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers=SB_HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def openai_chat(messages, max_tokens=2500):
    payload = json.dumps({
        "model": "gpt-4o",
        "messages": messages,
        "max_tokens": max_tokens,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["choices"][0]["message"]["content"]

# ── Fetch data ───────────────────────────────────────────────────────────────

print("Fetching graded submissions...")
submissions = sb_get(
    "challenge_submissions"
    "?select=id,content,points,submitted_at,challenge_id"
    "&points=not.is.null"
    "&order=submitted_at.desc"
    "&limit=200"
)
print(f"  Found {len(submissions)} graded submissions")

if not submissions:
    print("No graded submissions yet. Grade some first, then re-run.")
    sys.exit(1)

# Fetch challenge info
challenge_ids = list(set(s["challenge_id"] for s in submissions if s.get("challenge_id")))
print(f"Fetching {len(challenge_ids)} challenges...")
challenges_raw = []
# Fetch in batches of 50 to avoid URL length limits
for i in range(0, len(challenge_ids), 50):
    batch = challenge_ids[i:i+50]
    ids_param = "(" + ",".join(f'"{cid}"' for cid in batch) + ")"
    chunk = sb_get(
        f"daily_challenges?select=id,title,description&id=in.{ids_param}"
    )
    challenges_raw.extend(chunk)

challenge_map = {c["id"]: c for c in challenges_raw}
print(f"  Found {len(challenge_map)} challenges")

# Fetch teacher comments
sub_ids = [s["id"] for s in submissions]
print(f"Fetching comments for {len(sub_ids)} submissions...")
comments_raw = []
for i in range(0, len(sub_ids), 50):
    batch = sub_ids[i:i+50]
    ids_param = "(" + ",".join(f'"{sid}"' for sid in batch) + ")"
    chunk = sb_get(
        f"submission_comments?select=submission_id,content,created_at"
        f"&submission_id=in.{ids_param}"
        f"&order=created_at.asc"
    )
    comments_raw.extend(chunk)

comment_map = {}
for c in comments_raw:
    sid = c["submission_id"]
    comment_map.setdefault(sid, []).append(c["content"])
print(f"  Found {len(comments_raw)} comments across {len(comment_map)} submissions")

# ── Build examples ────────────────────────────────────────────────────────────

examples = []
for s in submissions:
    ch = challenge_map.get(s.get("challenge_id"))
    if not ch:
        continue
    examples.append({
        "challenge_title":       ch.get("title", ""),
        "challenge_description": (ch.get("description") or "")[:200],
        "submission":            (s.get("content") or "")[:400],
        "score":                 s["points"],
        "teacher_comments":      comment_map.get(s["id"], []),
    })

print(f"\nBuilding training set from {len(examples)} examples "
      f"({sum(1 for e in examples if e['teacher_comments'])} with comments)...")

# ── Generate grading-style.md ─────────────────────────────────────────────────

sample = examples[:60]
ex_text = "\n\n---\n\n".join(
    "\n".join(filter(None, [
        f"[Example {i+1}]",
        f"Problem: {e['challenge_title']}",
        f"Context: {e['challenge_description']}" if e['challenge_description'] else None,
        f"Submission: {e['submission']}",
        f"Score: {e['score']} points",
        f"Teacher comments: {' | '.join(e['teacher_comments'])}" if e['teacher_comments'] else "(no comments)",
    ]))
    for i, e in enumerate(sample)
)

print("\nCalling GPT-4o to generate grading-style.md (this may take ~30s)...")
grading_style = openai_chat([
    {
        "role": "system",
        "content": (
            "You are analyzing a math teacher's grading history to infer their grading philosophy.\n"
            "You will receive examples of student submissions with scores and optional feedback comments.\n"
            "Write a clear, specific grading style guide for an AI assistant that will grade on this teacher's behalf.\n\n"
            "Output markdown with these sections:\n"
            "## Philosophy\n"
            "## Point Distribution Guidelines\n"
            "## Partial Credit Rules\n"
            "## How the Teacher Uses Comments\n"
            "## What Leads to Higher Scores\n"
            "## What Leads to Deductions\n\n"
            "Be specific — cite patterns actually observed. Write as 'this teacher' explaining their style."
        ),
    },
    {
        "role": "user",
        "content": f"Analyze these {len(sample)} graded examples and write the grading style guide:\n\n{ex_text}",
    },
])

today = datetime.now().strftime("%Y-%m-%d")
grading_style_full = "\n".join([
    "# Henry's Grading Style Guide",
    "",
    f"> Auto-generated on {today} from {len(examples)} graded submissions.",
    "> Review and edit anything that looks wrong.",
    "",
    "---",
    "",
    grading_style,
])

# ── Build correction-log.md ───────────────────────────────────────────────────

with_comments = [e for e in examples if e["teacher_comments"]][:120]

if with_comments:
    entries = "\n\n---\n\n".join(
        "\n".join([
            f"### Example #{i+1} — Bootstrapped {today}",
            f"**Problem**: {e['challenge_title']}",
            f"**Student submission**: {e['submission'][:500]}{'…' if len(e['submission']) > 500 else ''}",
            f"**Henry's grade**: {e['score']} points",
            f"**Henry's comments**: {' | '.join(e['teacher_comments'])}",
        ])
        for i, e in enumerate(with_comments)
    )
    correction_log = "\n".join([
        "# Correction Log",
        "",
        "The ground truth the AI learns from. Bootstrapped from existing graded submissions.",
        "New entries are added automatically when Henry overrides an AI grade.",
        "",
        "---",
        "",
        entries,
    ])
else:
    correction_log = "# Correction Log\n\n*(Will grow as Henry reviews AI grades)*\n"

# ── Write files ───────────────────────────────────────────────────────────────

style_path = os.path.join(SCRIPT_DIR, "grading-style.md")
log_path   = os.path.join(SCRIPT_DIR, "correction-log.md")

with open(style_path, "w", encoding="utf-8") as f:
    f.write(grading_style_full)

with open(log_path, "w", encoding="utf-8") as f:
    f.write(correction_log)

print(f"\n✅ Done!")
print(f"   Written: {style_path}")
print(f"   Written: {log_path}")
print(f"\n   Examples used:          {len(examples)}")
print(f"   Examples with comments:  {len(with_comments)}")
print(f"\nNext steps:")
print(f"  1. Review TA-agent/grading-style.md — edit anything that looks wrong")
print(f"  2. git add TA-agent/grading-style.md TA-agent/correction-log.md")
print(f"  3. git commit -m 'TA bootstrap: initial grading knowledge'")
print(f"  4. git push")
