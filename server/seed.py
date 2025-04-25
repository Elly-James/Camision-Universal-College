from datetime import datetime, timedelta
from models import User, Job, Message, ResetToken
from sqlalchemy import inspect

def seed_database(app, db):
    with app.app_context():
        # Check if tables exist before attempting to delete
        inspector = inspect(db.engine)
        tables_to_check = ['user', 'reset_token', 'job', 'message']
        tables_exist = all(inspector.has_table(table) for table in tables_to_check)

        if tables_exist:
            print("Clearing existing data...")
            try:
                db.session.query(Message).delete()
                db.session.query(Job).delete()
                db.session.query(ResetToken).delete()
                db.session.query(User).delete()
                db.session.commit()
                print("Existing data cleared.")
            except Exception as e:
                print(f"Error clearing data: {str(e)}")
                db.session.rollback()
        else:
            print("Tables do not exist yet. Please run migrations first.")
            return

        # Seed test users
        print("Seeding test users...")
        admin_user = User(
            email='admin@example.com',
            username='admin',
            name='Admin User',
            role='admin'
        )
        admin_user.set_password('adminpassword')
        
        client_user = User(
            email='client@example.com',
            username='client',
            name='Client User',
            role='client'
        )
        client_user.set_password('clientpassword')
        
        db.session.add(admin_user)
        db.session.add(client_user)
        db.session.commit()
        print("Test users seeded.")

        # Seed test jobs
        print("Seeding test jobs...")
        job = Job(
            user_id=client_user.id,
            client_name=client_user.name,
            subject='Mathematics',
            title='Calculus Assignment',
            pages=5,
            deadline=datetime.utcnow() + timedelta(days=7),
            instructions='Solve the calculus problems with detailed steps.',
            cited_resources=3,
            formatting_style='APA',
            writer_level='PHD',
            spacing='double',
            total_amount=150.00,
            status='Pending',
            files=['sample.pdf'],
            completed_files=[],
            client_email=client_user.email
        )
        db.session.add(job)
        db.session.commit()
        print("Test jobs seeded.")

        # Seed test messages
        print("Seeding test messages...")
        message = Message(
            job_id=job.id,
            sender_id=admin_user.id,
            sender_role='admin',
            content='I have started working on your calculus assignment.',
            files=['progress.pdf']
        )
        db.session.add(message)
        db.session.commit()
        print("Test messages seeded.")

        print("Database seeding completed.")

if __name__ == "__main__":
    from app import app, db
    seed_database(app, db)