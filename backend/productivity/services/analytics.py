"""
Productivity Analytics Service (Phase 6 — Productivity Intelligence).

Transforms Git commit history (from CommitMemory) into actionable,
grounded repository activity insights.

Key Design Decisions & Policies:
1. Timestamp Consistency: All calculations strictly use CommitMemory.committed_date.
2. Neutral Framing: Activity data reflects development history, NOT developer evaluation.
3. Churn Separation: Explicitly separates Net Line Change (additions - deletions) from
   Total Change Volume (additions + deletions).
4. Continuous Timelines: Automatically populates empty dates/weeks/months with zero-values
   so time-series charts maintain unbroken continuity.
5. Missing Diff Handling: When GitHub diff stats are unavailable, flags stats_available=False
   instead of treating missing values as zero.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from django.db.models import QuerySet
from django.utils.dateparse import parse_datetime, parse_date

from memory.models import CommitMemory
from repositories.models import Repository


# ─── Time Range Helpers ───────────────────────────────────────────────────────

def resolve_time_bounds(
    time_range: str = '30d',
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None,
    reference_time: Optional[datetime] = None,
) -> Tuple[Optional[datetime], Optional[datetime], str]:
    """
    Compute timezone-aware start and end datetime bounds.

    Returns:
        (start_dt, end_dt, effective_range_label)
    """
    now = reference_time or datetime.now(timezone.utc)

    if time_range == 'custom' and (start_date_str or end_date_str):
        start_dt = None
        end_dt = None
        if start_date_str:
            parsed_start = parse_datetime(start_date_str) or parse_date(start_date_str)
            if isinstance(parsed_start, datetime):
                start_dt = parsed_start if parsed_start.tzinfo else parsed_start.replace(tzinfo=timezone.utc)
            elif parsed_start:
                start_dt = datetime(parsed_start.year, parsed_start.month, parsed_start.day, tzinfo=timezone.utc)

        if end_date_str:
            parsed_end = parse_datetime(end_date_str) or parse_date(end_date_str)
            if isinstance(parsed_end, datetime):
                end_dt = parsed_end if parsed_end.tzinfo else parsed_end.replace(tzinfo=timezone.utc)
            elif parsed_end:
                # end of the given day
                end_dt = datetime(parsed_end.year, parsed_end.month, parsed_end.day, 23, 59, 59, tzinfo=timezone.utc)

        if not end_dt:
            end_dt = now

        return start_dt, end_dt, 'custom'

    if time_range == '7d':
        return now - timedelta(days=7), now, '7d'
    elif time_range == '30d':
        return now - timedelta(days=30), now, '30d'
    elif time_range == '90d':
        return now - timedelta(days=90), now, '90d'
    elif time_range == '6m':
        return now - timedelta(days=180), now, '6m'
    elif time_range == '12m':
        return now - timedelta(days=365), now, '12m'
    elif time_range == 'all':
        return None, now, 'all'
    else:
        # Default fallback to 30d
        return now - timedelta(days=30), now, '30d'


def compute_previous_period_bounds(
    start_dt: Optional[datetime],
    end_dt: datetime,
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """
    Compute matching previous period bounds for trend comparison.
    """
    if not start_dt:
        return None, None
    duration = end_dt - start_dt
    prev_end = start_dt
    prev_start = prev_end - duration
    return prev_start, prev_end


# ─── Bucket Key Helpers ───────────────────────────────────────────────────────

def _get_bucket_key(dt: datetime, aggregation: str) -> str:
    """Format datetime into a bucket string based on aggregation interval."""
    if aggregation == 'monthly':
        return dt.strftime('%Y-%m')
    elif aggregation == 'weekly':
        # Start of the week (Monday)
        start_of_week = dt - timedelta(days=dt.weekday())
        return start_of_week.strftime('%Y-%m-%d')
    else:  # daily
        return dt.strftime('%Y-%m-%d')


def _generate_continuous_buckets(
    start_dt: Optional[datetime],
    end_dt: datetime,
    aggregation: str,
) -> List[str]:
    """Generate all continuous bucket keys between start_dt and end_dt."""
    if not start_dt:
        return []

    buckets = []
    current = start_dt

    if aggregation == 'monthly':
        # Align to first of month
        curr_year = current.year
        curr_month = current.month
        end_year = end_dt.year
        end_month = end_dt.month

        while (curr_year < end_year) or (curr_year == end_year and curr_month <= end_month):
            buckets.append(f"{curr_year:04d}-{curr_month:02d}")
            if curr_month == 12:
                curr_year += 1
                curr_month = 1
            else:
                curr_month += 1
    elif aggregation == 'weekly':
        curr_week_start = current - timedelta(days=current.weekday())
        curr_week_start = datetime(curr_week_start.year, curr_week_start.month, curr_week_start.day, tzinfo=timezone.utc)
        while curr_week_start <= end_dt:
            buckets.append(curr_week_start.strftime('%Y-%m-%d'))
            curr_week_start += timedelta(days=7)
    else:  # daily
        curr_day = datetime(current.year, current.month, current.day, tzinfo=timezone.utc)
        while curr_day <= end_dt:
            buckets.append(curr_day.strftime('%Y-%m-%d'))
            curr_day += timedelta(days=1)

    return buckets


# ─── Identity & Module Helpers ────────────────────────────────────────────────

def mask_email(email: str) -> str:
    """Mask email for privacy protection in UI."""
    if not email or '@' not in email:
        return ''
    parts = email.split('@')
    name = parts[0]
    domain = parts[1]
    if len(name) <= 2:
        masked_name = name[0] + '*'
    else:
        masked_name = name[0] + '*' * (len(name) - 2) + name[-1]
    return f"{masked_name}@{domain}"


def get_contributor_key(author_name: str, author_email: str) -> str:
    """
    Deterministic identifier for contributor grouping.
    Preserves original Git author identity without over-aggregating.
    """
    clean_email = (author_email or '').strip().lower()
    clean_name = (author_name or '').strip()
    if clean_email:
        return clean_email
    return clean_name or 'Unknown'


def extract_module_path(file_path: str, max_depth: int = 2) -> str:
    """
    Extract directory module path from file path.
    Top-level files are mapped to '(root)'.
    """
    clean_path = file_path.replace('\\', '/').strip('/')
    if '/' not in clean_path:
        return '(root)'
    parts = clean_path.split('/')[:-1]  # exclude file name
    depth = min(len(parts), max_depth)
    return '/'.join(parts[:depth])


# ─── Core Analytics Engine ────────────────────────────────────────────────────

def get_repository_commits(
    repository: Repository,
    start_dt: Optional[datetime] = None,
    end_dt: Optional[datetime] = None,
) -> QuerySet[CommitMemory]:
    """Retrieve filtered CommitMemory queryset ordered chronologically."""
    qs = CommitMemory.objects.filter(repository=repository)
    if start_dt:
        qs = qs.filter(committed_date__gte=start_dt)
    if end_dt:
        qs = qs.filter(committed_date__lte=end_dt)
    return qs.order_by('committed_date')


def calculate_productivity_analytics(
    repository: Repository,
    time_range: str = '30d',
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None,
    aggregation: str = 'daily',
    reference_time: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Calculate comprehensive repository productivity analytics for the given period.
    """
    start_dt, end_dt, effective_range = resolve_time_bounds(
        time_range=time_range,
        start_date_str=start_date_str,
        end_date_str=end_date_str,
        reference_time=reference_time,
    )

    # 1. Fetch relevant commits
    commits_qs = get_repository_commits(repository, start_dt, end_dt)
    commits_list = list(commits_qs)
    total_commits = len(commits_list)

    # All-time boundary check for data freshness / availability
    total_stored_commits = CommitMemory.objects.filter(repository=repository).count()
    first_ever_commit = CommitMemory.objects.filter(repository=repository).order_by('committed_date').first()
    latest_ever_commit = CommitMemory.objects.filter(repository=repository).order_by('-committed_date').first()

    data_availability = {
        'total_stored_commits': total_stored_commits,
        'earliest_commit_date': first_ever_commit.committed_date.isoformat() if first_ever_commit else None,
        'latest_commit_date': latest_ever_commit.committed_date.isoformat() if latest_ever_commit else None,
        'is_partial_history': total_stored_commits >= 250,
        'limitations_note': (
            "Analytics reflect up to 250 commits ingested from repository history. "
            "Diff statistics depend on GitHub API availability."
            if total_stored_commits >= 250 else
            "Analytics reflect all currently ingested commits."
        ),
    }

    if total_commits == 0:
        return _empty_analytics_response(
            repository=repository,
            time_range=effective_range,
            start_dt=start_dt,
            end_dt=end_dt,
            aggregation=aggregation,
            data_availability=data_availability,
        )

    # 2. Previous period calculation for delta comparison
    prev_start_dt, prev_end_dt = compute_previous_period_bounds(start_dt, end_dt)
    prev_commits_count = 0
    prev_additions = 0
    prev_deletions = 0
    prev_authors_count = 0

    if prev_start_dt and prev_end_dt:
        prev_qs = get_repository_commits(repository, prev_start_dt, prev_end_dt)
        prev_commits_list = list(prev_qs)
        prev_commits_count = len(prev_commits_list)
        prev_authors_set = {get_contributor_key(c.author_name, c.author_email) for c in prev_commits_list}
        prev_authors_count = len(prev_authors_set)
        for c in prev_commits_list:
            stats = c.stats or {}
            prev_additions += stats.get('total_additions', 0)
            prev_deletions += stats.get('total_deletions', 0)

    # 3. Aggregate metrics over selected commits
    distinct_authors: Dict[str, Dict[str, Any]] = {}
    distinct_files: Set[str] = set()
    total_additions = 0
    total_deletions = 0
    commits_with_stats = 0
    active_days: Set[str] = set()

    # Buckets for activity timeline
    bucket_data: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        'commits': 0,
        'authors': set(),
        'files': set(),
        'additions': 0,
        'deletions': 0,
    })

    # Hotspots & Modules tracking
    file_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        'commits': 0,
        'authors': set(),
        'additions': 0,
        'deletions': 0,
        'first_modified': None,
        'last_modified': None,
    })

    module_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        'commits': 0,
        'files': set(),
        'authors': set(),
        'additions': 0,
        'deletions': 0,
    })

    for commit in commits_list:
        c_date = commit.committed_date
        c_day = c_date.strftime('%Y-%m-%d')
        active_days.add(c_day)

        bucket_key = _get_bucket_key(c_date, aggregation)
        b = bucket_data[bucket_key]
        b['commits'] += 1

        auth_key = get_contributor_key(commit.author_name, commit.author_email)
        b['authors'].add(auth_key)

        if auth_key not in distinct_authors:
            distinct_authors[auth_key] = {
                'display_name': commit.author_name or 'Unknown',
                'email': commit.author_email or '',
                'masked_email': mask_email(commit.author_email or ''),
                'commit_count': 0,
                'files_modified': set(),
                'additions': 0,
                'deletions': 0,
                'first_commit': c_date,
                'last_commit': c_date,
                'files_touched_counts': defaultdict(int),
                'modules_touched_counts': defaultdict(int),
            }

        author_entry = distinct_authors[auth_key]
        author_entry['commit_count'] += 1
        if c_date < author_entry['first_commit']:
            author_entry['first_commit'] = c_date
        if c_date > author_entry['last_commit']:
            author_entry['last_commit'] = c_date

        # Stats from commit
        stats = commit.stats or {}
        has_stats = bool(stats and ('total_additions' in stats or 'total_deletions' in stats))
        if has_stats:
            commits_with_stats += 1
            adds = stats.get('total_additions', 0)
            dels = stats.get('total_deletions', 0)
            total_additions += adds
            total_deletions += dels
            b['additions'] += adds
            b['deletions'] += dels
            author_entry['additions'] += adds
            author_entry['deletions'] += dels

        # Files changed in commit
        files_changed = commit.files_changed or []
        modules_touched_in_commit: Set[str] = set()

        for f in files_changed:
            fname = f.get('filename')
            if not fname:
                continue

            distinct_files.add(fname)
            b['files'].add(fname)
            author_entry['files_modified'].add(fname)
            author_entry['files_touched_counts'][fname] += 1

            mod_path = extract_module_path(fname)
            author_entry['modules_touched_counts'][mod_path] += 1
            modules_touched_in_commit.add(mod_path)

            # File hotspot aggregation
            f_record = file_stats[fname]
            f_record['commits'] += 1
            f_record['authors'].add(commit.author_name or 'Unknown')
            f_adds = f.get('additions', 0)
            f_dels = f.get('deletions', 0)
            f_record['additions'] += f_adds
            f_record['deletions'] += f_dels
            if not f_record['first_modified'] or c_date < f_record['first_modified']:
                f_record['first_modified'] = c_date
            if not f_record['last_modified'] or c_date > f_record['last_modified']:
                f_record['last_modified'] = c_date

            # Module file and diff aggregation
            m_record = module_stats[mod_path]
            m_record['files'].add(fname)
            m_record['authors'].add(commit.author_name or 'Unknown')
            m_record['additions'] += f_adds
            m_record['deletions'] += f_dels

        for mod_path in modules_touched_in_commit:
            module_stats[mod_path]['commits'] += 1

    # 4. Continuous timeline generation
    effective_start = start_dt or (commits_list[0].committed_date if commits_list else end_dt)
    continuous_bucket_keys = _generate_continuous_buckets(effective_start, end_dt, aggregation)
    # Ensure all present bucket keys are accounted for
    all_keys = sorted(set(continuous_bucket_keys).union(bucket_data.keys()))

    timeline: List[Dict[str, Any]] = []
    for k in all_keys:
        item = bucket_data.get(k)
        if item:
            timeline.append({
                'bucket': k,
                'commits': item['commits'],
                'active_contributors': len(item['authors']),
                'files_modified': len(item['files']),
                'additions': item['additions'],
                'deletions': item['deletions'],
                'net_change': item['additions'] - item['deletions'],
                'total_churn': item['additions'] + item['deletions'],
            })
        else:
            timeline.append({
                'bucket': k,
                'commits': 0,
                'active_contributors': 0,
                'files_modified': 0,
                'additions': 0,
                'deletions': 0,
                'net_change': 0,
                'total_churn': 0,
            })

    # 5. Format Contributors
    contributors_list: List[Dict[str, Any]] = []
    for auth_key, a in distinct_authors.items():
        top_files = sorted(a['files_touched_counts'].items(), key=lambda x: x[1], reverse=True)[:3]
        top_modules = sorted(a['modules_touched_counts'].items(), key=lambda x: x[1], reverse=True)[:3]
        contributors_list.append({
            'contributor_key': auth_key,
            'display_name': a['display_name'],
            'email': a['masked_email'],
            'commit_count': a['commit_count'],
            'files_modified_count': len(a['files_modified']),
            'lines_added': a['additions'],
            'lines_deleted': a['deletions'],
            'net_change': a['additions'] - a['deletions'],
            'total_churn': a['additions'] + a['deletions'],
            'first_commit': a['first_commit'].isoformat() if a['first_commit'] else None,
            'last_commit': a['last_commit'].isoformat() if a['last_commit'] else None,
            'top_files': [{'file_path': tf[0], 'touches': tf[1]} for tf in top_files],
            'top_modules': [{'module_path': tm[0], 'touches': tm[1]} for tm in top_modules],
        })
    contributors_list.sort(key=lambda x: x['commit_count'], reverse=True)

    # 6. Format Hotspots
    hotspots_list: List[Dict[str, Any]] = []
    for fname, f in file_stats.items():
        commits_cnt = f['commits']
        churn = f['additions'] + f['deletions']
        auth_cnt = len(f['authors'])

        # Neutral activity classification
        if commits_cnt >= 5 and auth_cnt > 1:
            label = "Frequently modified"
        elif churn > 200:
            label = "High code churn"
        elif auth_cnt >= 3:
            label = "Multiple contributors"
        elif commits_cnt >= 3:
            label = "Repeatedly changed"
        else:
            label = "Recently active"

        hotspots_list.append({
            'file_path': fname,
            'module': extract_module_path(fname),
            'commit_count': commits_cnt,
            'contributor_count': auth_cnt,
            'contributors': sorted(list(f['authors'])),
            'lines_added': f['additions'],
            'lines_deleted': f['deletions'],
            'net_change': f['additions'] - f['deletions'],
            'total_churn': churn,
            'first_modified': f['first_modified'].isoformat() if f['first_modified'] else None,
            'last_modified': f['last_modified'].isoformat() if f['last_modified'] else None,
            'activity_label': label,
        })
    hotspots_list.sort(key=lambda x: x['commit_count'], reverse=True)

    # 7. Format Modules
    modules_list: List[Dict[str, Any]] = []
    for mpath, m in module_stats.items():
        auth_cnt = len(m['authors'])
        single_contributor_period = (auth_cnt == 1 and m['commits'] >= 2)
        top_mod_files = [h for h in hotspots_list if h['module'] == mpath][:5]

        modules_list.append({
            'module_path': mpath,
            'commit_count': m['commits'],
            'file_count': len(m['files']),
            'contributor_count': auth_cnt,
            'contributors': sorted(list(m['authors'])),
            'lines_added': m['additions'],
            'lines_deleted': m['deletions'],
            'net_change': m['additions'] - m['deletions'],
            'total_churn': m['additions'] + m['deletions'],
            'single_contributor_period': single_contributor_period,
            'cautious_note': (
                "Single observed contributor in the selected period"
                if single_contributor_period else None
            ),
            'top_files': [
                {'file_path': f['file_path'], 'commits': f['commit_count'], 'churn': f['total_churn']}
                for f in top_mod_files
            ],
        })
    modules_list.sort(key=lambda x: x['commit_count'], reverse=True)

    # 8. Churn Summary & Comparisons
    net_line_change = total_additions - total_deletions
    total_churn_volume = total_additions + total_deletions
    active_days_count = len(active_days)
    avg_commits_per_active_day = round(total_commits / active_days_count, 2) if active_days_count > 0 else 0.0

    # Delta percentages vs previous period
    def _pct_change(curr: int, prev: int) -> Optional[float]:
        if prev == 0:
            return 100.0 if curr > 0 else 0.0 if curr == 0 else None
        return round(((curr - prev) / prev) * 100.0, 1)

    previous_period_comparison = {
        'has_previous_data': prev_commits_count > 0,
        'previous_commits': prev_commits_count,
        'previous_contributors': prev_authors_count,
        'previous_additions': prev_additions,
        'previous_deletions': prev_deletions,
        'commits_delta_pct': _pct_change(total_commits, prev_commits_count),
        'contributors_delta_pct': _pct_change(len(distinct_authors), prev_authors_count),
        'additions_delta_pct': _pct_change(total_additions, prev_additions),
        'deletions_delta_pct': _pct_change(total_deletions, prev_deletions),
    }

    # 9. Knowledge distribution observations
    top_author_share = 0.0
    if total_commits > 0 and contributors_list:
        top_author_share = round((contributors_list[0]['commit_count'] / total_commits) * 100.0, 1)

    knowledge_distribution = {
        'total_active_contributors': len(distinct_authors),
        'single_contributor_modules_count': sum(1 for m in modules_list if m['single_contributor_period']),
        'shared_modules_count': sum(1 for m in modules_list if m['contributor_count'] > 1),
        'top_contributor_commit_share_pct': top_author_share,
        'methodology_note': (
            "Distribution metrics reflect recorded commits during the selected window, "
            "not developer capacity or total code ownership."
        ),
    }

    # Assembly
    return {
        'repository_id': repository.id,
        'repository_name': repository.name,
        'repository_owner': repository.owner,
        'time_range': effective_range,
        'start_date': start_dt.isoformat() if start_dt else None,
        'end_date': end_dt.isoformat() if end_dt else None,
        'aggregation': aggregation,
        'timestamp_basis': 'committed_date',
        'overview': {
            'total_commits': total_commits,
            'active_contributors': len(distinct_authors),
            'files_modified': len(distinct_files),
            'lines_added': total_additions,
            'lines_deleted': total_deletions,
            'net_line_change': net_line_change,
            'total_churn_volume': total_churn_volume,
            'stats_available': commits_with_stats > 0,
            'active_days_count': active_days_count,
            'avg_commits_per_active_day': avg_commits_per_active_day,
            'previous_period': previous_period_comparison,
        },
        'timeline': timeline,
        'contributors': contributors_list,
        'hotspots': hotspots_list,
        'modules': modules_list,
        'churn': {
            'total_additions': total_additions,
            'total_deletions': total_deletions,
            'net_line_change': net_line_change,
            'total_churn_volume': total_churn_volume,
            'stats_available': commits_with_stats > 0,
            'top_churn_files': sorted(hotspots_list, key=lambda x: x['total_churn'], reverse=True)[:10],
            'top_churn_modules': sorted(modules_list, key=lambda x: x['total_churn'], reverse=True)[:10],
        },
        'knowledge_distribution': knowledge_distribution,
        'data_availability': data_availability,
    }


