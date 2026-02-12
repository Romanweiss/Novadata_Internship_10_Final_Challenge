from probablyfresh.config import get_settings
from probablyfresh.core.data_generation import generate_data


if __name__ == "__main__":
    settings = get_settings()
    result = generate_data(settings)
    print(
        "Generated data files: "
        f"stores={result.stores}, products={result.products}, "
        f"customers={result.customers}, purchases={result.purchases}"
    )
