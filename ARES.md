# ARES: Automated AI Research & Evolution System
**Elevate 1.0 Hackathon — Problem Statement 03 Unified Master Plan**

> **AI INSTRUCTIONS for Teammate's LLM:** 
> You are acting as an expert developer assisting a hackathon team member. Read this entire architectural document to understand the global context. Then, focus ONLY on the specific Member Module assigned to the user. Do not write code for other modules to prevent git merge conflicts. Adhere strictly to the defined API contracts.

---

## 🎯 1. Executive Summary & Core Objective

Machine learning research is fragmented across papers, configurations, datasets, dependencies, and compute environments. Traditional AI tools act as static chat widgets, failing to handle full scientific loops, runtime debugging, and experimental validation.

**ARES** is an autonomous, self-evolving multi-agent ecosystem that converts research inputs into verified experimental findings. It ingests papers, dynamically spawns specialized sub-agents, executes PyTorch code in isolated sandboxes, auto-debugs runtime errors, runs "what-if" extensions, and produces publication-ready IEEE/NeurIPS LaTeX papers with embedded vector charts.

---

## 🏗️ 2. Integrated Tech Stack & Architecture

```text
                       ┌─────────────────────────────────────────┐
                       │       NEXT.JS DASHBOARD (FOR UI)        │
                       │  • Live Agent Graph   • Conversation    │
                       │  • Real-Time Logs     • Stop Button     │
                       └────────────────────┬────────────────────┘
                                            │ Webhook Trigger
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           n8n CENTRAL AGENT / ORCHESTRATOR                              │
│                                                                                         │
│   ┌─────────────────────┐   ┌──────────────────────┐   ┌────────────────────────────┐   │
│   │  Paper Reader /     │   │ Dynamic Spawner      │   │ Proactive ArXiv Radar      │   │
│   │  Vision Agent       │   │ (Task Decomposition) │   │ (Cron / Background Loop)   │   │
│   └──────────┬──────────┘   └──────────┬───────────┘   └────────────┬───────────────┘   │
│              │                         │                            │                   │
│              └─────────────────────────┼────────────────────────────┘                   │
│                                        │                                                │
│                                        ▼                                                │
│   ┌─────────────────────┐   ┌──────────────────────┐   ┌────────────────────────────┐   │
│   │ Coding Agent        │   │ Debugging / Self-    │   │ Drafter Agent              │   │
│   │ (Edits train.py)    │   │ Healing Agent        │   │ (LaTeX Report Format)      │   │
│   └─────────────────────┘   └──────────────────────┘   └────────────────────────────┘   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST API / E2B SDK
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           E2B ISOLATED EXECUTION SANDBOX                                │
│                                                                                         │
│   • Locked Evaluation Contract: `prepare.py` (Immutable dataset & metric pipeline)      │
│   • Editable File: `train.py` (Modified by Coding Agent)                                │
│   • Git-Gated Rollback: Auto-commit pre-run; `git reset --hard` if loss regresses       │
│   • Logs Saver: Persists stdout, stderr, run metrics, and SQLite persistent memory      │
└─────────────────────────────────────────────────────────────────────────────────────────┘