#!/usr/bin/env python3
"""Snapshot actual local skills for display; never execute them or include credentials."""
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
catalog = [
    ('tiktok-product-creation', 'productCreationSkill.json', [
        ('工作台商品信息完整规则', 'references/shopdesk-product-information.md'),
        ('Skill 主文件（含历史制图规则）', 'SKILL.md'),
    ]),
    ('wjj-reference-product-images', 'productImageSkill.json', [
        ('工作台多套制图与功能表达规则', 'references/shopdesk-image-workflow.md'),
        ('WJJ 完整制图流程', 'SKILL.md'),
        ('分析与审查标准', 'references/analysis-and-review.md'),
        ('任务账本与执行命令', 'references/task-record.md'),
    ]),
]
for skill_id, filename, files in catalog:
    skill_root = Path.home() / '.codex' / 'skills' / skill_id
    documents = []
    for title, relative in files:
        content = (skill_root / relative).read_text()
        documents.append({'title': title, 'file': relative, 'sha256': hashlib.sha256(content.encode()).hexdigest(), 'content': content})
    result = json.dumps({'skillId': skill_id, 'documents': documents}, ensure_ascii=False, indent=2) + '\n'
    target = root / 'frontend/src/data' / filename
    if '--check' in sys.argv:
        if not target.exists() or target.read_text() != result:
            raise SystemExit(f'{skill_id}: snapshot is stale; run scripts/sync-workbench-skills.py')
    else:
        target.write_text(result)
    print(f'{skill_id}: snapshot matches local source.')
