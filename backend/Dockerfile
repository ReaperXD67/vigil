FROM python:3.14.8-alpine3.24

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt ./
RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates \
    && pip install --no-cache-dir --only-binary=:all: -r requirements.txt \
    && addgroup -g 10001 -S vigil \
    && adduser -u 10001 -S -D -H -G vigil vigil
COPY --chown=vigil:vigil app ./app
COPY --chown=vigil:vigil alembic ./alembic
COPY --chown=vigil:vigil alembic.ini ./alembic.ini
RUN mkdir /app/data && chown vigil:vigil /app/data
USER 10001:10001
ENV DATABASE_URL=sqlite:////app/data/vigil.db
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=2)" || exit 1
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers --limit-concurrency 100"]
