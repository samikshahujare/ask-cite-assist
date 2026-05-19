"""Download ~50 arXiv PDFs into data/pdfs/ for the eval corpus.

Usage: python scripts/scrape_pdfs.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx

from config import settings

# Recent influential papers across RAG / agents / LLM eval — handy default corpus
ARXIV_IDS = [
    "1706.03762",  # Attention Is All You Need
    "2005.11401",  # RAG
    "2106.09685",  # LoRA
    "2104.09864",  # RoFormer
    "2201.11903",  # Chain-of-thought
    "2210.03629",  # ReAct
    "2305.14283",  # HyDE
    "2307.09288",  # Llama 2
    "2310.11511",  # Self-RAG
    "2312.10997",  # RAG Survey
    "2401.04088",  # Mixtral
    "2305.06983",  # Lost in the Middle
    "2004.04906",  # DPR
    "2112.09118",  # GPL
    "2212.03533",  # InstructGPT eval
    "2305.18290",  # DPO
    "2310.06770",  # SWE-bench
    "2402.03620",  # Self-discover
    "2305.13245",  # ColBERTv2
    "2402.17463",  # GraphRAG
    "2310.16944",  # Long-Context survey
    "2305.10601",  # Tree of Thoughts
    "2308.08155",  # AutoGen
    "2308.07107",  # LLM survey
    "2402.00159",  # Reflexion
    "2402.06196",  # LLM-as-judge
    "2306.05685",  # MT-Bench
    "2009.03300",  # MMLU
    "1809.09600",  # HotpotQA
    "2104.08663",  # BEIR
    "2308.03281",  # FaR / faithfulness
    "2402.05131",  # Tool use survey
    "2401.10020",  # Self-Rewarding LMs
    "2310.03714",  # DSPy
    "2305.15334",  # Gorilla
    "2308.10792",  # AgentBench
    "2309.07864",  # Survey of LLM Agents
    "2210.11416",  # FLAN-T5
    "2308.12950",  # Code Llama
    "2402.09353",  # DoRA
    "2402.03667",  # Mamba LLM eval
    "2312.06585",  # Beyond next-token
    "2305.04388",  # TKG-LLM
    "2305.06983",  # (duplicate guard ok)
    "2404.16130",  # GraphRAG MS
    "2310.06825",  # Mistral 7B
    "2404.05961",  # Eagle / hybrid models
    "2401.03462",  # Long ctx LLM
    "2311.16989",  # Multi-LoRA
    "2402.10193",  # FiD-light
]


def main():
    out_dir = settings.data_path / "pdfs"
    out_dir.mkdir(parents=True, exist_ok=True)
    ok = 0
    for aid in ARXIV_IDS:
        path = out_dir / f"{aid}.pdf"
        if path.exists():
            print(f"skip  {aid} (exists)")
            ok += 1
            continue
        url = f"https://arxiv.org/pdf/{aid}.pdf"
        try:
            r = httpx.get(url, timeout=30, follow_redirects=True)
            r.raise_for_status()
            path.write_bytes(r.content)
            print(f"saved {aid}  ({len(r.content)//1024} KB)")
            ok += 1
            time.sleep(1.0)  # be polite
        except Exception as e:
            print(f"fail  {aid}: {e}")
    print(f"\nDone. {ok}/{len(ARXIV_IDS)} PDFs in {out_dir}")
    print("Next: start the API, then POST those PDFs to /upload, or call rag.ingest.ingest_pdf_paths().")


if __name__ == "__main__":
    main()