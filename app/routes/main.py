"""Main — My Week screen (the home for Sales/Manager/Admin)."""
from datetime import date, timedelta

from flask import Blueprint, render_template, redirect, url_for
from flask_login import current_user, login_required
from sqlalchemy import or_

from app.models import (OPEN_STAGES, OUTCOME_PENDING, Company, Opportunity,
                        Visit, utcnow)

bp = Blueprint("main", __name__)


@bp.route("/")
def home():
    if current_user.is_authenticated:
        if current_user.is_ceo:
            return redirect(url_for("cockpit.ceo"))
        return redirect(url_for("main.my_week"))
    return redirect(url_for("auth.login"))


@bp.route("/my-week")
@login_required
def my_week():
    uid = current_user.id
    today = date.today()
    week_end = today + timedelta(days=7)

    # Visits with pending outcome (grace window)
    pending_outcomes = (Visit.query
                       .filter(Visit.salesperson_id == uid,
                               Visit.outcome == OUTCOME_PENDING)
                       .order_by(Visit.visit_date.desc()).all())

    # Due this week
    due_this_week = (Visit.query
                    .filter(Visit.salesperson_id == uid,
                            Visit.next_action_date != None,
                            Visit.next_action_date <= week_end,
                            Visit.next_action_date >= today - timedelta(days=14))
                    .order_by(Visit.next_action_date.asc()).all())

    # My open opportunities
    my_opps = (Opportunity.query
              .filter(Opportunity.owner_id == uid,
                      Opportunity.stage.in_(OPEN_STAGES))
              .order_by(Opportunity.updated_at.desc()).limit(10).all())

    # Stuck deals
    stuck = [o for o in my_opps if o.is_stuck]

    # Dormant accounts
    my_accounts = Company.query.filter_by(owner_id=uid).all()
    dormant = [c for c in my_accounts if c.is_dormant][:10]

    return render_template(
        "my_week.html",
        pending_outcomes=pending_outcomes,
        due_this_week=due_this_week,
        my_opps=my_opps,
        stuck=stuck,
        dormant=dormant,
        today=today,
    )
