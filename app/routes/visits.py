"""Log a Visit — the enforcement screen."""
from datetime import datetime, timezone

from flask import (Blueprint, abort, flash, redirect, render_template, request,
                   url_for)
from flask_login import current_user, login_required

from app import db
from app.decorators import write_required
from app.models import (OUTCOME_PENDING, OUTCOME_SKIPPED, OUTCOMES,
                        SKIP_REASONS, VISIT_TYPES, Company, Opportunity, Visit,
                        log_action, utcnow)

bp = Blueprint("visits", __name__, url_prefix="/visits")


@bp.route("/")
@login_required
def list_visits():
    uid = current_user.id
    q = Visit.query
    if not current_user.is_manager:
        q = q.filter(Visit.salesperson_id == uid)
    visits = q.order_by(Visit.visit_date.desc()).limit(100).all()
    return render_template("visits/list.html", visits=visits)


@bp.route("/new", methods=["GET", "POST"])
@write_required
def new_visit():
    companies = Company.query.order_by(Company.name).all()

    if request.method == "POST":
        try:
            company_id = int(request.form["company_id"])
        except (KeyError, ValueError):
            flash("Please choose a company.", "danger")
            return redirect(url_for("visits.new_visit"))

        visit_date_s = request.form.get("visit_date") or ""
        try:
            visit_date = datetime.fromisoformat(visit_date_s).replace(tzinfo=timezone.utc)
        except ValueError:
            visit_date = utcnow()

        v = Visit(
            visit_type=request.form.get("visit_type") or "Visit",
            visit_date=visit_date,
            company_id=company_id,
            opportunity_id=request.form.get("opportunity_id") or None,
            salesperson_id=current_user.id,
            contact_met=request.form.get("contact_met") or None,
            discussion=request.form.get("discussion") or None,
            outcome=request.form.get("outcome") or OUTCOME_PENDING,
            skip_reason=request.form.get("skip_reason") or None,
            next_action=request.form.get("next_action") or None,
        )
        next_date = request.form.get("next_action_date")
        if next_date:
            try:
                v.next_action_date = datetime.fromisoformat(next_date).date()
            except ValueError:
                pass

        # Soft-block: skipped requires a reason
        if v.outcome == OUTCOME_SKIPPED and not v.skip_reason:
            flash("A skip reason is required when outcome is Skipped.", "danger")
            return render_template("visits/new.html",
                                   companies=companies,
                                   outcomes=OUTCOMES,
                                   visit_types=VISIT_TYPES,
                                   skip_reasons=SKIP_REASONS,
                                   form=request.form)

        db.session.add(v)
        db.session.flush()
        log_action(current_user, "visit", v.id, "created",
                   f"Company #{company_id} · {v.outcome}")
        db.session.commit()
        flash("Visit logged.", "success")
        return redirect(url_for("main.my_week"))

    return render_template(
        "visits/new.html",
        companies=companies,
        outcomes=OUTCOMES,
        visit_types=VISIT_TYPES,
        skip_reasons=SKIP_REASONS,
        form={},
    )


@bp.route("/<int:visit_id>/outcome", methods=["POST"])
@write_required
def set_outcome(visit_id):
    v = db.session.get(Visit, visit_id) or abort(404)
    if v.salesperson_id != current_user.id and not current_user.is_manager:
        abort(403)

    outcome = request.form.get("outcome") or OUTCOME_PENDING
    reason = request.form.get("skip_reason") or None

    if outcome == OUTCOME_SKIPPED and not reason:
        flash("Reason required when outcome is Skipped.", "danger")
        return redirect(url_for("main.my_week"))

    v.outcome = outcome
    v.skip_reason = reason if outcome == OUTCOME_SKIPPED else None
    if outcome != OUTCOME_PENDING:
        v.outcome_locked_at = utcnow()

    log_action(current_user, "visit", v.id, "outcome_set", f"{outcome} / {reason or '-'}")
    db.session.commit()
    flash("Outcome recorded.", "success")
    return redirect(request.referrer or url_for("main.my_week"))
