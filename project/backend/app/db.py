from neo4j import GraphDatabase, Driver
from app.config import settings
_driver: Driver | None = None 

def get_driver() -> Driver:
    global _driver 
    if _driver is None: 
        _driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver

def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None

def get_session():
    driver = get_driver()
    with driver.session() as session:
        yield session