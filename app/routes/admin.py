"""Admin — user management (admin role only)."""
from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app import db
from app.decorators import role_required
from app.models import ROLES, ROLE_ADMIN, User, log_action

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.before_request
@login_required
def gate():
    if not current_user.is_admin:
        abort(403)


@bp.route("/users")
def users():
    users = User.query.order_by(User.created_at.desc()).all()
    return render_template("admin/users.html", users=users, roles=ROLES)


@bp.route("/users/new", methods=["POST"])
def new_user():
    name = (request.form.get("name") or "").strip()
    email = (request.form.get("email") or "").strip().lower()
    role = request.form.get("role") or "sales"
    password = request.form.get("password") or ""
    region = request.form.get("region") or None

    if not (name and email and password):
        flash("Name, email and password required.", "danger")
        return redirect(url_for("admin.users"))
    if User.query.filter_by(email=email).first():
        flash("Email already exists.", "danger")
        return redirect(url_for("admin.users"))
    if role not in ROLES:
        flash("Invalid role.", "danger")
        return redirect(url_for("admin.users"))
    if len(password) < 8:
        flash("Password must be at least 8 characters.", "danger")
        return redirect(url_for("admin.users"))

    u = User(name=name, email=email, role=role, region=region)
    u.set_password(password)
    db.session.add(u)
    db.session.flush()
    log_action(current_user, "user", u.id, "created", f"{email} / {role}")
    db.session.commit()
    flash(f"User {email} created.", "success")
    return redirect(url_for("admin.users"))


@bp.route("/users/<int:uid>/toggle", methods=["POST"])
def toggle_user(uid):
    u = db.session.get(User, uid) or abort(404)
    if u.id == current_user.id:
        flash("You cannot deactivate your own account.", "danger")
        return redirect(url_for("admin.users"))
    u.is_active_flag = not u.is_active_flag
    log_action(current_user, "user", u.id, "toggled",
               "active" if u.is_active_flag else "inactive")
    db.session.commit()
    return redirect(url_for("admin.users"))
