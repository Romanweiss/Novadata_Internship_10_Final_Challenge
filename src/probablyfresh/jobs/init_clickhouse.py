from probablyfresh.config import get_settings
from probablyfresh.integrations.clickhouse_client import run_init_sql


if __name__ == "__main__":
    settings = get_settings()
    sql_path = settings.project_root / "infra" / "clickhouse" / "init.sql"
    executed = run_init_sql(settings, sql_path)
    print(f"ClickHouse init completed, statements executed: {executed}")
