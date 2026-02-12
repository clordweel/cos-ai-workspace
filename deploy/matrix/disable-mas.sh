#!/usr/bin/env bash
# 方案 A：禁用 MAS，使 Synapse 回退到原生密码认证
# 在 deploy/matrix 目录执行；需已存在 data/homeserver.yaml（由 bootstrap 或 bootstrap-mas 生成）

set -e
HS="${1:-./data/homeserver.yaml}"
HS="$(realpath "$HS" 2>/dev/null || echo "$HS")"

if [ ! -f "$HS" ]; then
  echo "错误：未找到 $HS"
  echo "用法: ./disable-mas.sh [homeserver.yaml 路径]"
  exit 1
fi

if grep -q "matrix_authentication_service" "$HS"; then
  python3 - "$HS" << 'PYSCRIPT'
import re, sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()
in_mas = False
lines = []
for line in content.split('\n'):
    if re.match(r'^matrix_authentication_service\s*:', line):
        in_mas = True
    if in_mas and re.match(r'^(\s*)enabled:\s*true\s*$', line, re.I):
        lines.append(re.sub(r'enabled:\s*true', 'enabled: false', line, flags=re.I))
        in_mas = False
    else:
        if in_mas and line.strip() and not line[0].isspace() and 'matrix_authentication' not in line:
            in_mas = False
        lines.append(line)
with open(path, 'w') as f:
    f.write('\n'.join(lines))
print("已设置 matrix_authentication_service.enabled: false")
PYSCRIPT

else
  echo "未找到 matrix_authentication_service，可能已是纯 Synapse 模式"
fi

echo "完成。请重启 Synapse: docker compose -f docker-compose.yml -f docker-compose.no-mas.yml restart synapse"
