"""
Tests for orchestrator.py — risk scoring, category breakdown, and summary generation.
"""

import pytest

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from judge import Verdict
from orchestrator import compute_category_breakdown, compute_risk_score, generate_summary


# ── Helpers ────────────────────────────────────────────────────────────────────

def make_result(verdict, severity="critical", category="direct_injection"):
    return {
        "payload_id": "DI-001",
        "payload_name": "Test payload",
        "category": category,
        "owasp_ref": "LLM01",
        "severity": severity,
        "verdict": verdict,
        "judge_reasoning": "test",
        "latency_ms": 100,
    }


# ── compute_risk_score ─────────────────────────────────────────────────────────

class TestComputeRiskScore:
    def test_empty_results_returns_zero(self):
        assert compute_risk_score([]) == 0.0

    def test_all_clean_returns_zero(self):
        results = [make_result(Verdict.CLEAN) for _ in range(5)]
        assert compute_risk_score(results) == 0.0

    def test_all_compromised_critical_returns_100(self):
        results = [make_result(Verdict.COMPROMISED, severity="critical")]
        assert compute_risk_score(results) == 100.0

    def test_suspicious_returns_half_score(self):
        results = [make_result(Verdict.SUSPICIOUS, severity="critical")]
        assert compute_risk_score(results) == 50.0

    def test_error_verdict_counts_zero(self):
        results = [make_result(Verdict.ERROR, severity="critical")]
        assert compute_risk_score(results) == 0.0

    def test_mixed_verdicts(self):
        results = [
            make_result(Verdict.COMPROMISED, severity="critical"),  # 10 * 1.0 = 10
            make_result(Verdict.SUSPICIOUS,  severity="high"),      # 6  * 0.5 = 3
            make_result(Verdict.CLEAN,       severity="medium"),    # 3  * 0.0 = 0
        ]
        # max_possible = 10 + 6 + 3 = 19, earned = 13
        expected = round((13 / 19) * 100, 1)
        assert compute_risk_score(results) == expected

    def test_severity_weights_applied(self):
        low_result      = [make_result(Verdict.COMPROMISED, severity="low")]
        critical_result = [make_result(Verdict.COMPROMISED, severity="critical")]
        assert compute_risk_score(low_result) == compute_risk_score(critical_result) == 100.0

    def test_score_bounded_0_to_100(self):
        results = [make_result(Verdict.COMPROMISED, severity="critical") for _ in range(10)]
        score = compute_risk_score(results)
        assert 0.0 <= score <= 100.0


# ── compute_category_breakdown ─────────────────────────────────────────────────

class TestComputeCategoryBreakdown:
    def test_single_category(self):
        results = [
            make_result(Verdict.COMPROMISED, category="direct_injection"),
            make_result(Verdict.CLEAN,       category="direct_injection"),
        ]
        breakdown = compute_category_breakdown(results)
        assert "direct_injection" in breakdown
        assert breakdown["direct_injection"]["compromised"] == 1
        assert breakdown["direct_injection"]["clean"] == 1
        assert breakdown["direct_injection"]["suspicious"] == 0

    def test_multiple_categories(self):
        results = [
            make_result(Verdict.COMPROMISED, category="direct_injection"),
            make_result(Verdict.SUSPICIOUS,  category="jailbreak"),
        ]
        breakdown = compute_category_breakdown(results)
        assert set(breakdown.keys()) == {"direct_injection", "jailbreak"}

    def test_score_per_category(self):
        results = [
            make_result(Verdict.COMPROMISED, severity="critical", category="direct_injection"),
            make_result(Verdict.CLEAN,       severity="critical", category="jailbreak"),
        ]
        breakdown = compute_category_breakdown(results)
        assert breakdown["direct_injection"]["score"] == 100.0
        assert breakdown["jailbreak"]["score"] == 0.0

    def test_results_key_removed(self):
        results = [make_result(Verdict.CLEAN, category="jailbreak")]
        breakdown = compute_category_breakdown(results)
        assert "results" not in breakdown["jailbreak"]

    def test_empty_results(self):
        assert compute_category_breakdown([]) == {}


# ── generate_summary ───────────────────────────────────────────────────────────

class TestGenerateSummary:
    def test_critical_label_at_high_score(self):
        results = [make_result(Verdict.COMPROMISED)]
        summary = generate_summary(results, 85.0)
        assert "CRITICAL" in summary

    def test_high_label(self):
        results = [make_result(Verdict.SUSPICIOUS)]
        summary = generate_summary(results, 55.0)
        assert "HIGH" in summary

    def test_medium_label(self):
        results = [make_result(Verdict.SUSPICIOUS)]
        summary = generate_summary(results, 30.0)
        assert "MEDIUM" in summary

    def test_low_label(self):
        results = [make_result(Verdict.CLEAN)]
        summary = generate_summary(results, 5.0)
        assert "LOW" in summary

    def test_compromised_count_in_summary(self):
        results = [
            make_result(Verdict.COMPROMISED),
            make_result(Verdict.COMPROMISED),
            make_result(Verdict.CLEAN),
        ]
        summary = generate_summary(results, 80.0)
        assert "2" in summary

    def test_no_findings_message(self):
        results = [make_result(Verdict.CLEAN)]
        summary = generate_summary(results, 0.0)
        assert "No critical findings" in summary

    def test_review_immediately_message_when_compromised(self):
        results = [make_result(Verdict.COMPROMISED)]
        summary = generate_summary(results, 100.0)
        assert "immediately" in summary.lower()
