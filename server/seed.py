from app import create_app, db
from models import User, Job, Message
from datetime import datetime, timedelta
import random

app = create_app()

def seed_database():
    with app.app_context():
        print("Clearing existing data...")
        db.session.query(Message).delete()
        db.session.query(Job).delete()
        db.session.query(User).delete()
        db.session.commit()

        print("Seeding new data...")
        
        # Create test users
        client = User(
            email="client@example.com",
            username="client1",
            name="Client User",
            role="client"
        )
        client.set_password("password123")
        
        admin = User(
            email="admin@example.com",
            username="admin1",
            name="Admin User",
            role="admin"
        )
        admin.set_password("password123")
        
        db.session.add_all([client, admin])
        db.session.commit()
        
        # Create test jobs
        subjects = ["Nursing", "Maths", "English", "History", "Science", "Business", "Psychology", "Economics"]
        formatting_styles = ["APA", "MLA", "Chicago", "Harvard", "IEEE"]
        writer_levels = ["PHD", "Masters", "Undergraduate", "High School", "Primary"]
        spacing_options = ["single", "double"]
        
        jobs = []
        for i in range(5):
            pages = random.randint(1, 10)
            words_per_page = 550 if spacing_options[i % 2] == "single" else 275
            rate_per_word = {
                "PHD": 0.15,
                "Masters": 0.12,
                "Undergraduate": 0.10,
                "High School": 0.08,
                "Primary": 0.05
            }.get(writer_levels[i % len(writer_levels)], 0.10)
            total_amount = pages * words_per_page * rate_per_word
            
            job = Job(
                user_id=client.id,
                subject=subjects[i % len(subjects)],
                title=f"Sample Paper {i+1}",
                pages=pages,
                deadline=datetime.utcnow() + timedelta(days=random.randint(1, 30)),
                instructions=f"Instructions for sample paper {i+1}. Please write a detailed paper.",
                cited_resources=random.randint(0, 10),
                formatting_style=formatting_styles[i % len(formatting_styles)],
                writer_level=writer_levels[i % len(writer_levels)],
                spacing=spacing_options[i % 2],
                total_amount=total_amount,
                status="Pending" if i < 3 else "Completed",
                completed=i >= 3,
                files=[]  # No files for simplicity; can add sample files if needed
            )
            jobs.append(job)
        
        db.session.add_all(jobs)
        db.session.commit()
        
        # Create test messages for the first job
        messages = [
            Message(
                job_id=jobs[0].id,
                sender_id=client.id,
                sender_role="client",
                content="Hello, I need some clarification on the requirements. Can you help?",
                created_at=datetime.utcnow() - timedelta(hours=2)
            ),
            Message(
                job_id=jobs[0].id,
                sender_id=admin.id,
                sender_role="admin",
                content="Of course! Could you specify which part you need help with?",
                created_at=datetime.utcnow() - timedelta(hours=1)
            ),
            Message(
                job_id=jobs[0].id,
                sender_id=client.id,
                sender_role="client",
                content="I need more details on the citation style.",
                created_at=datetime.utcnow() - timedelta(minutes=30)
            )
        ]
        
        db.session.add_all(messages)
        db.session.commit()
        
        print("Database seeded successfully!")

if __name__ == "__main__":
    seed_database()