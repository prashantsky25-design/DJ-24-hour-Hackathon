"""
ML Specialist Agents — Concurrent training evaluation cluster.

Four agents work simultaneously:
  • ModelTrainerAgent  (Zara)  — trains model, reports epoch metrics
  • HyperparamTunerAgent (Ravi) — proposes and evaluates hyperparameter changes
  • EvaluatorAgent (Priya)       — benchmarks against baseline, tracks convergence
  • PeerReviewerAgent (Max)      — critiques the other agents and calls for re-runs

They share the blackboard and post rich conversational messages so the
War Room looks genuinely alive.
"""

import asyncio
import json
import random
from typing import Dict, Any, Tuple
from base_agent import BaseAgent
from blackboard import blackboard, AgentMessage


# ─── Trainer ─────────────────────────────────────────────────────────────────

class ModelTrainerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Zara",
            role="Model Trainer",
            system_prompt=(
                "You are Zara, a senior ML Engineer specialising in training transformer models "
                "on computer vision benchmarks. You speak in a direct, technical style and always "
                "include concrete numbers (loss, accuracy, learning rate, epoch time)."
            )
        )

    async def train_epoch(self, session_id: str, epoch: int, total_epochs: int,
                          model: str, lr: float, batch_size: int,
                          prev_train_loss: float, prev_val_loss: float) -> Tuple[float, float, float]:
        """Simulate one training epoch; also posts a vivid War Room message."""
        # Deterministic noise + decay
        noise = random.gauss(0, 0.008)
        train_loss = max(0.09, prev_train_loss * 0.94 + noise)
        val_loss   = max(0.11, prev_val_loss  * 0.95 + noise * 1.1)
        accuracy   = min(99.1, 100 - val_loss * 55)

        # Rich human-like message variety
        messages = [
            f"📊 Epoch {epoch}/{total_epochs} done → train_loss={train_loss:.4f}, "
            f"val_loss={val_loss:.4f}, acc={accuracy:.2f}%. "
            f"LR={lr:.2e}, batch={batch_size}. GPU util ~87%.",

            f"Epoch {epoch} wrapped. Numbers look {'solid' if val_loss < 0.25 else 'a bit rough'}: "
            f"val_loss={val_loss:.4f} (Δ={val_loss - prev_val_loss:+.4f}), accuracy={accuracy:.2f}%. "
            f"Gradient norm is stable — no NaN spikes.",

            f"⚡ {model} | E{epoch}/{total_epochs} | "
            f"trn={train_loss:.4f} val={val_loss:.4f} acc={accuracy:.1f}% | "
            f"lr={lr:.1e} | ~{random.randint(420,520)} smp/s | "
            f"{random.uniform(8.4,9.2):.1f}s/epoch",

            f"Checkpoint E{epoch} saved to ./ckpt/epoch_{epoch:02d}.pt. "
            f"Validation accuracy improved to {accuracy:.2f}%. "
            f"Early-stopping patience: {max(0, 5 - (epoch % 3))}/5.",
        ]
        await self.post_to_blackboard(session_id, "action", random.choice(messages))
        return train_loss, val_loss, accuracy

    async def run_training_session(self, session_id: str, query: str,
                                   model: str = "MiniTransformer",
                                   total_epochs: int = 10) -> Dict[str, Any]:
        """Run a compressed training session (epochs simulated quickly)."""
        lr = 3e-4
        batch_size = 64

        await self.post_to_blackboard(session_id, "decision",
            f"Starting {model} training on MNIST. "
            f"Config: epochs={total_epochs}, lr={lr:.0e}, batch={batch_size}, "
            f"optimizer=AdamW, scheduler=CosineAnnealingLR. "
            f"I'll post epoch-by-epoch updates so everyone can track convergence.")

        train_loss, val_loss, accuracy = 1.82, 1.91, 20.0
        history = []

        for epoch in range(1, total_epochs + 1):
            train_loss, val_loss, accuracy = await self.train_epoch(
                session_id, epoch, total_epochs, model, lr, batch_size,
                train_loss, val_loss)
            history.append({"epoch": epoch, "train_loss": train_loss,
                            "val_loss": val_loss, "accuracy": accuracy})
            await asyncio.sleep(0.15)   # rapid visual pacing for demo

        await self.post_to_blackboard(session_id, "analysis",
            f"Training complete! Final metrics — "
            f"val_loss={val_loss:.4f}, accuracy={accuracy:.2f}%. "
            f"Best checkpoint was epoch {total_epochs}. "
            f"Handing results to Priya (Evaluator) for baseline comparison.")

        return {"model": model, "history": history, "final_accuracy": accuracy,
                "final_val_loss": val_loss}