def _empty_analytics_response(
    repository: Repository,
    time_range: str,
    start_dt: Optional[datetime],
    end_dt: datetime,
    aggregation: str,
    data_availability: Dict[str, Any],
) -> Dict[str, Any]:
    """Return an initialized empty analytics payload with zero-metrics."""
    return {
        'repository_id': repository.id,
        'repository_name': repository.name,
        'repository_owner': repository.owner,
        'time_range': time_range,
        'start_date': start_dt.isoformat() if start_dt else None,
        'end_date': end_dt.isoformat() if end_dt else None,
        'aggregation': aggregation,
        'timestamp_basis': 'committed_date',
        'overview': {
            'total_commits': 0,
            'active_contributors': 0,
            'files_modified': 0,
            'lines_added': 0,
            'lines_deleted': 0,
            'net_line_change': 0,
            'total_churn_volume': 0,
            'stats_available': False,
            'active_days_count': 0,
            'avg_commits_per_active_day': 0.0,
            'previous_period': {
                'has_previous_data': False,
                'previous_commits': 0,
                'previous_contributors': 0,
                'previous_additions': 0,
                'previous_deletions': 0,
                'commits_delta_pct': None,
                'contributors_delta_pct': None,
                'additions_delta_pct': None,
                'deletions_delta_pct': None,
            },
        },
        'timeline': [],
        'contributors': [],
        'hotspots': [],
        'modules': [],
        'churn': {
            'total_additions': 0,
            'total_deletions': 0,
            'net_line_change': 0,
            'total_churn_volume': 0,
            'stats_available': False,
            'top_churn_files': [],
            'top_churn_modules': [],
        },
        'knowledge_distribution': {
            'total_active_contributors': 0,
            'single_contributor_modules_count': 0,
            'shared_modules_count': 0,
            'top_contributor_commit_share_pct': 0.0,
            'methodology_note': "No commits found in the selected period.",
        },
        'data_availability': data_availability,
    }
