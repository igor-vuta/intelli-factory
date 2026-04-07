import asyncio
import logging
import os
import shutil
import sys
from pathlib import Path

from prisma.engine.errors import BinaryNotFoundError

from db import prisma

logger = logging.getLogger(__name__)

prisma_connect_task: asyncio.Task | None = None


def configure_prisma_query_engine_binary() -> None:
    if os.getenv("PRISMA_QUERY_ENGINE_BINARY"):
        return

    local_binary = Path(__file__).resolve().parent.parent / "prisma-query-engine-debian-openssl-3.0.x"
    if local_binary.exists():
        os.environ["PRISMA_QUERY_ENGINE_BINARY"] = str(local_binary)
        logger.info("Using pre-built Prisma binary at %s", local_binary)
        return

    candidates = []
    home_cache = Path.home() / ".cache" / "prisma-python" / "binaries"
    render_cache = Path("/opt/render/.cache/prisma-python/binaries")

    patterns = (
        "**/prisma-query-engine-debian-openssl-3.0.x",
        "**/query-engine-debian-openssl-3.0.x",
    )

    if home_cache.exists():
        for pattern in patterns:
            candidates.extend(home_cache.glob(pattern))

    if render_cache.exists():
        for pattern in patterns:
            candidates.extend(render_cache.glob(pattern))

    candidates = sorted(candidates, reverse=True)
    if candidates:
        source_binary = candidates[0]
        if not local_binary.exists():
            shutil.copy2(source_binary, local_binary)
            local_binary.chmod(0o755)
        os.environ["PRISMA_QUERY_ENGINE_BINARY"] = str(local_binary)
        logger.info("Copied Prisma binary from cache to %s", local_binary)


async def fetch_prisma_binary() -> bool:
    try:
        logger.info("Fetching Prisma query engine binary via `prisma py fetch` ...")
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "prisma",
            "py",
            "fetch",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        if proc.returncode == 0:
            logger.info("prisma py fetch succeeded")
            return True
        logger.error(
            "prisma py fetch failed (rc=%s): %s",
            proc.returncode,
            (stderr or b"").decode(errors="replace"),
        )
    except Exception as exc:
        logger.error("prisma py fetch raised: %s", exc)
    return False


async def connect_prisma_background() -> None:
    fetched = False
    for attempt in range(1, 4):
        try:
            configure_prisma_query_engine_binary()
            await asyncio.wait_for(prisma.connect(), timeout=30)
            logger.info("Prisma connected successfully on background attempt %s", attempt)
            return
        except BinaryNotFoundError:
            if not fetched:
                logger.warning("Prisma binary not found on attempt %s -- running prisma py fetch", attempt)
                fetched = await fetch_prisma_binary()
            else:
                logger.warning("Prisma binary still missing after fetch, attempt %s", attempt)
                await asyncio.sleep(5)
        except Exception as exc:
            logger.warning("Prisma connect failed on attempt %s: %s", attempt, exc)
            await asyncio.sleep(5)
    logger.error("Prisma background connect exhausted all attempts")


async def startup_event() -> None:
    global prisma_connect_task
    prisma_connect_task = asyncio.create_task(connect_prisma_background())


async def shutdown_event() -> None:
    if prisma_connect_task and not prisma_connect_task.done():
        prisma_connect_task.cancel()

    try:
        await prisma.disconnect()
    except Exception:
        pass
