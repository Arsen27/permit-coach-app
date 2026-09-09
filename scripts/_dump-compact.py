#!/usr/bin/env python3
"""Compact text view of a built course tree (server/content/<course>/<version>).

Blocks, recall cards, challenge and test questions with the correct answer
marked. Used to author the universal skeleton without reading verbose JSON.
"""
import json, sys, os, glob

root = sys.argv[1]
only = set(sys.argv[2:])
course = json.load(open(os.path.join(root, 'course.json')))
modules = {}
for f in glob.glob(os.path.join(root, 'modules', '*.json')):
    d = json.load(open(f))
    m = d['module'] if 'module' in d else d
    modules[m['moduleId']] = m
lessons = {}
for f in glob.glob(os.path.join(root, 'lessons', '*.json')):
    d = json.load(open(f))
    lessons[d['lesson']['lessonId']] = d

SC = {'universal': 'U', 'state_specific': 'S', None: '-'}
order = []
for m in sorted(modules.values(), key=lambda m: m['sequence']):
    for lid in (m.get('lessonIds') or [l['lessonId'] if isinstance(l, dict) else l for l in m.get('lessons', [])]):
        order.append((m, lid))

for m, lid in order:
    if only and lid not in only and m['moduleId'] not in only:
        continue
    doc = lessons[lid]
    L = doc['lesson']
    qs = {q['questionId']: q for q in doc['questions']}
    assets = {a['assetId']: a for a in doc.get('assets', [])}
    print(f"\n## {lid} | {L['title']} | seq {L['globalSequence']}/{L['moduleSequence']} | module {m['moduleId']} ({m['title']})")
    print(f"objective: {L['objective']}")
    print(f"keyPoints: {' | '.join(L['intro']['keyPoints'])}")
    print(f"minutes: theory {L['intro']['theoryMinutes']} test {L['intro']['testMinutes']} est {L['estimatedMinutes']}")
    for b in L['blocks']:
        t = b['type']
        if t == 'quick_challenge':
            print(f"[challenge] {b['scenario']} | preview: {b['questionPreview']} -> {b['questionId'].split('-')[-2]}-{b['questionId'].split('-')[-1]}")
        elif t == 'image':
            a = assets.get(b['assetId'], {})
            print(f"[image] {b['assetId']} :: {a.get('alt', '')[:110]}")
        elif t == 'check_yourself':
            print(f"[recall {SC.get(b.get('scope'))}] {b['context']} :: {b['ruleMarkdown']}")
        else:
            body = (b.get('bodyMarkdown') or '').replace('\n\n', ' / ').replace('\n', ' ')
            bullets = '' if not b.get('bullets') else ' • ' + '; '.join(b['bullets'])
            print(f"[{t} {SC.get(b.get('scope'))}] {b['title']} :: {body}{bullets}")
    for qid in L['questionIds']:
        q = qs[qid]
        short = qid[len(lid) + 1:]
        ch = ' | '.join(f"{c['id']}) {c['text']}{'*' if c['id'] == q['correctAnswerId'] else ''}" for c in q['choices'])
        art = f" [img {q['assetId']}]" if q.get('assetId') else ''
        print(f"Q {short} ({SC.get(q.get('scope'))}){art}: {q['prompt']} | {ch} | expl: {q['explanation']}")
