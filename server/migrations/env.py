import logging
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, inspect, text
from alembic import context
from extensions import db
from models import User, Job, Message, ResetToken  # Explicitly import models
from flask import current_app

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# Ensure Flask app context is available
with current_app.app_context():
    # add your model's MetaData object here for 'autogenerate' support
    target_metadata = db.Model.metadata
    logger.info("Models detected: %s", target_metadata.tables.keys())
    # Debug database state
    inspector = inspect(db.engine)
    logger.debug("Database tables: %s", inspector.get_table_names())
    with db.engine.connect() as connection:
        result = connection.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).fetchall()
        logger.debug("Database schema: %s", result)

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            process_revision_directives=process_revision_directives,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()