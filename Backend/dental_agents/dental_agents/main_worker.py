# dental_agents/main_worker.py
# Back-compat entrypoint: delegate to the newer worker implementation.
from __future__ import annotations

from dental_agents.worker import main


if __name__ == "__main__":
    main()
