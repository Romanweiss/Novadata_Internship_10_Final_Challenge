FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CLICKHOUSE_JDBC_JAR=/opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar

RUN apt-get update && apt-get install -y --no-install-recommends \
    default-jre-headless \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

RUN mkdir -p /opt/jars \
    && curl -fsSL -o /opt/jars/clickhouse-jdbc-0.9.6-all-dependencies.jar \
    https://repo1.maven.org/maven2/com/clickhouse/clickhouse-jdbc/0.9.6/clickhouse-jdbc-0.9.6-all-dependencies.jar

CMD ["sh", "-lc", "sleep infinity"]
