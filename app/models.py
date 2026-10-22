"""WR Sales Hub — SQLAlchemy data model.

Hierarchy: Region → City → Sector → Sub-sector → Company → Contact
           Opportunity (6 stages) → Visit/Activity → Proposal
Companies group: Parent Group → Brand → Plant Unit

Roles: sales / manager / ceo (read-only) / admin
"""
from datetime import datetime, timedelta, timezone

from flask_login import UserMixin
from sqlalchemy import Index, func
from werkzeug.security import check_password_hash, generate_password_hash

from app import db


def utcnow():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# USERS & ROLES
# ---------------------------------------------------------------------------
ROLE_SALES = "sales"
ROLE_MANAGER = "manager"
ROLE_CEO = "ceo"
ROLE_ADMIN = "admin"
ROLES = (ROLE_SALES, ROLE_MANAGER, ROLE_CEO, ROLE_ADMIN)


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(16), nullable=False, default=ROLE_SALES)
    region = db.Column(db.String(80))  # which region they cover
    is_active_flag = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    opportunities = db.relationship("Opportunity", back_populates="owner")
    visits = db.relationship("Visit", back_populates="salesperson")

    def set_password(self, pw: str):
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw: str) -> bool:
        return check_password_hash(self.password_hash, pw)

    @property
    def is_active(self):  # Flask-Login
        return self.is_active_flag

    @property
    def is_ceo(self):
        return self.role == ROLE_CEO

    @property
    def is_admin(self):
        return self.role == ROLE_ADMIN

    @property
    def is_manager(self):
        return self.role in (ROLE_MANAGER, ROLE_ADMIN)

    @property
    def can_edit(self):
        """CEO is read-only; everyone else can write."""
        return self.role != ROLE_CEO

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


# ---------------------------------------------------------------------------
# GEOGRAPHY & INDUSTRY TAXONOMY
# ---------------------------------------------------------------------------
class Region(db.Model):
    __tablename__ = "regions"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    cities = db.relationship("City", back_populates="region")


class City(db.Model):
    __tablename__ = "cities"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    region_id = db.Column(db.Integer, db.ForeignKey("regions.id"), nullable=False)
    region = db.relationship("Region", back_populates="cities")
    __table_args__ = (db.UniqueConstraint("name", "region_id", name="uq_city_region"),)


class Sector(db.Model):
    __tablename__ = "sectors"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    sub_sectors = db.relationship("SubSector", back_populates="sector")


class SubSector(db.Model):
    __tablename__ = "sub_sectors"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    sector_id = db.Column(db.Integer, db.ForeignKey("sectors.id"), nullable=False)
    sector = db.relationship("Sector", back_populates="sub_sectors")
    __table_args__ = (db.UniqueConstraint("name", "sector_id", name="uq_subsector"),)


# ---------------------------------------------------------------------------
# COMPANIES (grouped: Parent Group → Brand → Plant Unit)
# ---------------------------------------------------------------------------
class ParentGroup(db.Model):
    __tablename__ = "parent_groups"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)


