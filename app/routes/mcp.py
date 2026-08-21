"""Per-user MCP endpoint for importing historical project time."""

from __future__ import annotations

import json
from datetime import datetime
from urllib.parse import urlparse

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from app import csrf, db
from app.models import Project, TimeEntry
from app.services import TimeTrackingService
from app.utils.api_auth import require_api_token
from app.utils.scope_filter import get_clockable_project_ids, user_can_clock_project
from app.utils.timezone import get_app_timezone, get_timezone_for_user, get_timezone_obj

mcp_bp = Blueprint("mcp", __name__, url_prefix="/mcp")
csrf.exempt(mcp_bp)

SUPPORTED_PROTOCOL_VERSIONS = ("2026-07-28", "2025-11-25", "2025-06-18")
DEFAULT_PROTOCOL_VERSION = "2025-06-18"
MAX_IMPORT_ENTRIES = 250


def _jsonrpc_result(request_id, result):
    return jsonify({"jsonrpc": "2.0", "id": request_id, "result": result})


def _jsonrpc_error(request_id, code, message, *, status=200, data=None):
    error = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return jsonify({"jsonrpc": "2.0", "id": request_id, "error": error}), status


def _tool_result(payload, *, is_error=False):
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
        "structuredContent": payload,
        "isError": bool(is_error),
    }


def _origin_is_allowed():
    """Reject browser requests originating from another host (DNS rebinding protection)."""
    origin = (request.headers.get("Origin") or "").strip()
    if not origin:
        return True
    parsed = urlparse(origin)
    return parsed.scheme in {"http", "https"} and parsed.netloc.lower() == request.host.lower()


def _project_query_for_user(user):
    query = Project.query.order_by(Project.name.asc(), Project.id.asc())
    allowed = get_clockable_project_ids(user)
    if allowed is not None:
        query = query.filter(Project.id.in_(allowed))
    return query


def _parse_import_datetime(value, user):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("must be an ISO 8601 date-time")
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise ValueError("must be an ISO 8601 date-time") from exc

    app_tz = get_timezone_obj()
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=get_timezone_for_user(user), fold=1)
    return parsed.astimezone(app_tz).replace(tzinfo=None)


def _resolve_project(arguments, user):
    project = None
    raw_id = arguments.get("project_id")
    if raw_id not in (None, ""):
        try:
            project = db.session.get(Project, int(raw_id))
        except (TypeError, ValueError):
            project = None
    elif arguments.get("project_code"):
        code = str(arguments["project_code"]).strip().upper()
        project = _project_query_for_user(user).filter(func.upper(Project.code) == code).first()
    elif arguments.get("project_name"):
        name = str(arguments["project_name"]).strip()
        project = _project_query_for_user(user).filter(func.lower(Project.name) == name.lower()).first()

    if not project:
        raise ValueError("project_id, project_code, or an exact project_name is required")
    if not user_can_clock_project(user, project.id):
        raise PermissionError("project is not available to this user")
    return project


def _migration_context(user):
    projects = []
    for project in _project_query_for_user(user).all():
        projects.append(
            {
                "id": project.id,
                "name": project.name,
                "code": project.code,
                "status": project.status,
                "client": project.client,
                "billable": project.billable,
            }
        )
    return {
        "user": {"id": user.id, "username": user.username},
        "timezone": getattr(user, "timezone", None) or get_app_timezone(),
        "projects": projects,
        "import_limit": MAX_IMPORT_ENTRIES,
    }


