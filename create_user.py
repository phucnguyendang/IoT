from backend_app.database import SessionLocal, engine, Base
from backend_app.models.device import User
from backend_app.routers.auth import get_password_hash

def create_user(username, password):
    db = SessionLocal()
    try:
        # Check if user exists
        user = db.query(User).filter(User.username == username).first()
        if user:
            print(f"User {username} already exists.")
            return

        hashed_password = get_password_hash(password)
        new_user = User(username=username, hashed_password=hashed_password)
        db.add(new_user)
        db.commit()
        print(f"User {username} created successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    create_user("admin", "admin")
