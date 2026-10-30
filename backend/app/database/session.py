"""Database session management."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import get_settings
from app.models.database import Base

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def create_tables():
    """Create all database tables and ensure column migrations for existing tables."""
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _migrate(connection):
            try:
                res = connection.execute(text("PRAGMA table_info(users)"))
                cols = [r[1] for r in res.fetchall()]
                if cols and "avatar_url" not in cols:
                    connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
            except Exception:
                pass

        await conn.run_sync(_migrate)


async def get_db():
    """Dependency for getting a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