def _list_time_entries(arguments, user):
    query = TimeEntry.query.filter(TimeEntry.user_id == user.id, TimeEntry.end_time.isnot(None))
    if arguments.get("from"):
        query = query.filter(TimeEntry.start_time >= _parse_import_datetime(arguments["from"], user))
    if arguments.get("to"):
        query = query.filter(TimeEntry.start_time <= _parse_import_datetime(arguments["to"], user))
    if arguments.get("project_id") not in (None, ""):
        project = _resolve_project({"project_id": arguments["project_id"]}, user)
        query = query.filter(TimeEntry.project_id == project.id)
    try:
        limit = max(1, min(250, int(arguments.get("limit", 100))))
        offset = max(0, int(arguments.get("offset", 0)))
    except (TypeError, ValueError) as exc:
        raise ValueError("limit and offset must be integers") from exc
    total = query.count()
    entries = query.order_by(TimeEntry.start_time.asc(), TimeEntry.id.asc()).offset(offset).limit(limit).all()
    return {
        "entries": [entry.to_dict() for entry in entries],
        "total": total,
        "offset": offset,
        "limit": limit,
        "next_offset": offset + len(entries) if offset + len(entries) < total else None,
    }


def _import_time_entries(arguments, user):  # noqa: C901 - validation is intentionally kept with batch handling
    rows = arguments.get("entries")
    if not isinstance(rows, list) or not rows:
        raise ValueError("entries must be a non-empty array")
    if len(rows) > MAX_IMPORT_ENTRIES:
        raise ValueError(f"at most {MAX_IMPORT_ENTRIES} entries may be imported per call")
    dry_run = bool(arguments.get("dry_run", False))
    service = TimeTrackingService()
    results = []
    created = duplicates = failed = 0

    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            results.append({"index": index, "status": "error", "error": "entry must be an object"})
            failed += 1
            continue
        try:
            project = _resolve_project(row, user)
            start = _parse_import_datetime(row.get("start"), user)
            end = _parse_import_datetime(row.get("end"), user)
            if end <= start:
                raise ValueError("end must be after start")
            break_seconds = max(0, int(row.get("break_seconds", 0) or 0))
            if break_seconds >= int((end - start).total_seconds()):
                raise ValueError("break_seconds must be shorter than the entry")

            exact = TimeEntry.query.filter_by(
                user_id=user.id,
                project_id=project.id,
                start_time=start,
                end_time=end,
            ).first()
            if exact:
                results.append({"index": index, "status": "duplicate", "time_entry_id": exact.id})
                duplicates += 1
                continue

            overlap = TimeEntry.query.filter(
                TimeEntry.user_id == user.id,
                TimeEntry.start_time < end,
                TimeEntry.end_time > start,
                TimeEntry.end_time.isnot(None),
            ).first()
            if overlap:
                raise ValueError(f"overlaps existing time entry {overlap.id}")

            if dry_run:
                results.append({"index": index, "status": "valid", "project_id": project.id})
                continue

            tags = row.get("tags")
            if isinstance(tags, list):
                tags = ",".join(str(tag).strip() for tag in tags if str(tag).strip())
            result = service.create_manual_entry(
                user_id=user.id,
                project_id=project.id,
                start_time=start,
                end_time=end,
                break_seconds=break_seconds,
                notes=str(row.get("notes") or "").strip() or None,
                tags=str(tags or "").strip() or None,
                billable=bool(row.get("billable", project.billable)),
                skip_entry_requirements=True,
            )
            if not result.get("success"):
                raise ValueError(result.get("message") or "entry could not be imported")
            entry = result["entry"]
            results.append({"index": index, "status": "created", "time_entry_id": entry.id})
            created += 1
        except (TypeError, ValueError, PermissionError) as exc:
            db.session.rollback()
            results.append({"index": index, "status": "error", "error": str(exc)})
            failed += 1

    return {
        "dry_run": dry_run,
        "created": created,
        "duplicates": duplicates,
        "failed": failed,
        "results": results,
    }


