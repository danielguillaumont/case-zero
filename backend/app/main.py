from fastapi import (
    Depends,
    FastAPI,
)
from starlette.middleware.trustedhost import (
    TrustedHostMiddleware,
)

from app.api.routes.alerts import (
    router as alerts_router,
)
from app.api.routes.auth import (
    router as auth_router,
)
from app.api.routes.cases import (
    router as cases_router,
)
from app.api.routes.events import (
    router as events_router,
)
from app.api.routes.hunt import (
    router as hunt_router,
)
from app.api.routes.intelligence import (
    router as intelligence_router,
)
from app.api.routes.playbooks import (
    router as playbooks_router,
)
from app.api.routes.rules import (
    router as rules_router,
)
from app.auth import require_roles
from app.config import (
    ALLOWED_HOSTS,
    API_DOCS_ENABLED,
)
from app.database import (
    check_database_connection,
)
from app.models.user import User


docs_url = (
    "/docs"
    if API_DOCS_ENABLED
    else None
)

redoc_url = (
    "/redoc"
    if API_DOCS_ENABLED
    else None
)

openapi_url = (
    "/openapi.json"
    if API_DOCS_ENABLED
    else None
)


app = FastAPI(
    title="CASE//ZERO API",
    description=(
        "Backend API for the CASE//ZERO "
        "cybersecurity platform."
    ),
    version="0.1.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
)


app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=ALLOWED_HOSTS,
    www_redirect=False,
)


app.include_router(auth_router)
app.include_router(alerts_router)
app.include_router(cases_router)
app.include_router(events_router)
app.include_router(hunt_router)
app.include_router(intelligence_router)
app.include_router(playbooks_router)
app.include_router(rules_router)


@app.get("/")
async def root():
    return {
        "name": "CASE//ZERO",
        "message": (
            "Security Operations Platform API"
        ),
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
    }


@app.get("/api/status")
async def platform_status(
    _current_user: User = Depends(
        require_roles(
            "administrator",
            "analyst",
            "viewer",
        )
    ),
):
    database_online = (
        await check_database_connection()
    )

    return {
        "status": "online",
        "service": "CASE//ZERO API",
        "version": "0.1.0",
        "database": (
            "online"
            if database_online
            else "offline"
        ),
    }