from fastapi import FastAPI

app = FastAPI(
    title="CASE//ZERO API",
    description="Backend API for the CASE//ZERO cybersecurity platform.",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {
        "name": "CASE//ZERO",
        "message": "Security Operations Platform API",
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "service": "CASE//ZERO API",
        "version": "0.1.0",
    }