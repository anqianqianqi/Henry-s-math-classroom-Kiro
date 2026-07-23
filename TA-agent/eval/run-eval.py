#!/usr/bin/env python3
"""
Accuracy evaluation for the TA grading agent on equation-solving problems.

Usage:
  # Set env vars first
  export NEXT_PUBLIC_SUPABASE_URL=...
  export SUPABASE_SERVICE_ROLE_KEY=...
  export OPENAI_API_KEY=...
  export BOOTSTRAP_SECRET=your-secret-here

  # Run against beta deployment
  python3 TA-agent/eval/run-eval.py --url https://your-site.vercel.app

  # Or against local dev server
  python3 TA-agent/eval/run-eval.py --url http://localhost:3000

Results are printed and saved to TA-agent/eval/baselines.json
"""

import json
import os
import sys
import urllib.request
import urllib.error
import argparse
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_CASES_PATH = os.path.join(SCRIPT_DIR, 'equation-solving-test-cases.json')
BASELINES_PATH  = os.path.join(SCRIPT_DIR, 'baselines.json')

def call_grade_api(base_url: str, secret: str, submission_id_placeholder: str,
                   problem_title: str, problem_description: str,
                   student_submission: str, max_points: int) -> dict:
    """
    Calls /api/ta/grade with a synthetic submission.
    Since we can't insert real DB rows, we use a test endpoint that accepts
    direct problem/submission text instead of a submission_id.
    Falls back to calling the real endpoint with a known submission_id if provided.
    """
    # Use the direct-text test endpoint
    payload = json.dumps({
        "test_mode": True,
        "problem_title": problem_title,
        "problem_description": problem_description,
        "student_submission": student_submission,
        "max_points": max_points,
    }).encode()

    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/ta/grade",
        data=payload,
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

def run_evaluation(base_url: str, secret: str) -> dict:
    with open(TEST_CASES_PATH, encoding='utf-8') as f:
        test_cases = json.load(f)

    print(f"\n{'='*60}")
    print(f"TA ACCURACY EVALUATION — Equation Solving")
    print(f"Test cases: {len(test_cases)}")
    print(f"Endpoint: {base_url}")
    print(f"{'='*60}\n")

    results = []
    exact_matches = 0
    within_one = 0
    errors = 0

    for i, tc in enumerate(test_cases):
        print(f"[{i+1}/{len(test_cases)}] {tc['id']} — {tc['problem_title']}")
        print(f"  Submission: {tc['student_submission'][:60]}{'...' if len(tc['student_submission']) > 60 else ''}")
        print(f"  Henry's grade: {tc['henry_grade']}/{tc['max_points']}")

        try:
            response = call_grade_api(
                base_url, secret,
                tc['id'],
                tc['problem_title'],
                tc.get('problem_description', ''),
                tc['student_submission'],
                tc['max_points'],
            )

            if not response.get('ok'):
                print(f"  ❌ API error: {response.get('error', 'unknown')}")
                errors += 1
                results.append({'id': tc['id'], 'status': 'error', 'error': response.get('error')})
                continue

            grade = response.get('grade', {})
            ai_score = grade.get('suggested_score')
            henry_score = tc['henry_grade']

            exact = ai_score == henry_score
            close = abs(ai_score - henry_score) <= 1 if isinstance(ai_score, (int, float)) else False

            if exact: exact_matches += 1
            if close: within_one += 1

            status = "✅ EXACT" if exact else ("~OK" if close else "❌ OFF")
            print(f"  AI grade: {ai_score}/{tc['max_points']}  |  {status}")
            if grade.get('reasoning', {}).get('step3_deviation'):
                print(f"  TA deviation: {grade['reasoning']['step3_deviation'][:80]}")
            if grade.get('anqi') and grade['anqi'].get('comment_assessment'):
                print(f"  Anqi review: {grade['anqi']['comment_assessment']}")

            results.append({
                'id': tc['id'],
                'problem_title': tc['problem_title'],
                'henry_grade': henry_score,
                'ai_grade': ai_score,
                'max_points': tc['max_points'],
                'exact_match': exact,
                'within_one': close,
                'failed_at_step': grade.get('failed_at_step'),
                'topic_module_used': grade.get('topic_module_used'),
                'ai_comment': grade.get('comment', ''),
                'anqi_assessment': grade.get('anqi', {}).get('comment_assessment') if grade.get('anqi') else None,
            })

        except Exception as e:
            print(f"  ❌ Exception: {e}")
            errors += 1
            results.append({'id': tc['id'], 'status': 'exception', 'error': str(e)})

        print()

    total = len(test_cases)
    graded = total - errors
    exact_pct = round(exact_matches / graded * 100, 1) if graded > 0 else 0
    close_pct = round(within_one / graded * 100, 1) if graded > 0 else 0

    print('='*60)
    print(f"RESULTS")
    print(f"  Total cases: {total}")
    print(f"  Graded successfully: {graded}")
    print(f"  Errors: {errors}")
    print(f"  Exact match: {exact_matches}/{graded} = {exact_pct}%")
    print(f"  Within 1 point: {within_one}/{graded} = {close_pct}%")
    print(f"  Gate (95% exact): {'✅ PASSED' if exact_pct >= 95 else '❌ NOT YET'}")
    print('='*60)

    # Show failures grouped
    failures = [r for r in results if r.get('exact_match') is False]
    if failures:
        print(f"\nFailed cases ({len(failures)}):")
        for f in failures:
            print(f"  {f['id']}: Henry={f['henry_grade']}, AI={f['ai_grade']} | step={f.get('failed_at_step', 'n/a')}")

    # Save baseline
    baseline = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "topic": "equation-solving",
        "model": "gpt-4o",
        "endpoint": base_url,
        "dataset_size": graded,
        "exact_accuracy": exact_pct,
        "within_one_accuracy": close_pct,
        "errors": errors,
        "passed_gate": exact_pct >= 95,
        "results": results,
    }

    with open(BASELINES_PATH, encoding='utf-8') as f:
        existing = json.load(f)
    existing.append(baseline)
    with open(BASELINES_PATH, 'w', encoding='utf-8') as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)

    print(f"\nBaseline saved to {BASELINES_PATH}")
    return baseline


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='https://henry-s-math-classroom-kiro-6nasvwiic.vercel.app',
                        help='Base URL of the deployment to test against')
    args = parser.parse_args()

    secret = os.environ.get('BOOTSTRAP_SECRET', '')
    if not secret:
        print("ERROR: BOOTSTRAP_SECRET env var not set")
        print("Set it with: export BOOTSTRAP_SECRET=your-secret")
        sys.exit(1)

    run_evaluation(args.url, secret)
