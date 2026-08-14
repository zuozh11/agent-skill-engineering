#!/usr/bin/env python3

import sys
from pathlib import Path


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    rules_dir = Path(__file__).resolve().parent.parent / "rules"
    if not rules_dir.is_dir():
        return

    for rule_file in sorted(rules_dir.glob("*.md"), key=lambda path: path.name):
        print(f"===== {rule_file.name} =====")
        print(rule_file.read_text(encoding="utf-8"), end="")
        print("\n")


if __name__ == "__main__":
    main()
