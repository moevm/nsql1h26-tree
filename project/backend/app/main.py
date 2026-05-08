from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import get_driver, close_driver
from app.routers import persons, stats, import_export
from app.seed import seed
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI): 
    driver = get_driver()
    with driver.session() as session: 
        seed(session)
    yield
    close_driver()

app = FastAPI(
    title="Династия Романовых - API",
    version="0.5.0",
    description="REST API для приложения генеалогического дерева Романовых",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats.router)
app.include_router(persons.router)
app.include_router(import_export.router)

@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "service": "tree-db"}