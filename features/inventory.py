import json
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parent.parent
product = sys.argv[1]
cli = (root / 'bin/unblock.js').read_text()
mcp = (root / 'src/mcp.js').read_text()
daemon = (root / 'src/daemon.js').read_text()
commands = sorted(set(re.findall(r"command === '([^']+)'", cli)) | {'help'})
tools = sorted(set(re.findall(r"name: '(unblock_[^']+)'", mcp)))
if product == 'human-asks':
    routes = set(re.findall(r"pathname === '(/api/[^']+)'", daemon)) - {'/api/scope'}
    routes.update('/api/asks/ticket' + suffix for suffix in re.findall(r"routeTicket\(pathname, '([^']+)'\)", daemon))
    routes.update(['/api/asks/ticket', '/api/asks/ticket/receipt/image.png'])
    data = {'cli': [name for name in commands if name not in {'scope', 'explain'}], 'route': sorted(routes), 'tool': [name for name in tools if not name.startswith('unblock_scope_')]}
elif product == 'scope-docs':
    data = {'cli': [name for name in commands if name in {'scope', 'explain'}], 'route': ['/api/scope'], 'tool': [name for name in tools if name.startswith('unblock_scope_')]}
elif product == 'web-panel':
    data = {'page': sorted(path.relative_to(root / 'web').as_posix() for path in (root / 'web').glob('*.html'))}
elif product == 'integrations':
    plugin = (root / 'herdr-plugin.toml').read_text()
    names = ['hermes.' + name for name in re.findall(r'^  - (\w+)', (root / 'plugin.yaml').read_text(), re.M)]
    names += ['herdr.' + name for name in re.findall(r'\[\[(?:actions|panes)\]\]\s+id = "([^"]+)"', plugin)]
    names += ['herdr.' + name for name in re.findall(r'\[\[events\]\]\s+on = "([^"]+)"', plugin)]
    data = {'cli': sorted(path.stem for path in (root / 'bin').iterdir() if path.name != 'unblock.js' and path.is_file()), 'tool': names}
else:
    raise SystemExit('unknown product: ' + product)
print(json.dumps(data, sort_keys=True))