class Company(db.Model):
    """A company record — may be a brand or a specific plant unit under a Parent Group."""
    __tablename__ = "companies"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(240), nullable=False)
    brand = db.Column(db.String(240))          # e.g., "Coca-Cola Icecek"
    plant_unit = db.Column(db.String(240))     # e.g., "Lahore Plant"
    parent_group_id = db.Column(db.Integer, db.ForeignKey("parent_groups.id"))
    parent_group = db.relationship("ParentGroup")

    sector_id = db.Column(db.Integer, db.ForeignKey("sectors.id"))
    sub_sector_id = db.Column(db.Integer, db.ForeignKey("sub_sectors.id"))
    sector = db.relationship("Sector")
    sub_sector = db.relationship("SubSector")

    city_id = db.Column(db.Integer, db.ForeignKey("cities.id"))
    city = db.relationship("City")

    # Opportunity profile
    priority = db.Column(db.String(4))         # P1 / P2 / P3
    lead_source = db.Column(db.String(80))     # Target / Live Signal / WR Pipeline / Partner
    water_need = db.Column(db.String(240))     # short description
    estimated_cap_mld = db.Column(db.Float)    # capacity, million litres / day
    notes = db.Column(db.Text)

    website = db.Column(db.String(240))
    status = db.Column(db.String(32), default="active")  # active / dormant / archived

    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    owner = db.relationship("User", foreign_keys=[owner_id])

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    contacts = db.relationship("Contact", back_populates="company", cascade="all, delete-orphan")
    opportunities = db.relationship("Opportunity", back_populates="company", cascade="all, delete-orphan")
    visits = db.relationship("Visit", back_populates="company")

    __table_args__ = (
        Index("ix_company_name", "name"),
        Index("ix_company_sector", "sector_id"),
    )

    @property
    def last_touch(self):
        if not self.visits:
            return None
        return max(v.visit_date for v in self.visits if v.visit_date)

    @property
    def is_dormant(self):
        from flask import current_app
        last = self.last_touch
        if last is None:
            return True
        days = (utcnow() - last).days
        return days > current_app.config.get("DORMANT_DAYS", 60)


class Contact(db.Model):
    __tablename__ = "contacts"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False)
    title = db.Column(db.String(160))
    email = db.Column(db.String(160))
    phone = db.Column(db.String(60))
    linkedin = db.Column(db.String(240))
    is_primary = db.Column(db.Boolean, default=False)
    verification_status = db.Column(db.String(32), default="to_confirm")  # verified / to_confirm

    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)
    company = db.relationship("Company", back_populates="contacts")

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------------------
# OPPORTUNITIES — 6 stages
# ---------------------------------------------------------------------------
STAGE_LEAD = "Lead"
STAGE_QUALIFIED = "Qualified"
STAGE_PROPOSAL = "Proposal Submitted"
STAGE_NEGOTIATION = "Negotiation"
STAGE_WON = "Won (PO)"
STAGE_LOST = "Lost"
STAGES = (STAGE_LEAD, STAGE_QUALIFIED, STAGE_PROPOSAL, STAGE_NEGOTIATION, STAGE_WON, STAGE_LOST)
OPEN_STAGES = (STAGE_LEAD, STAGE_QUALIFIED, STAGE_PROPOSAL, STAGE_NEGOTIATION)


class Opportunity(db.Model):
    __tablename__ = "opportunities"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(240), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)
    company = db.relationship("Company", back_populates="opportunities")

    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    owner = db.relationship("User", back_populates="opportunities")

    stage = db.Column(db.String(32), default=STAGE_LEAD, nullable=False)
    stage_entered_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    solution_type = db.Column(db.String(80))   # RO / ETP / STP / MBR / ZLD / UF / Mixed
    value_pkr = db.Column(db.Numeric(14, 2))
    probability = db.Column(db.Integer, default=20)
    expected_close = db.Column(db.Date)

    lost_reason = db.Column(db.String(240))
    notes = db.Column(db.Text)

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    proposals = db.relationship("Proposal", back_populates="opportunity", cascade="all, delete-orphan")
    visits = db.relationship("Visit", back_populates="opportunity")

    @property
    def is_open(self):
        return self.stage in OPEN_STAGES

    @property
    def days_in_stage(self):
        if not self.stage_entered_at:
            return 0
        return (utcnow() - self.stage_entered_at).days

    @property
    def is_stuck(self):
        from flask import current_app
        return self.is_open and self.days_in_stage > current_app.config.get("STUCK_STAGE_DAYS", 30)

    def move_to_stage(self, new_stage: str):
        if new_stage not in STAGES:
            raise ValueError(f"Invalid stage: {new_stage}")
        if new_stage != self.stage:
            self.stage = new_stage
            self.stage_entered_at = utcnow()


