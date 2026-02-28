"""
AI Farm Analyst — Entry Point
==============================
Runs demonstration use cases.

Usage:
    uv run main.py [a|b|c]

    a  → Use Case A: Smart Fertilizer Advisory (Maize, N-deficient, rain tomorrow)
    b  → Use Case B: Sowing Viability (Ragi, dry soil, no rain forecast)
    c  → Use Case C: Pest & Disease Warning (Tomatoes flowering, high humidity)

    (no arg) → runs all three sequentially.
"""

import sys
from analyst.engine import analyse


def run_a():
    from examples.use_case_a import build_inputs
    soil, weather, crop = build_inputs()
    report = analyse(soil, weather, crop)
    print("\n" + "=" * 60)
    print("USE CASE A — Smart Fertilizer Advisory (Maize)")
    print("=" * 60)
    _print_report(report)


def run_b():
    from examples.use_case_b import build_inputs
    soil, weather, crop = build_inputs()
    report = analyse(soil, weather, crop)
    print("\n" + "=" * 60)
    print("USE CASE B — Sowing Viability (Ragi)")
    print("=" * 60)
    _print_report(report)


def run_c():
    from examples.use_case_c import build_inputs
    soil, weather, crop = build_inputs()
    report = analyse(soil, weather, crop)
    print("\n" + "=" * 60)
    print("USE CASE C — Pest & Disease Warning (Tomato)")
    print("=" * 60)
    _print_report(report)


def _print_report(report) -> None:
    print(f"\n{report.greeting}")
    print(f"\nCrop Stage : {report.crop_stage}")
    print(f"Situation  : {report.situation_summary}")

    if report.alerts:
        print("\nALERTS:")
        for a in report.alerts:
            print(f"  [{a.severity}] {a.title}")
            print(f"           {a.description}")

    if report.fertilizer_recommendation:
        f = report.fertilizer_recommendation
        print(f"\nFERTILIZER : {f.fertilizer_name}")
        print(f"  Rate     : {f.quantity_kg_per_acre} kg/acre  |  Total: {f.total_quantity_kg} kg")
        print(f"  Method   : {f.application_method}")
        print(f"  Timing   : {f.timing_notes}")

    if report.irrigation_recommendation:
        print(f"\nIRRIGATION : {report.irrigation_recommendation}")

    if report.pest_disease_watch:
        print("\nPEST / DISEASE WATCH:")
        for p in report.pest_disease_watch:
            print(f"  • {p}")

    print("\nACTION ITEMS:")
    for item in report.action_items:
        print(f"  [{item.priority}] {item.timing} — {item.action}")
        print(f"           Reason: {item.reason}")

    print(f"\nFULL ADVISORY:\n{report.full_advisory}")


_CASES = {"a": run_a, "b": run_b, "c": run_c}

if __name__ == "__main__":
    arg = sys.argv[1].lower() if len(sys.argv) > 1 else None
    if arg and arg in _CASES:
        _CASES[arg]()
    else:
        for fn in _CASES.values():
            fn()
