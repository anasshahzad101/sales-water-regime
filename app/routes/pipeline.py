"""Opportunity (pipeline) routes — Team Pulse + opportunity CRUD."""
from datetime import datetime, timezone

from flask import (Blueprint, abort, flash, redirect, render_template, request,
                   url_for)
from flask_login import current_user, login_required
from sqlalchemy import func

from app import db
from app.decorators import write_required
from app.models import (OPEN_STAGES, STAGES, STAGE_LOST, STAGE_WON, Company,
                        Opportunity, Proposal, User, log_action, utcnow)

bp = Blueprint("pipeline", __name__, url_prefix="/pipeline")


@bp.route("/")
@login_required
def board():
    """Team Pulse — kanban-style stage view."""
    scope = request.args.get("scope", "team" if current_user.is_manager else "mine")

    q = Opportunity.query
    if scope == "mine":
        q = q.filter(Opportunity.owner_id == current_user.id)

    all_opps = q.all()
    buckets = {s: [] for s in STAGES}
    for o in all_opps:
        buckets[o.stage].append(o)

    totals = {s: sum(float(o.value_pkr or 0) for o in buckets[s]) for s in STAGES}

    return render_template("pipeline/board.html",
                           buckets=buckets, totals=totals, scope=scope, stages=STAGES)


@bp.route("/new", methods=["GET", "POST"])
@write_required
def new_opp():
    companies = Company.query.order_by(Company.name).all()
    if request.method == "POST":
        try:
            cid = int(request.form["company_id"])
        except (KeyError, ValueError):
            flash("Please choose a company.", "danger")
            return redirect(url_for("pipeline.new_opp"))

        opp = Opportunity(
            title=(request.form.get("title") or "").strip() or "New opportunity",
            company_id=cid,
            owner_id=current_user.id,
            stage=request.form.get("stage") or "Lead",
            stage_entered_at=utcnow(),
            solution_type=request.form.get("solution_type") or None,
            value_pkr=request.form.get("value_pkr") or None,
            probability=int(request.form.get("probability") or 20),
            notes=request.form.get("notes") or None,
        )
        close = request.form.get("expected_close")
        if close:
            try:
                opp.expected_close = datetime.fromisoformat(close).date()
            except ValueError:
                pass
        db.session.add(opp)
        db.session.flush()
        log_action(current_user, "opportunity", opp.id, "created", opp.title)
        db.session.commit()
        flash("Opportunity created.", "success")
        return redirect(url_for("pipeline.detail", opp_id=opp.id))

    return render_template("pipeline/new.html",
                           companies=companies, stages=STAGES, form={})


@bp.route("/<int:opp_id>")
@login_required
def detail(opp_id):
    o = db.session.get(Opportunity, opp_id) or abort(404)
    return render_template("pipeline/detail.html", opp=o, stages=STAGES)


@bp.route("/<int:opp_id>/stage", methods=["POST"])
@write_required
def change_stage(opp_id):
    o = db.session.get(Opportunity, opp_id) or abort(404)
    if o.owner_id != current_user.id and not current_user.is_manager:
        abort(403)
    new_stage = request.form.get("stage")
    lost_reason = request.form.get("lost_reason") or None

    if new_stage == STAGE_LOST and not lost_reason:
        flash("Lost reason is required.", "danger")
        return redirect(url_for("pipeline.detail", opp_id=o.id))

    try:
        o.move_to_stage(new_stage)
    except ValueError:
        flash("Invalid stage.", "danger")
        return redirect(url_for("pipeline.detail", opp_id=o.id))

    if new_stage == STAGE_LOST:
        o.lost_reason = lost_reason
        o.probability = 0
    elif new_stage == STAGE_WON:
        o.probability = 100

    log_action(current_user, "opportunity", o.id, "stage_changed",
               f"-> {new_stage}" + (f" ({lost_reason})" if lost_reason else ""))
    db.session.commit()
    flash(f"Stage moved to {new_stage}.", "success")
    return redirect(url_for("pipeline.detail", opp_id=o.id))


@bp.route("/<int:opp_id>/proposal", methods=["POST"])
@write_required
def add_proposal(opp_id):
    o = db.session.get(Opportunity, opp_id) or abort(404)
    p = Proposal(
        opportunity_id=o.id,
        reference=request.form.get("reference") or None,
        amount_pkr=request.form.get("amount_pkr") or None,
        notes=request.form.get("notes") or None,
    )
    date_s = request.form.get("submitted_on")
    if date_s:
        try:
            p.submitted_on = datetime.fromisoformat(date_s).date()
        except ValueError:
            pass
    db.session.add(p)
    log_action(current_user, "proposal", 0, "created", f"Opp #{o.id}")
    db.session.commit()
    flash("Proposal recorded.", "success")
    return redirect(url_for("pipeline.detail", opp_id=o.id))
