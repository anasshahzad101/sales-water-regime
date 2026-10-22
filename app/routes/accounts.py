"""My Accounts — company list and detail."""
from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import or_

from app import db
from app.decorators import write_required
from app.models import (Company, Contact, Opportunity, STAGES, OPEN_STAGES,
                        Sector, City, log_action)

bp = Blueprint("accounts", __name__, url_prefix="/accounts")


@bp.route("/")
@login_required
def list_accounts():
    q = Company.query
    search = request.args.get("q", "").strip()
    sector_id = request.args.get("sector", "").strip()
    scope = request.args.get("scope", "all")  # mine / all

    if scope == "mine" and not current_user.is_manager:
        q = q.filter(Company.owner_id == current_user.id)
    elif scope == "mine":
        q = q.filter(Company.owner_id == current_user.id)

    if search:
        like = f"%{search}%"
        q = q.filter(or_(Company.name.ilike(like),
                         Company.brand.ilike(like),
                         Company.plant_unit.ilike(like)))

    if sector_id.isdigit():
        q = q.filter(Company.sector_id == int(sector_id))

    companies = q.order_by(Company.name).limit(500).all()
    sectors = Sector.query.order_by(Sector.name).all()
    return render_template("accounts/list.html",
                           companies=companies, sectors=sectors,
                           search=search, sector_id=sector_id, scope=scope)


@bp.route("/<int:company_id>")
@login_required
def detail(company_id):
    c = db.session.get(Company, company_id) or abort(404)
    opps = Opportunity.query.filter_by(company_id=c.id).order_by(Opportunity.updated_at.desc()).all()
    return render_template("accounts/detail.html", company=c, opps=opps, stages=STAGES)


@bp.route("/<int:company_id>/claim", methods=["POST"])
@write_required
def claim(company_id):
    c = db.session.get(Company, company_id) or abort(404)
    c.owner_id = current_user.id
    log_action(current_user, "company", c.id, "claimed", c.name)
    db.session.commit()
    flash(f"{c.name} is now in your accounts.", "success")
    return redirect(url_for("accounts.detail", company_id=c.id))


@bp.route("/<int:company_id>/contact", methods=["POST"])
@write_required
def add_contact(company_id):
    c = db.session.get(Company, company_id) or abort(404)
    name = (request.form.get("name") or "").strip()
    if not name:
        flash("Contact name is required.", "danger")
        return redirect(url_for("accounts.detail", company_id=c.id))
    contact = Contact(
        name=name,
        title=request.form.get("title") or None,
        email=request.form.get("email") or None,
        phone=request.form.get("phone") or None,
        linkedin=request.form.get("linkedin") or None,
        is_primary=bool(request.form.get("is_primary")),
        verification_status=request.form.get("verification_status") or "to_confirm",
        company_id=c.id,
    )
    db.session.add(contact)
    log_action(current_user, "contact", 0, "created", f"{c.name} / {name}")
    db.session.commit()
    flash("Contact added.", "success")
    return redirect(url_for("accounts.detail", company_id=c.id))
