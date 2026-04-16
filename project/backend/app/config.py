from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str
    neo4j_password: str

    cors_origins: list[str] = ["*"]
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", env_file_override=False)

settings = Settings()