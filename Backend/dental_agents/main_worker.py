"""Canonical worker module entrypoint.
Run with: python -m dental_agents.main_worker
"""

from .dental_agents.worker import main


if __name__ == "__main__":
    main()
