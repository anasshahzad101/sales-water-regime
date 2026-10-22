"""Jinja template filters."""
from datetime import datetime, timezone


def register_filters(app):
    @app.template_filter("money")
    def money(v):
        if v is None:
            return "—"
        try:
            v = float(v)
        except (TypeError, ValueError):
            return str(v)
        if v >= 1_000_000:
            return f"PKR {v/1_000_000:,.1f}M"
        if v >= 1_000:
            return f"PKR {v/1_000:,.0f}K"
        return f"PKR {v:,.0f}"

    @app.template_filter("date_only")
    def date_only(dt):
        if dt is None:
            return "—"
        if hasattr(dt, "strftime"):
            return dt.strftime("%d %b %Y")
        return str(dt)

    @app.template_filter("datetime_short")
    def datetime_short(dt):
        if dt is None:
            return "—"
        return dt.strftime("%d %b, %H:%M")

    @app.template_filter("humanize_hours")
    def humanize_hours(h):
        if h is None:
            return "—"
        if h < 1:
            return f"{int(h*60)} min"
        if h < 24:
            return f"{h:.1f} hrs"
        return f"{h/24:.1f} days"

    @app.template_filter("stage_colour")
    def stage_colour(stage):
        return {
            "Lead": "slate",
            "Qualified": "sky",
            "Proposal Submitted": "indigo",
            "Negotiation": "amber",
            "Won (PO)": "emerald",
            "Lost": "rose",
        }.get(stage, "slate")