# ---------------------------------------------------------------------------
# VISITS & ACTIVITIES  (with soft-block + reason-code + grace window)
# ---------------------------------------------------------------------------
VISIT_TYPES = ("Visit", "Call", "Email", "Meeting", "Site Survey", "Proposal Meeting")

OUTCOME_PENDING = "Pending"
OUTCOME_POSITIVE = "Positive — move forward"
OUTCOME_NEUTRAL = "Neutral — info only"
OUTCOME_NEGATIVE = "Negative — pushback"
OUTCOME_NO_SHOW = "No show / rescheduled"
OUTCOME_SKIPPED = "Skipped — reason required"
OUTCOMES = (OUTCOME_PENDING, OUTCOME_POSITIVE, OUTCOME_NEUTRAL,
            OUTCOME_NEGATIVE, OUTCOME_NO_SHOW, OUTCOME_SKIPPED)

SKIP_REASONS = (
    "Client unavailable",
    "Rescheduled by client",
    "Travel / logistics",
    "Internal priority shift",
    "No access to decision maker",
    "Other (specify in notes)",
)


class Visit(db.Model):
    __tablename__ = "visits"

    id = db.Column(db.Integer, primary_key=True)
    visit_type = db.Column(db.String(32), default="Visit", nullable=False)
    visit_date = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)
    company = db.relationship("Company", back_populates="visits")

    opportunity_id = db.Column(db.Integer, db.ForeignKey("opportunities.id"))
    opportunity = db.relationship("Opportunity", back_populates="visits")

    salesperson_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    salesperson = db.relationship("User", back_populates="visits")

    contact_met = db.Column(db.String(240))
    discussion = db.Column(db.Text)

    outcome = db.Column(db.String(40), default=OUTCOME_PENDING, nullable=False)
    skip_reason = db.Column(db.String(120))         # required when outcome == SKIPPED
    next_action = db.Column(db.String(240))
    next_action_date = db.Column(db.Date)

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    outcome_locked_at = db.Column(db.DateTime(timezone=True))   # when the 48h grace closed

    @property
    def hours_since_visit(self):
        if not self.visit_date:
            return 0
        return (utcnow() - self.visit_date).total_seconds() / 3600.0

    @property
    def grace_remaining_hours(self):
        from flask import current_app
        grace = current_app.config.get("OUTCOME_GRACE_HOURS", 48)
        return max(0.0, grace - self.hours_since_visit)

    @property
    def outcome_overdue(self):
        return self.outcome == OUTCOME_PENDING and self.grace_remaining_hours == 0

    @property
    def is_locked(self):
        """Outcome locked once grace closes AND outcome is set, OR outcome is skipped with reason."""
        return self.outcome_locked_at is not None


# ---------------------------------------------------------------------------
# PROPOSALS
# ---------------------------------------------------------------------------
class Proposal(db.Model):
    __tablename__ = "proposals"

    id = db.Column(db.Integer, primary_key=True)
    opportunity_id = db.Column(db.Integer, db.ForeignKey("opportunities.id"), nullable=False)
    opportunity = db.relationship("Opportunity", back_populates="proposals")

    reference = db.Column(db.String(80))
    submitted_on = db.Column(db.Date, default=lambda: utcnow().date())
    amount_pkr = db.Column(db.Numeric(14, 2))
    status = db.Column(db.String(32), default="submitted")  # submitted / revised / accepted / rejected
    notes = db.Column(db.Text)

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------------------
# AUDIT LOG — who changed what, so nothing can be hidden silently
# ---------------------------------------------------------------------------
class AuditLog(db.Model):
    __tablename__ = "audit_log"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    entity = db.Column(db.String(40))           # e.g., opportunity / visit / company
    entity_id = db.Column(db.Integer)
    action = db.Column(db.String(40))           # created / updated / stage_changed / skipped
    detail = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)


def log_action(user, entity: str, entity_id: int, action: str, detail: str = ""):
    db.session.add(AuditLog(
        user_id=user.id if user else None,
        entity=entity, entity_id=entity_id, action=action, detail=detail,
    ))
