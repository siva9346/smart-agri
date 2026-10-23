"""
Automation rule builder — Super Admin / Admin only.

GET  /automation/rules             – list the 4 predefined rules with current config
PUT  /automation/rules/{ruleId}    – update {enabled, ...rule-specific params}
GET  /automation/runs              – ?ruleId= &status=  execution history (newest first)
POST /automation/runs/{id}/retry   – re-run a FAILED run's notification
POST /automation/runs/{id}/approve – approve a PENDING_APPROVAL run (e.g. a suggested message)
POST /automation/runs/{id}/reject  – reject a PENDING_APPROVAL run
"""
from lib.automation import rules, update_rule, list_runs, retry_run, approve_run, reject_run
from lib.permissions import require_permission
from lib.response import ok, parse_body, query_param
from lib.router import run


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    actor = require_permission(event, 'automation.manage')
    if seg[:1] == ['rules']:
        if len(seg) == 1 and m == 'GET':
            return ok({'rules': rules()})
        if len(seg) == 2 and m == 'PUT':
            return ok(update_rule(seg[1], parse_body(event), actor))
    if seg[:1] == ['runs']:
        if len(seg) == 1 and m == 'GET':
            return ok({'items': list_runs(rule_id=query_param(event, 'ruleId'), status=query_param(event, 'status'))})
        if len(seg) == 3 and m == 'POST' and seg[2] in ('retry', 'approve', 'reject'):
            run_id, action = seg[1], seg[2]
            if action == 'retry':
                return ok(retry_run(run_id, actor))
            if action == 'approve':
                return ok(approve_run(run_id, actor))
            return ok(reject_run(run_id, actor))
    return None
