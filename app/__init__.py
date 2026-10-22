"""WR Sales Hub — Flask application factory."""
from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy

from config import Config

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message = "Please sign in to continue."
login_manager.login_message_category = "info"


def create_app(config_class=Config):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    # Ensure instance directory exists
    import os
    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    login_manager.init_app(app)

    from app.models import User

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    # Blueprints
    from app.routes.auth import bp as auth_bp
    from app.routes.main import bp as main_bp
    from app.routes.visits import bp as visits_bp
    from app.routes.accounts import bp as accounts_bp
    from app.routes.pipeline import bp as pipeline_bp
    from app.routes.cockpit import bp as cockpit_bp
    from app.routes.admin import bp as admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(visits_bp)
    app.register_blueprint(accounts_bp)
    app.register_blueprint(pipeline_bp)
    app.register_blueprint(cockpit_bp)
    app.register_blueprint(admin_bp)

    # CLI commands
    from app.cli import register_cli
    register_cli(app)

    # Template filters
    from app.filters import register_filters
    register_filters(app)

    with app.app_context():
        db.create_all()

    return app
