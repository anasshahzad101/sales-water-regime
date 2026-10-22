"""Role decorators."""
from functools import wraps

from flask import abort, flash, redirect, url_for
from flask_login import current_user


def role_required(*roles):
    def deco(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for("auth.login"))
            if current_user.role not in roles:
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return deco


def write_required(f):
    """Blocks the CEO (read-only) from any mutating action."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for("auth.login"))
        if not current_user.can_edit:
            flash("Read-only account — this action is disabled.", "warning")
            return redirect(url_for("main.my_week"))
        return f(*args, **kwargs)
    return wrapper
