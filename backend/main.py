"""
AIxistence FastAPI application entry point.
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from scenarios.router import router as scenarios_router
from mirror_router import router as mirror_router

load_dotenv()

app = FastAPI(title="AIxistence API")

# CORS — allow the frontend origin (defaults to local Vite dev server)
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenarios_router)
app.include_router(mirror_router)
