"""CEO Cockpit — read-only KPI dashboard."""
from collections import defaultdict
from datetime import date, timedelta

from flask import Blueprint, render_template
from flask_login import login_required
from sqlalchemy import func

from app import db
from app.models import (OPEN_STAGES, OUTCOME_PENDING, STAGE_LOST, STAGE_WON,
                        STAGES, Company, Opportunity, User, Visit, utcnow)

bp = Blueprint("cockpit", __name__, url_prefix="/cockpit")


@bp.route("/")
@login_required
def ceo():
    # Pipeline by stage
    pipe_by_stage = {s: {"count": 0, "value": 0.0} for s in STAGES}
    for o in Opportunity.query.all():
        pipe_by_stage[o.stage]["count"] += 1
        pipe_by_stage[o.stage]["value"] += float(o.value_pkr or 0)

    open_value = sum(pipe_by_stage[s]["value"] for s in OPEN_STAGES)
    won_value = pipe_by_stage[STAGE_WON]["value"]
    lost_value = pipe_by_stage[STAGE_LOST]["value"]

    # By owner
    by_owner = defaultdict(lambda: {"name": "—", "open": 0, "value": 0.0, "visits_7d": 0})
    for u in User.query.all():
        by_owner[u.id]["name"] = u.name
    for o in Opportunity.query.filter(Opportunity.stage.in_(OPEN_STAGES)).all():
        if o.owner_id:
            by_owner[o.owner_id]["open"] += 1
            by_owner[o.owner_id]["value"] += float(o.value_pkr or 0)

    week_ago = utcnow() - timedelta(days=7)
    for v in Visit.query.filter(Visit.visit_date >= week_ago).all():
        by_owner[v.salesperson_id]["visits_7d"] += 1

    # Data-quality flags
    overdue = (Visit.query
               .filter(Visit.outcome == OUTCOME_PENDING,
                       Visit.visit_date < utcnow() - timedelta(hours=48))
               .count())
    stuck = sum(1 for o in Opportunity.query.filter(Opportunity.stage.in_(OPEN_STAGES)).all() if o.is_stuck)
    dormant_count = sum(1 for c in Company.query.filter(Company.owner_id != None).all() if c.is_dormant)

    totals = {
        "accounts": Company.query.count(),
        "contacts_verified": 0,
        "open_opps": Opportunity.query.filter(Opportunity.stage.in_(OPEN_STAGES)).count(),
        "open_value": open_value,
        "won_value": won_value,
        "lost_value": lost_value,
        "visits_7d": Visit.query.filter(Visit.visit_date >= week_ago).count(),
    }

    return render_template(
        "cockpit.html",
        pipe_by_stage=pipe_by_stage,
        by_owner=sorted(by_owner.values(), key=lambda r: -r["value"]),
        totals=totals,
        flags={"overdue_outcomes": overdue, "stuck_deals": stuck, "dormant_accounts": dormant_count},
        stages=STAGES,
    )
