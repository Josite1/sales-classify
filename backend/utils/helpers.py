'''
Date utilities and helpers.
'''
from datetime import date, timedelta


def get_iso_week_label(date_str: str) -> str:
    d = date.fromisoformat(date_str)
    iso_year, iso_week, _ = d.isocalendar()
    return f'{iso_year}-W{iso_week:02d}'


def get_week_monday(date_str: str) -> str:
    d = date.fromisoformat(date_str)
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def get_week_sunday(monday_str: str) -> str:
    d = date.fromisoformat(monday_str)
    sunday = d + timedelta(days=6)
    return sunday.isoformat()


def format_date_readable(date_str: str) -> str:
    week_names = ['一', '二', '三', '四', '五', '六', '日']
    d = date.fromisoformat(date_str)
    return f'{d.month}月{d.day}日 周{week_names[d.weekday()]}'