TOOLS = [
    {
        "name": "eviltime_get_migration_context",
        "description": "List the authenticated EvilTime user and projects available for historical time imports.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "eviltime_list_time_entries",
        "description": "List this user's completed EvilTime entries to verify or plan a migration.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "from": {"type": "string", "description": "Optional ISO 8601 lower bound."},
                "to": {"type": "string", "description": "Optional ISO 8601 upper bound."},
                "project_id": {"type": "integer"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 250, "default": 100},
                "offset": {"type": "integer", "minimum": 0, "default": 0},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "eviltime_import_time_entries",
        "description": (
            "Validate or import up to 250 completed historical entries for this user. " "Exact retries are skipped."
        ),
        "inputSchema": {
            "type": "object",
            "required": ["entries"],
            "properties": {
                "dry_run": {"type": "boolean", "default": False},
                "entries": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": MAX_IMPORT_ENTRIES,
                    "items": {
                        "type": "object",
                        "required": ["start", "end"],
                        "properties": {
                            "project_id": {"type": "integer"},
                            "project_code": {"type": "string"},
                            "project_name": {"type": "string"},
                            "start": {
                                "type": "string",
                                "description": "ISO 8601; naive values use the user's timezone.",
                            },
                            "end": {"type": "string", "description": "ISO 8601; naive values use the user's timezone."},
                            "break_seconds": {"type": "integer", "minimum": 0},
                            "notes": {"type": "string"},
                            "tags": {"oneOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}]},
                            "billable": {"type": "boolean"},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        },
    },
]


@mcp_bp.route("", methods=["GET", "POST"])
@mcp_bp.route("/", methods=["GET", "POST"])
@require_api_token("mcp:migrate")
def handle_mcp():  # noqa: C901 - JSON-RPC dispatch is clearer as one small endpoint
    if not _origin_is_allowed():
        return _jsonrpc_error(None, -32000, "Origin is not allowed", status=403)
    if request.method == "GET":
        return jsonify(
            {
                "name": "EvilTime migration MCP",
                "transport": "streamable-http",
                "protocol_versions": list(SUPPORTED_PROTOCOL_VERSIONS),
                "user": g.api_user.username,
            }
        )

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or data.get("jsonrpc") != "2.0" or not isinstance(data.get("method"), str):
        return _jsonrpc_error(data.get("id") if isinstance(data, dict) else None, -32600, "Invalid Request", status=400)
    request_id = data.get("id")
    method = data["method"]
    header_method = request.headers.get("Mcp-Method")
    if header_method and header_method != method:
        return _jsonrpc_error(request_id, -32600, "Mcp-Method header does not match the JSON-RPC method", status=400)

    if method == "initialize":
        requested = (data.get("params") or {}).get("protocolVersion")
        version = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else DEFAULT_PROTOCOL_VERSION
        return _jsonrpc_result(
            request_id,
            {
                "protocolVersion": version,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "EvilTime migration MCP", "version": "1.0"},
                "instructions": "Use a dry run before importing. All tools are restricted to the token owner.",
            },
        )
    if method == "notifications/initialized":
        return "", 202
    if method == "ping":
        return _jsonrpc_result(request_id, {})
    if method == "tools/list":
        return _jsonrpc_result(request_id, {"tools": TOOLS})
    if method != "tools/call":
        return _jsonrpc_error(request_id, -32601, "Method not found")

    params = data.get("params") or {}
    name = params.get("name")
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        return _jsonrpc_error(request_id, -32602, "Tool arguments must be an object")
    header_name = request.headers.get("Mcp-Name")
    if header_name and header_name != name:
        return _jsonrpc_error(request_id, -32600, "Mcp-Name header does not match the tool name", status=400)
    try:
        if name == "eviltime_get_migration_context":
            result = _migration_context(g.api_user)
        elif name == "eviltime_list_time_entries":
            result = _list_time_entries(arguments, g.api_user)
        elif name == "eviltime_import_time_entries":
            result = _import_time_entries(arguments, g.api_user)
        else:
            return _jsonrpc_error(request_id, -32602, f"Unknown tool: {name}")
        return _jsonrpc_result(request_id, _tool_result(result, is_error=bool(result.get("failed"))))
    except (TypeError, ValueError, PermissionError) as exc:
        return _jsonrpc_result(request_id, _tool_result({"error": str(exc)}, is_error=True))
