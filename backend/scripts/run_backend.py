from __future__ import annotations

import uvicorn

from app.config import get_settings
from app.main import app


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        app,
        host=settings.app_host,
        port=settings.app_port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
