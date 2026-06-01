"""
Retrieval-augmented Q&A over a project's knowledge graph.

Retrieval is lexical (no embedding infra, so it stays free and light on Render's
tier): entities are ranked by how well their name/description match the question,
boosted by graph centrality. Groq then answers grounded in the retrieved nodes;
without a key it falls back to a template answer. Either way the retrieved node
ids are returned so the frontend can highlight them on the graph.
"""
from __future__ import annotations
import os
import re

_MODEL = "llama-3.3-70b-versatile"
_TOP_K = 10

_STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
    "what", "which", "who", "how", "why", "when", "where", "does", "do", "can",
    "with", "about", "this", "that", "these", "those", "from", "into", "between",
    "their", "there", "they", "it", "its", "as", "by", "be", "has", "have",
}

_SYSTEM = (
    "You answer questions for a product researcher using ONLY the provided "
    "knowledge-graph context. If the context does not contain the answer, say so "
    "plainly. Be concise (3-5 sentences) and do not invent entities."
)


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) > 2 and t not in _STOP]


def retrieve(entities: list, question: str, k: int = _TOP_K) -> list:
    q_tokens = set(_tokens(question))
    if not q_tokens:
        return sorted(entities, key=lambda e: e.degree or 0.0, reverse=True)[:k]

    scored = []
    for e in entities:
        name = (e.name or "").lower()
        desc = (e.description or "").lower()
        score = 0.0
        for t in q_tokens:
            if t in name:
                score += 3.0
            if t in desc:
                score += 1.0
        if score > 0:
            score += min(e.degree or 0.0, 1.0)  # gentle centrality tiebreak
            scored.append((score, e))

    if not scored:
        return sorted(entities, key=lambda e: e.degree or 0.0, reverse=True)[:k]

    scored.sort(key=lambda x: x[0], reverse=True)
    return [e for _, e in scored[:k]]


def answer_question(project, entities: list, question: str) -> dict:
    top = retrieve(entities, question)
    context = "\n".join(
        f"- {e.name} ({e.type}): {(e.description or 'no description')[:200]}"
        for e in top
    )

    answer = _ai_answer(project.topic, question, context)
    if not answer:
        answer = _template_answer(question, top)

    return {
        "answer": answer,
        "highlighted_nodes": [e.id for e in top],
        "sources": [{"id": e.id, "name": e.name, "type": e.type} for e in top[:8]],
    }


def _ai_answer(topic: str, question: str, context: str) -> str | None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=api_key, timeout=20.0)
        response = client.chat.completions.create(
            model=_MODEL,
            max_tokens=512,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": (
                    f'Domain: "{topic}".\n\n'
                    f"Knowledge-graph context:\n{context}\n\n"
                    f"Question: {question}"
                )},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        print(f"[qa] groq error: {exc}")
        return None


def _template_answer(question: str, top: list) -> str:
    if not top:
        return "There isn't enough in this graph to answer that yet. Try building or uploading more data."
    names = ", ".join(e.name for e in top[:5])
    return (
        f"The most relevant parts of the graph for your question are: {names}. "
        f"Select a highlighted node to read its description and connections. "
        f"(Set a GROQ_API_KEY to get a written answer synthesised from these.)"
    )
