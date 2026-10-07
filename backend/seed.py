import asyncio

from lib.db import ensure_indexes
from lib.seed import seed


async def main() -> None:
    await ensure_indexes()
    await seed()
    print("seeded")


if __name__ == "__main__":
    asyncio.run(main())
