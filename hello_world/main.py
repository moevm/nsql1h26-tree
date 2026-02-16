import os
import time 
from neo4j import GraphDatabase 

class FamilyTree:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth = (user, password))
        for i in range(10):
            try:
                self.driver.verify_connectivity()
                print("Успешное подключение к БД")
                break 
            except Exception: 
                print(f"Попытка {i+1}, БД еще не загружена")
                time.sleep(5)
        else: 
            raise Exception("Не удалось подключиться к БД")
    
    def close(self):
        self.driver.close()
    
    def add_person(self, name, title):
        self.driver.execute_query("MERGE (p:Person {name: $name, title: $title})", name=name, title=title)
        print(f"Записано в БД: {name}")

    def list_db(self):
        records, _, _ = self.driver.execute_query("MATCH (p:Person) RETURN p.name AS name, p.title AS title")
        return records

if __name__ == "__main__":
    URI = os.getenv("DB_URI", "bolt://localhost:7687")
    USER = os.getenv("DB_USER", "neo4j")
    PASSWORD = os.getenv("DB_PASS", "passwd11")
    app = FamilyTree(URI, USER, PASSWORD)
    try: 
        app.add_person("Владимир 1", "Князь Новгородский")
        app.add_person("Василий 1", "Князь Московский")

        print("\n Список монархов в базе:")
        people = app.list_db()
        for person in people: 
            print(f"Имя: {person['name']}, Титул: {person['title']}")
    finally: 
        app.close()
