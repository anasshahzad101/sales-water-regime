"""Seed loader — imports from WR_Pakistan_Industry_Master_FINAL.xlsx.

Loads: Sectors + Sub-sectors + Cities + Companies + the WR Active Pipeline
       as initial Opportunities (so day-1 the Cockpit is not empty).

Idempotent: skips a company if a row with the same name already exists.
"""
from decimal import Decimal, InvalidOperation
from pathlib import Path

from openpyxl import load_workbook

from app import db
from app.models import (STAGE_LEAD, STAGE_QUALIFIED, STAGE_PROPOSAL, City,
                        Company, Opportunity, ParentGroup, Region, Sector,
                        SubSector, User, utcnow)

SEED_PATH = Path(__file__).resolve().parent.parent / "seed_data" / "WR_Pakistan_Industry_Master_FINAL.xlsx"


def _get_or_create(model, defaults=None, **kwargs):
    inst = model.query.filter_by(**kwargs).first()
    if inst:
        return inst, False
    data = dict(kwargs)
    if defaults:
        data.update(defaults)
    inst = model(**data)
    db.session.add(inst)
    db.session.flush()
    return inst, True


def _norm(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _parse_decimal(v):
    if v is None:
        return None
    try:
        s = str(v).replace(",", "").replace("PKR", "").strip()
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def load_seed(path: Path = SEED_PATH):
    if not path.exists():
        print(f"Seed file not found: {path}")
        return

    wb = load_workbook(path, data_only=True, read_only=True)
    stats = {"sectors": 0, "sub_sectors": 0, "cities": 0, "companies": 0,
             "pipeline_opps": 0, "skipped": 0}

    # One region for Pakistan (future-proof for international expansion)
    pk, _ = _get_or_create(Region, name="Pakistan")
    db.session.flush()

    # ---- New Target Accounts (299) ----
    s = wb["New Target Accounts"]
    header = None
    for row in s.iter_rows(values_only=True):
        if header is None:
            header = row
            continue
        if not row or not row[1]:
            continue
        (_, name, group, sector_name, sub_name, city_name, _prov,
         water_need, wr_solution, dm_titles, priority, basis,
         evidence, first_step, remarks, added_in, source) = row[:17]

        name = _norm(name)
        if not name or Company.query.filter_by(name=name).first():
            stats["skipped"] += 1
            continue

        sector = None
        if _norm(sector_name):
            sector, created = _get_or_create(Sector, name=_norm(sector_name))
            if created:
                stats["sectors"] += 1

        sub = None
        if sector and _norm(sub_name):
            sub, created = _get_or_create(SubSector, name=_norm(sub_name), sector_id=sector.id)
            if created:
                stats["sub_sectors"] += 1

        city = None
        if _norm(city_name):
            city, created = _get_or_create(City, name=_norm(city_name), region_id=pk.id)
            if created:
                stats["cities"] += 1

        pg = None
        if _norm(group):
            pg, _ = _get_or_create(ParentGroup, name=_norm(group))

        notes_parts = []
        if _norm(wr_solution):
            notes_parts.append(f"WR solution: {_norm(wr_solution)}")
        if _norm(dm_titles):
            notes_parts.append(f"Target DMs: {_norm(dm_titles)}")
        if _norm(basis):
            notes_parts.append(f"Basis: {_norm(basis)}")
        if _norm(evidence):
            notes_parts.append(f"Evidence: {_norm(evidence)}")
        if _norm(first_step):
            notes_parts.append(f"First step: {_norm(first_step)}")
        if _norm(remarks):
            notes_parts.append(f"Remarks: {_norm(remarks)}")
        if _norm(source):
            notes_parts.append(f"Source: {_norm(source)}")

        c = Company(
            name=name,
            parent_group_id=pg.id if pg else None,
            sector_id=sector.id if sector else None,
            sub_sector_id=sub.id if sub else None,
            city_id=city.id if city else None,
            priority=_norm(priority),
            lead_source="Target",
            water_need=_norm(water_need),
            notes="\n".join(notes_parts) or None,
            status="active",
        )
        db.session.add(c)
        stats["companies"] += 1

    # ---- WR Active Pipeline → Opportunities ----
    try:
        s = wb["WR Active Pipeline"]
    except KeyError:
        s = None
    if s is not None:
        header = None
        for row in s.iter_rows(values_only=True):
            if header is None:
                header = row
                continue
            if not row or not row[1]:
                continue
            (_, account, sector_name, tier, status, opp_desc, wr_solution,
             dm_titles, pipe_val, close_val, next_action) = row[:11]

            name = _norm(account)
            if not name:
                continue
            company = Company.query.filter_by(name=name).first()
            if not company:
                sector = None
                if _norm(sector_name):
                    sector, _ = _get_or_create(Sector, name=_norm(sector_name))
                company = Company(
                    name=name,
                    sector_id=sector.id if sector else None,
                    lead_source="WR Pipeline",
                    priority="P1" if (tier and "A" in str(tier)) else "P2",
                    notes=_norm(status),
                    status="active",
                )
                db.session.add(company)
                db.session.flush()
                stats["companies"] += 1

            # Create one opportunity from the WR pipeline row
            title = (_norm(opp_desc) or f"{name} — Water Regime opportunity")[:230]

            stage = STAGE_QUALIFIED
            s_lower = (_norm(status) or "").lower()
            if "proposal" in s_lower or "quotation" in s_lower:
                stage = STAGE_PROPOSAL
            elif "existing" in s_lower or "repeat" in s_lower:
                stage = STAGE_QUALIFIED
            elif "lead" in s_lower:
                stage = STAGE_LEAD

            opp = Opportunity(
                title=title,
                company_id=company.id,
                stage=stage,
                stage_entered_at=utcnow(),
                solution_type=(_norm(wr_solution) or "")[:80] or None,
                value_pkr=_parse_decimal(pipe_val),
                probability=50,
                notes=f"From WR pipeline file. DMs: {_norm(dm_titles) or '—'}. Next: {_norm(next_action) or '—'}",
            )
            db.session.add(opp)
            stats["pipeline_opps"] += 1

    db.session.commit()
    return stats


def ensure_demo_users():
    """Create initial admin + sales users if none exist."""
    if User.query.count() > 0:
        return []
    seeds = [
        ("Haroon Rasheed", "haroon@waterregime.com", "admin", "ChangeMe123!"),
        ("Qasim Zafar", "qasim@waterregime.com", "admin", "ChangeMe123!"),
        ("Khalid Usman (CEO)", "khalid@waterregime.com", "ceo", "ChangeMe123!"),
        ("Sales Manager", "manager@waterregime.com", "manager", "ChangeMe123!"),
        ("Sales Executive", "sales@waterregime.com", "sales", "ChangeMe123!"),
    ]
    created = []
    for name, email, role, pw in seeds:
        u = User(name=name, email=email, role=role)
        u.set_password(pw)
        db.session.add(u)
        created.append(email)
    db.session.commit()
    return created
