"""
Entry point — starts the FastAPI + WebSocket server.

Usage
-----
    python main.py                        # default host 0.0.0.0 port 8000
    python main.py --host 127.0.0.1 --port 8080
    python main.py --reload               # auto-reload on code change (dev only)
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.database import init_db, seed_demo_data


def main():
    parser = argparse.ArgumentParser(description="Fall Risk Detection API Server")
    parser.add_argument("--host",   default="0.0.0.0",  help="Bind host (default 0.0.0.0)")
    parser.add_argument("--port",   type=int, default=8000, help="Bind port (default 8000)")
    parser.add_argument("--reload", action="store_true",   help="Auto-reload on code change")
    args = parser.parse_args()

    # Initialise database
    print("[startup] Initialising database...")
    init_db()
    seed_demo_data()
    print("[startup] Database ready.")

    # Start server
    import uvicorn
    print(f"[startup] Starting server on http://{args.host}:{args.port}")
    print(f"[startup] API docs available at http://localhost:{args.port}/docs")
    uvicorn.run(
        "api.server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
