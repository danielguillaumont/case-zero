from fastapi import FastAPI

from app.api.routes.alerts import router as alerts_router
from app.database import check_database_connection


app = FastAPI(
    title="CASE//ZERO API",
    description="Backend API for the CASE//ZERO cybersecurity platform.",
    version="0.1.0",
)


app.include_router(alerts_router)


@app.get("/")
async def root():
    return {
        "name": "CASE//ZERO",
        "message": "Security Operations Platform API",
    }


@app.get("/api/health")
async def health_check():
    database_online = await check_database_connection()

    return {
        "status": "online",
        "service": "CASE//ZERO API",
        "version": "0.1.0",
        "database": "online" if database_online else "offline",
    }