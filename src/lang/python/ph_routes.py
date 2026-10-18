"""List the HTTP routes of a FastAPI or Flask project (stdlib only). Prints JSON to stdout."""
import ast
import json
import os
import sys

SKIP_DIRS = {
    '.git', '.hg', '.venv', 'venv', 'env', '.env', 'node_modules', 'build', 'dist', 'site-packages',
    'tests', 'test', 'testing', 'docs', 'doc', 'examples', 'example', '.tox', '.nox', '__pycache__',
    '.counterhound', '.mypy_cache', '.pytest_cache', 'migrations', 'alembic', 'scripts',
}
METHODS = {'get', 'post', 'put', 'patch', 'delete', 'head', 'options'}
APP_CLASSES = {'FastAPI': 'fastapi', 'Flask': 'flask', 'APIRouter': 'fastapi', 'Blueprint': 'flask'}


def module_name(root, path):
    rel = os.path.relpath(path, root)
    parts = rel[:-3].split(os.sep)
    if parts and parts[0] in ('src', 'lib') and len(parts) > 1:
        parts = parts[1:]
    if parts[-1] == '__init__':
        parts = parts[:-1]
    return '.'.join(parts)


def unparse(node):
    try:
        return ast.unparse(node)
    except Exception:
        return None


def const(node):
    return node.value if isinstance(node, ast.Constant) else None


def kwarg(call, name):
    for kw in call.keywords:
        if kw.arg == name:
            return kw.value
    return None


def signature(fn):
    a = fn.args
    out = []
    for arg in a.posonlyargs + a.args + a.kwonlyargs:
        ann = unparse(arg.annotation) if arg.annotation is not None else None
        out.append(arg.arg + (f': {ann}' if ann else ''))
    ret = unparse(fn.returns) if fn.returns is not None else None
    return f"({', '.join(out)})" + (f' -> {ret}' if ret else '')


def collect(root, path, out, want_routes=True):
    """Apps, routers and mounts are collected from every file; routes only from the files asked for."""
    try:
        src = open(path, encoding='utf-8').read()
        tree = ast.parse(src)
    except Exception:
        return
    mod = module_name(root, path)
    rel = os.path.relpath(path, root).replace(os.sep, '/')
    prefixes = {}  # router/blueprint variable -> url prefix in this file

    for node in tree.body:
        # app = FastAPI(...), router = APIRouter(prefix='/items'), bp = Blueprint('x', __name__, url_prefix='/x')
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            fn = node.value.func
            cls = fn.id if isinstance(fn, ast.Name) else fn.attr if isinstance(fn, ast.Attribute) else None
            if cls in APP_CLASSES:
                var = node.targets[0].id
                prefix = const(kwarg(node.value, 'prefix')) or const(kwarg(node.value, 'url_prefix')) or ''
                prefixes[var] = prefix
                if cls in ('FastAPI', 'Flask'):
                    out['apps'].append({'module': mod, 'name': var, 'framework': APP_CLASSES[cls], 'file': rel, 'line': node.lineno, 'factory': False})
                else:
                    out['routers'].append({'module': mod, 'name': var, 'framework': APP_CLASSES[cls], 'file': rel, 'prefix': prefix})
        # def create_app(...): ... return FastAPI(...)/Flask(...)
        elif isinstance(node, ast.FunctionDef) and node.name in ('create_app', 'make_app', 'get_app', 'build_app'):
            for sub in ast.walk(node):
                if isinstance(sub, ast.Call):
                    fn = sub.func
                    cls = fn.id if isinstance(fn, ast.Name) else fn.attr if isinstance(fn, ast.Attribute) else None
                    if cls in ('FastAPI', 'Flask'):
                        out['apps'].append({'module': mod, 'name': node.name, 'framework': APP_CLASSES[cls], 'file': rel, 'line': node.lineno, 'factory': True})
                        break

    # app.include_router(items.router, prefix='/api') / app.register_blueprint(bp, url_prefix='/x'), anywhere (often inside create_app)
    for call in ast.walk(tree):
        if isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute) and call.func.attr in ('include_router', 'register_blueprint'):
            target = unparse(call.args[0]) if call.args else None
            prefix = const(kwarg(call, 'prefix')) or const(kwarg(call, 'url_prefix')) or ''
            if target:
                out['mounts'].append({'file': rel, 'router': target, 'prefix': prefix})

    def add_route(fn, deco, owner_var, method, path, extra):
        if path is None:
            return
        doc = ast.get_docstring(fn) or ''
        loc = (getattr(fn, 'end_lineno', fn.lineno) or fn.lineno) - fn.lineno + 1
        out['routes'].append({
            'method': method.upper(), 'path': (prefixes.get(owner_var, '') or '') + path, 'owner': owner_var,
            'handler': fn.name, 'module': mod, 'file': rel, 'line': fn.lineno, 'loc': loc,
            'doc': doc[:600], 'signature': signature(fn), 'async': isinstance(fn, ast.AsyncFunctionDef),
            'nArgs': len(fn.args.posonlyargs + fn.args.args + fn.args.kwonlyargs), **extra,
        })

    for node in ast.walk(tree):
        if not want_routes or not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for deco in node.decorator_list:
            if not (isinstance(deco, ast.Call) and isinstance(deco.func, ast.Attribute) and isinstance(deco.func.value, ast.Name)):
                continue
            owner, attr = deco.func.value.id, deco.func.attr
            path = const(deco.args[0]) if deco.args else const(kwarg(deco, 'path'))
            extra = {
                'responseModel': unparse(kwarg(deco, 'response_model')) if kwarg(deco, 'response_model') is not None else None,
                'statusCode': const(kwarg(deco, 'status_code')),
            }
            if attr in METHODS:
                add_route(node, deco, owner, attr, path, extra)
            elif attr in ('route', 'api_route'):
                methods_node = kwarg(deco, 'methods')
                methods = [const(m) for m in methods_node.elts] if isinstance(methods_node, (ast.List, ast.Tuple)) else ['GET']
                for m in methods:
                    if m:
                        add_route(node, deco, owner, m, path, extra)


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    only = sys.argv[2:]
    out = {'apps': [], 'routers': [], 'mounts': [], 'routes': []}
    starts = [os.path.abspath(os.path.join(root, o)) for o in only]
    wanted = lambda p: not starts or any(p == s or p.startswith(s + os.sep) for s in starts)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.') and not d.endswith('.egg-info')]
        for f in filenames:
            if f.endswith('.py') and not f.startswith('test_') and f != 'conftest.py':
                p = os.path.join(dirpath, f)
                collect(root, p, out, wanted(p))
    # a router mounted with a prefix: apply it to the routes declared on that router (matched by variable name)
    for m in out['mounts']:
        var = m['router'].split('.')[-1]
        for r in out['routes']:
            if r['owner'] == var and m['prefix'] and not r['path'].startswith(m['prefix']):
                r['path'] = m['prefix'] + r['path']
    out['framework'] = next((a['framework'] for a in out['apps']), next((r['framework'] for r in out['routers']), None))
    json.dump(out, sys.stdout)


if __name__ == '__main__':
    main()
