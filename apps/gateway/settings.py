"""
SmartLogix Gateway — Configuration (Task 3.1)

Uses pydantic-settings to read all config from env vars listed in .env.example.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""  # maps to NEXT_PUBLIC_SUPABASE_ANON_KEY
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # OSRM
    osrm_base_url: str = "http://localhost:5000"

    # Solver
    solver_host: str = "localhost"
    solver_port: int = 8081
    solver_budget_ms: int = 500

    # Gateway
    gateway_host: str = "0.0.0.0"
    gateway_port: int = 8000
    gateway_cors_origins: str = "http://localhost:3000"

    # Clustering
    cluster_min_shipments: int = 2
    cluster_max_wait_seconds: int = 300

    # Bidding
    bid_window_seconds: int = 120

    # GLEC
    glec_ef_diesel: float = 0.062  # kg CO₂e per tonne-km

    # VAPID (Web Push)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@smartlogix.dev"

    # MapTiler (optional)
    maptiler_api_key: str = ""

    # Twilio (optional — stubbed if absent per rules.md §9)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""

    solver_url_override: str = ""

    @property
    def solver_url(self) -> str:
        return self.solver_url_override or f"http://{self.solver_host}:{self.solver_port}"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.gateway_cors_origins.split(",")]

    @property
    def has_twilio(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token)

    model_config = {
        "env_prefix": "",
        "env_file": "../../.env",
        "case_sensitive": False,
        "extra": "ignore",
        # Map NEXT_PUBLIC_ prefixed vars
        "env_nested_delimiter": "__",
    }


# Singleton instance
settings = Settings()
