
"""Add email, url, and created_at index to Blog model

Revision ID: df5ab8fbbe27
Revises: a308f83360e3
Create Date: 2025-09-04 22:25:32.274971
"""

from alembic import op
import sqlalchemy as sa
import pytz

# revision identifiers, used by Alembic.
revision = 'df5ab8fbbe27'
down_revision = 'a308f83360e3'
branch_labels = None
depends_on = None

def upgrade():
    # Add new columns to existing blog table
    op.add_column('blog', sa.Column('email', sa.String(length=120), nullable=True))
    op.add_column('blog', sa.Column('url', sa.String(length=255), nullable=True))
    # Add index on created_at
    op.create_index(op.f('ix_blog_created_at'), 'blog', ['created_at'], unique=False)

def downgrade():
    # Remove index
    op.drop_index(op.f('ix_blog_created_at'), table_name='blog')
    # Remove columns
    op.drop_column('blog', 'url')
    op.drop_column('blog', 'email')
