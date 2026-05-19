"""Run the eval set end-to-end through the graph and LLM judge.

Usage:
  python eval/run_eval.py            # uses eval/questions.jsonl
  python eval/run_eval.py path.jsonl
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents.planner import run_planner
from agents.researcher import run_researcher
from agents.writer import run_writer
from eval.judge import judge


def main(path: str = "eval/questions.jsonl"):
    qs = [json.loads(l) for l in Path(path).read_text(encoding="utf-8").splitlines() if l.strip()]
    results = []
    for i, q in enumerate(qs, 1):
        question = q["question"]
        t0 = time.time()
        try:
            plan = run_planner(question)
            res = run_researcher(plan)
            ans = run_writer(question, res.chunks)
            score = judge(question, ans.markdown, [c.text for c in res.chunks])
            row = {
                "i": i,
                "question": question,
                "latency_ms": int((time.time() - t0) * 1000),
                "citations": len(ans.citations),
                "faithfulness": score.faithfulness,
                "citation_accuracy": score.citation_accuracy,
            }
        except Exception as e:
            row = {"i": i, "question": question, "error": str(e)}
        print(json.dumps(row))
        results.append(row)

    out = Path("eval/results.json")
    out.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {out}  ({len(results)} rows)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "eval/questions.jsonl")