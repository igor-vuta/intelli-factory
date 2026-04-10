import asyncio
import logging
import sys

from fastapi import HTTPException, status
from prisma.engine.errors import AlreadyConnectedError, BinaryNotFoundError

from db import prisma

logger = logging.getLogger(__name__)

_binary_fetch_attempted = False
_binary_fetch_lock = asyncio.Lock()


async def _fetch_prisma_binary_once() -> None:
    global _binary_fetch_attempted
    async with _binary_fetch_lock:
        if _binary_fetch_attempted:
            return
        _binary_fetch_attempted = True
        try:
            logger.warning("Prisma binary missing -- running prisma py fetch (inline fallback) ...")
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
                logger.info("Inline prisma py fetch succeeded")
            else:
                logger.error(
                    "Inline prisma py fetch failed (rc=%s): %s",
                    proc.returncode,
                    (stderr or b"").decode(errors="replace"),
                )
        except Exception as exc:
            logger.error("Inline prisma py fetch raised: %s", exc)


async def ensure_db_connection() -> None:
    last_error: Exception | None = None

    for attempt in range(1, 9):
        try:
            await asyncio.wait_for(prisma.connect(), timeout=10)
        except AlreadyConnectedError:
            pass
        except BinaryNotFoundError as exc:
            last_error = exc
            logger.warning("Prisma binary not found on attempt %s/8 -- will fetch", attempt)
            await _fetch_prisma_binary_once()
        except Exception as exc:
            last_error = exc
            logger.warning("Database connect attempt %s/8 failed", attempt)
            if attempt < 8:
                await asyncio.sleep(min(0.5 * (2 ** (attempt - 1)), 5))
            continue

        try:
            await prisma.user.count()
            return
        except Exception as exc:
            last_error = exc
            logger.warning("Database probe attempt %s/8 failed", attempt)
            try:
                await prisma.disconnect()
            except Exception:
                pass
            if attempt < 8:
                await asyncio.sleep(min(0.5 * (2 ** (attempt - 1)), 5))

    logger.exception("Database connection unavailable after retries", exc_info=last_error)
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
