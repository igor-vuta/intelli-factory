FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.10.9 /uv /usr/local/bin/uv
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
ENV PRISMA_HOME_DIR=/home/app PRISMA_NODEENV_CACHE_DIR=/home/app/.cache/prisma-python/nodeenv
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates libatomic1 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN uv pip install --system --no-cache --require-hashes -r requirements.txt
RUN useradd --create-home app && chown app:app /app
COPY --chown=app:app . .
RUN python -m prisma generate && chown -R app:app /home/app
USER app
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
