from __future__ import annotations

from pathlib import Path

from clickhouse_driver import Client

from probablyfresh.config import Settings



def _split_sql_statements(sql_text: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []

    for line in sql_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        current.append(line)
        if stripped.endswith(";"):
            statement = "\n".join(current).strip().rstrip(";")
            if statement:
                statements.append(statement)
            current = []

    tail = "\n".join(current).strip().rstrip(";")
    if tail:
        statements.append(tail)

    return statements



def run_init_sql(settings: Settings, sql_path: Path) -> int:
    sql_text = sql_path.read_text(encoding="utf-8")
    statements = _split_sql_statements(sql_text)

    client = Client(
        host=settings.clickhouse_host,
        port=settings.clickhouse_port,
        user=settings.clickhouse_user,
        password=settings.clickhouse_password,
    )

    executed = 0
    for statement in statements:
        client.execute(statement)
        executed += 1

    return executed