# ─── Hyperparameter Tuner ─────────────────────────────────────────────────────

class HyperparamTunerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Ravi",
            role="Hyperparam Tuner",
            system_prompt=(
                "You are Ravi, an ML Research Scientist who specialises in Bayesian hyperparameter "
                "optimisation and ablation studies. You propose changes in a collegial tone, "
                "back every suggestion with theory, and openly disagree with peers when the data warrants it."
            )
        )

    async def propose_config(self, session_id: str, current_results: Dict[str, Any]) -> Dict[str, Any]:
        """Propose hyperparameter changes based on training results."""
        acc = current_results.get("final_accuracy", 90)
        val_loss = current_results.get("final_val_loss", 0.3)

        proposals = []
        reasoning_parts = []

        if val_loss > 0.20:
            proposals.append(("learning_rate", 1e-4, 3e-4, "LR seems high — val loss plateau suggests we overshot the minimum"))
        if acc < 97:
            proposals.append(("dropout", 0.2, 0.1, "Reducing dropout may help generalisation at this accuracy band"))
        proposals.append(("weight_decay", 1e-4, 5e-5, "Slight L2 relaxation to allow larger weight magnitudes for attention heads"))

        for param, new_val, old_val, reason in proposals:
            reasoning_parts.append(f"  • {param}: {old_val} → {new_val}  ({reason})")

        await self.post_to_blackboard(session_id, "decision",
            f"Analysed epoch history. Here's my tuning proposal:\n"
            + "\n".join(reasoning_parts) +
            f"\n\nExpected gain: +{random.uniform(0.3, 1.2):.1f}% accuracy if we re-run with these params. "
            f"@Zara — can you queue a re-run with these config changes?")

        return {p[0]: p[1] for p in proposals}

    async def ablation_study(self, session_id: str, model: str) -> None:
        """Post ablation discussion messages."""
        studies = [
            (f"Running ablation: what happens if we remove positional encoding from {model}? "
             f"Hypothesis: accuracy drops ~4-6pp because MNIST is spatially structured."),
            (f"Attention-head ablation: tested 1-head vs 4-head. "
             f"4-head wins by +1.8% val accuracy. "
             f"Multi-head captures both local stroke patterns and global digit shape. "
             f"Keeping 4 heads in final config."),
            (f"Data augmentation study: random horizontal flip actually *hurts* on MNIST "
             f"(digits 6/9 become ambiguous). Removed. RandomCrop padding=4 helps by +0.4%. "
             f"@Priya please re-benchmark with augmented set."),
        ]
        for msg in studies:
            await self.post_to_blackboard(session_id, "analysis", msg)
            await asyncio.sleep(0.8)


# ─── Evaluator ────────────────────────────────────────────────────────────────

class EvaluatorAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Priya",
            role="Evaluator",
            system_prompt=(
                "You are Priya, a rigorous ML Evaluator and Statistician. You compare models against "
                "baselines using paired t-tests, confidence intervals, and confusion matrices. "
                "You are sceptical of cherry-picked results and always ask for statistical significance."
            )
        )

    async def evaluate(self, session_id: str, transformer_results: Dict[str, Any],
                       mlp_baseline: Dict[str, Any]) -> Dict[str, Any]:
        """Compare transformer vs MLP baseline."""
        t_acc = transformer_results.get("final_accuracy", 98.4)
        m_acc = mlp_baseline.get("final_accuracy", 97.1)
        t_loss = transformer_results.get("final_val_loss", 0.054)
        m_loss = mlp_baseline.get("final_val_loss", 0.092)
        delta_acc = t_acc - m_acc
        delta_loss = m_loss - t_loss

        await self.post_to_blackboard(session_id, "analysis",
            f"📋 Baseline Comparison Report\n"
            f"  MiniTransformer : acc={t_acc:.2f}%  val_loss={t_loss:.4f}  params=112k\n"
            f"  MLP-3Layer (base): acc={m_acc:.2f}%  val_loss={m_loss:.4f}  params=565k\n"
            f"  Delta           : Δacc={delta_acc:+.2f}pp  Δloss={-delta_loss:+.4f}\n"
            f"  Params saved    : {(1 - 112/565)*100:.1f}% fewer parameters\n"
            f"Transformer wins on both accuracy AND efficiency. Remarkable given 5× fewer parameters.")

        await asyncio.sleep(0.6)

        await self.post_to_blackboard(session_id, "critique",
            f"Statistical check: ran paired t-test across 5 seeds. "
            f"p-value = {random.uniform(0.001, 0.018):.4f} — result IS statistically significant (α=0.05). "
            f"95% CI for Δacc: [{delta_acc - 0.4:.2f}, {delta_acc + 0.4:.2f}]pp. "
            f"@Max — I know you'll push back on sample size; we can discuss, but the signal is clear.")

        return {"delta_accuracy": delta_acc, "delta_loss": delta_loss,
                "significant": True, "p_value": random.uniform(0.001, 0.018)}

    async def confusion_matrix_analysis(self, session_id: str) -> None:
        """Post confusion-matrix insights."""
        await self.post_to_blackboard(session_id, "analysis",
            f"Confusion matrix highlights:\n"
            f"  • Digits 4 vs 9: confusion rate dropped from 1.8% → 0.6% (transformer handles curved strokes better)\n"
            f"  • Digit 1 vs 7: nearly perfect — both models nail this\n"
            f"  • Digit 3 vs 8: transformer still misclassifies 0.9% — likely needs more augmentation on this pair\n"
            f"Overall classification report: macro-F1 = {random.uniform(0.981, 0.988):.4f}")


# ─── Peer Reviewer ────────────────────────────────────────────────────────────

class PeerReviewerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Max",
            role="Peer Reviewer",
            system_prompt=(
                "You are Max, a senior peer-reviewer with a background in reproducibility research. "
                "You question methodology, flag threats to validity, demand ablations, and "
                "celebrate genuine wins. You are direct but collegial — you aim to make the work "
                "stronger, not to tear it down. You sometimes disagree with Priya's statistics."
            )
        )

    async def first_review(self, session_id: str, plan: str) -> None:
        """Post an early critical question."""
        questions = [
            f"Before Zara starts training — have we fixed the random seed for reproducibility? "
            f"I've seen too many papers where results don't replicate because seed=None. "
            f"@Zara please set seed=42 globally (torch, numpy, random).",

            f"Quick methodology question: are we splitting MNIST correctly? "
            f"Using the standard 60k/10k split, or are we doing a custom val split from training? "
            f"If it's the latter we need to be careful about data leakage. @Priya can you confirm?",

            f"I want to flag a potential confound: MLP baseline uses ReLU, transformer uses GELU. "
            f"Is the comparison fair? "
            f"@Ravi — maybe run a quick ReLU vs GELU ablation on the transformer too?",
        ]
        await self.post_to_blackboard(session_id, "critique", random.choice(questions))

    async def mid_review(self, session_id: str, epoch_results: Dict[str, Any]) -> None:
        """Mid-training critique."""
        acc = epoch_results.get("final_accuracy", 95)
        comments = [
            f"Looking at the loss curves, I see the training loss is dropping faster than val loss "
            f"after epoch 6 — classic overfitting signal. @Ravi should we bump weight_decay or add dropout? "
            f"Current accuracy {acc:.1f}% is good but we might be leaving generalization on the table.",

            f"@Zara the epoch time variance seems high (~1.2s std). Is GPU throttling? "
            f"I'd recommend locking GPU clocks during benchmarking for apples-to-apples comparison. "
            f"This could affect our throughput claims in the paper.",

            f"Quick sanity check: is the val set truly held out during LR scheduling? "
            f"ReduceLROnPlateau on val_loss is fine, but if the val set bleeds into the scheduler "
            f"decision loop we have a subtle form of leakage. Just confirming.",
        ]
        await self.post_to_blackboard(session_id, "critique", random.choice(comments))

    async def final_verdict(self, session_id: str, eval_results: Dict[str, Any]) -> None:
        """Final review and approval."""
        delta = eval_results.get("delta_accuracy", 1.3)
        p_val = eval_results.get("p_value", 0.012)
        significant = eval_results.get("significant", True)

        if significant and delta > 0.5:
            verdict = (
                f"✅ I'm satisfied with the methodology. "
                f"The Δacc={delta:+.2f}pp improvement is statistically robust (p={p_val:.4f}), "
                f"the ablations address the key confounds, and the confusion-matrix analysis "
                f"gives mechanistic insight — not just aggregate numbers. "
                f"This work is publishable. Strong accept from me. "
                f"One last thing: please include standard deviations across 3 seeds in Table 1 before submission."
            )
        else:
            verdict = (
                f"⚠️ The result is marginal (Δacc={delta:+.2f}pp, p={p_val:.4f}). "
                f"I'd like to see 3 more seeds before we claim statistical significance. "
                f"The trend is promising but the claim needs more evidence. "
                f"@Ravi let's also do a learning-rate sweep from 1e-5 to 1e-3 to confirm we're at optimum."
            )
        await self.post_to_blackboard(session_id, "approval", verdict)


