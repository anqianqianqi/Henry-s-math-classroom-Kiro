#!/usr/bin/env python3
"""
Evaluate how well the current grading-style.md + correction-log.md
lets the TA reproduce Henry's grades.

Picks test cases from the correction log that have text submissions
(not image-only), grades them using only the knowledge files,
then compares AI grade vs Henry's actual grade.
"""

import json, urllib.request, os, re

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def read(filename):
    with open(os.path.join(SCRIPT_DIR, filename), encoding="utf-8") as f:
        return f.read()

def openai_chat(messages, max_tokens=800):
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
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["choices"][0]["message"]["content"]

# ── Load knowledge files ──────────────────────────────────────────────────────
grading_style = read("grading-style.md")
correction_log = read("correction-log.md")
math_correctness = read("math-correctness.md") if os.path.exists(os.path.join(SCRIPT_DIR, "math-correctness.md")) else ""

# ── Test cases (picked from correction-log: text submissions only) ───────────
# Format: (problem_title, student_submission, henry_grade, max_points)
TEST_CASES = [
    (
        "方程化简3",
        "a可以是大于等于1并且小于等于3的整数\n因为 a-1 a-2 a-3 里面肯定有一个等于零\n1-1=0\n2-2=0\n3-3=0",
        3, 3
    ),
    (
        "方程化简 4",
        "等式两边直接都除以b\na-1=1\na=2\n（2-1）*b=b\nb=b\nb可以等于任何数",
        2, 3
    ),
    (
        "找找角度10",
        "Ok so angle EMC > 45 degrees because angle BME is less then 135 degrees.",
        1, 5
    ),
    (
        "加法與數線 2",
        "4=\n4\n2+1+1\n1+2+1\n1+1+2\n3+1\n1+3\n2+2\n1+1+1+1",
        3, 3
    ),
    (
        "方程化简3",
        "when a-1 =o a = 1\n(1-1)x(1-2)x(1-3)=0 it s possible\nWhen a-2 =0 a=2\n(2-1)x(2-2)x(2-3)=o it's possible\nWhen a-3=0 a=3\n(3-1)x(3-2)x(3-3)= o it's possible\nSo a equal to 1,2,3",
        3, 3
    ),
    (
        "符号系统 2",
        "3进制大",
        3, 3
    ),
    (
        "符号系统 1",
        "8430",
        2, 3
    ),
    (
        "符号系统 1",
        "8437",
        2, 3
    ),
]

SYSTEM_PROMPT = f"""You are a math teaching assistant grading student submissions exactly like Henry, the teacher.

Read the grading style guide carefully and use it to grade each submission.
You also have access to a correction log with real examples of Henry's grades.

GRADING STYLE GUIDE:
{grading_style}

CORRECTION LOG (real examples of Henry's grades):
{correction_log[:3000]}

{'MATH CORRECTNESS RULES:' + math_correctness if math_correctness else ''}

When grading:
1. Read the problem and student submission carefully
2. Apply the grading style guide
3. Look for similar examples in the correction log
4. Output ONLY a JSON object: {{"score": <number>, "max": <number>, "reasoning": "<1-2 sentences>"}}
"""

print("=" * 60)
print("TA GRADING QUALITY EVALUATION")
print("Testing: does the current knowledge base reproduce Henry's grades?")
print("=" * 60)

exact_matches = 0
within_one = 0
total = len(TEST_CASES)
results = []

for i, (problem, submission, henry_score, max_pts) in enumerate(TEST_CASES):
    user_msg = f"Problem: {problem}\nMax points: {max_pts}\nStudent submission:\n{submission}"

    try:
        response = openai_chat([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ])

        # Parse JSON from response
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            result = json.loads(match.group())
            ai_score = result.get("score", "?")
            reasoning = result.get("reasoning", "")
        else:
            ai_score = "parse error"
            reasoning = response[:100]

        match_exact = ai_score == henry_score
        match_close = isinstance(ai_score, (int, float)) and abs(ai_score - henry_score) <= 1

        if match_exact: exact_matches += 1
        if match_close: within_one += 1

        status = "✅ EXACT" if match_exact else ("~OK" if match_close else "❌ OFF")
        print(f"\n[{i+1}] {problem}")
        print(f"  Submission: {submission[:80]}{'...' if len(submission) > 80 else ''}")
        print(f"  Henry: {henry_score}/{max_pts}  |  AI: {ai_score}/{max_pts}  |  {status}")
        print(f"  AI reasoning: {reasoning}")
        results.append((problem, henry_score, ai_score, match_exact, match_close))

    except Exception as e:
        print(f"\n[{i+1}] ERROR: {e}")

print("\n" + "=" * 60)
print(f"RESULTS: {exact_matches}/{total} exact matches, {within_one}/{total} within 1 point")
print(f"Exact accuracy: {exact_matches/total*100:.0f}%")
print(f"Close accuracy: {within_one/total*100:.0f}%")
print("=" * 60)

if exact_matches / total < 0.7:
    print("\n⚠️  Accuracy below 70% — knowledge base needs improvement.")
    print("Suggested improvements:")
    print("  1. Add specific score-to-quality mappings to grading-style.md")
    print("  2. Add more concrete examples for each score level")
    print("  3. Henry should manually annotate what makes a 1 vs 2 vs 3 point answer")
else:
    print("\n✅ Knowledge base is performing well!")
