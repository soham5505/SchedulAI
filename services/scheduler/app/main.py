from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import health, generate, validate, suggest

app = FastAPI(
    title="SchedulAI OR-Tools Scheduler Service",
    description="High-performance constraint programming scheduler using Google OR-Tools",
    version="1.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(generate.router)
app.include_router(validate.router)
app.include_router(suggest.router)