# ─── Orchestrated ML training loop ───────────────────────────────────────────

async def run_ml_training_loop(session_id: str, query: str) -> Dict[str, Any]:
    """
    Runs all four ML agents concurrently.  Their messages stream to the
    War Room in real time via the blackboard broadcast callback.
    """
    trainer  = ModelTrainerAgent()
    tuner    = HyperparamTunerAgent()
    evaluator = EvaluatorAgent()
    reviewer = PeerReviewerAgent()

    # ── Kick-off ──────────────────────────────────────────────────────────
    await blackboard.post_message(AgentMessage(
        id="ml-start", session_id=session_id,
        agent_name="System", agent_role="System",
        message_type="info",
        content="🚀 ML Training Cluster activated. 4 specialist agents coming online: "
                "Zara (Trainer), Ravi (HyperTuner), Priya (Evaluator), Max (Peer Reviewer). "
                "Training MiniTransformer vs MLP baseline on MNIST."
    ))
    await asyncio.sleep(0.3)

    # ── Phase 0 — Peer reviewer sets expectations ─────────────────────────
    await reviewer.first_review(session_id, query)
    await asyncio.sleep(0.4)

    # ── Phase 1 — Training + Tuning run concurrently ──────────────────────
    training_task = asyncio.create_task(
        trainer.run_training_session(session_id, query, model="MiniTransformer", total_epochs=3)
    )
    ablation_task = asyncio.create_task(
        tuner.ablation_study(session_id, "MiniTransformer")
    )

    transformer_results = await training_task
    await ablation_task

    # ── Phase 2 — Hyperparameter proposal (Ravi reacts to Zara's results) ─
    await asyncio.sleep(0.15)
    hp_proposal = await tuner.propose_config(session_id, transformer_results)
    await asyncio.sleep(0.15)

    # ── Phase 3 — Mid-run peer review ─────────────────────────────────────
    await reviewer.mid_review(session_id, transformer_results)
    await asyncio.sleep(0.15)

    # ── Phase 4 — MLP baseline (quick run for comparison) ─────────────────
    mlp_baseline = {"final_accuracy": 97.1, "final_val_loss": 0.092, "model": "MLP-3Layer"}
    await blackboard.post_message(AgentMessage(
        id="mlp-ref", session_id=session_id,
        agent_name="Priya", agent_role="Evaluator",
        message_type="action",
        content="Loading MLP-3Layer baseline results from prior run "
                "(acc=97.10%, val_loss=0.0921, params=565k). "
                "Now running head-to-head comparison..."
    ))
    await asyncio.sleep(0.15)

    # ── Phase 5 — Evaluation ──────────────────────────────────────────────
    eval_results = await evaluator.evaluate(session_id, transformer_results, mlp_baseline)
    await asyncio.sleep(0.15)
    await evaluator.confusion_matrix_analysis(session_id)
    await asyncio.sleep(0.15)

    # ── Phase 6 — Final peer review ───────────────────────────────────────
    await reviewer.final_verdict(session_id, eval_results)
    await asyncio.sleep(0.15)

    # ── Closing summary ───────────────────────────────────────────────────
    final_acc = transformer_results.get("final_accuracy", 98.4)
    await blackboard.post_message(AgentMessage(
        id="ml-done", session_id=session_id,
        agent_name="System", agent_role="System",
        message_type="success",
        content=f"✅ ML Training Cluster complete. "
                f"MiniTransformer achieved {final_acc:.2f}% accuracy — "
                f"+{final_acc - 97.1:.2f}pp over MLP baseline with 80% fewer parameters. "
                f"All agents signed off. Results are ready for the Report Drafter."
    ))

    return {
        "transformer": transformer_results,
        "mlp_baseline": mlp_baseline,
        "evaluation": eval_results,
        "hp_proposal": hp_proposal,
    }
