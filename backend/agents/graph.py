"""Deterministic LangGraph wiring: Planner -> Researcher -> Critic -> Writer.

No autonomous loops, no self-correction. Each node runs exactly once.
"""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from .schemas import GraphState
from .planner import run_planner
from .researcher import run_researcher
from .critic import run_critic
from .writer import run_writer


def _planner_node(state: GraphState) -> GraphState:
    state.plan = run_planner(state.query)
    return state


def _researcher_node(state: GraphState) -> GraphState:
    assert state.plan is not None
    res = run_researcher(state.plan)
    state.chunks = res.chunks
    return state


def _critic_node(state: GraphState) -> GraphState:
    state.critic = run_critic(state.query, state.chunks)
    return state


def _writer_node(state: GraphState) -> GraphState:
    state.answer = run_writer(state.query, state.chunks)
    return state


def build_graph():
    g = StateGraph(GraphState)
    g.add_node("planner", _planner_node)
    g.add_node("researcher", _researcher_node)
    g.add_node("critic", _critic_node)
    g.add_node("writer", _writer_node)

    g.set_entry_point("planner")
    g.add_edge("planner", "researcher")
    g.add_edge("researcher", "critic")
    g.add_edge("critic", "writer")
    g.add_edge("writer", END)
    return g.compile()


GRAPH = None


def get_graph():
    global GRAPH
    if GRAPH is None:
        GRAPH = build_graph()
    return GRAPH