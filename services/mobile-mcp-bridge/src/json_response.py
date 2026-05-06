import json


def make_response(success, output=None, error=None, status=200):
    body = {"success": success}
    if output is not None:
        body["output"] = output
    if error is not None:
        body["error"] = error
    return status, body


def to_json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
