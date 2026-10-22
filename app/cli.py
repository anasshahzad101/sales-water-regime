"""Flask CLI commands."""
import click
from flask.cli import with_appcontext

from app import db
from app.seed import ensure_demo_users, load_seed


def register_cli(app):

    @app.cli.command("init-db")
    @with_appcontext
    def init_db():
        """Create tables."""
        db.create_all()
        click.echo("Tables created.")

    @app.cli.command("seed-users")
    @with_appcontext
    def seed_users():
        """Create default admin + CEO + sales users."""
        created = ensure_demo_users()
        if created:
            click.echo("Users created:")
            for e in created:
                click.echo(f"  {e}  (password: ChangeMe123!)")
            click.echo("\n⚠  Change every password at first login.")
        else:
            click.echo("Users already exist — skipped.")

    @app.cli.command("seed-data")
    @with_appcontext
    def seed_data():
        """Load the verified Pakistan industry database."""
        stats = load_seed()
        if stats:
            click.echo("Seed load complete:")
            for k, v in stats.items():
                click.echo(f"  {k}: {v}")

    @app.cli.command("full-seed")
    @with_appcontext
    def full_seed():
        """One-shot: tables + users + data."""
        db.create_all()
        ensure_demo_users()
        stats = load_seed()
        click.echo("Done.")
        if stats:
            for k, v in stats.items():
                click.echo(f"  {k}: {v}")
