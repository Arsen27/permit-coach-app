import json, sys
root='/root/work/dmv-learning/server/content/ca-class-c/3.3.0/lessons/'
for lid in sys.argv[1:]:
    d=json.load(open(root+lid+'.json')); L=d['lesson']
    print(f"=== {lid} — {L['title']} | summary: {L['objective']} | keyPoints: {L['intro']['keyPoints']}")
    for b in L['blocks']:
        sc=b.get('scope','universal'); t=b['type']
        if t=='quick_challenge':
            q=[x for x in d['questions'] if x['questionId']==b['questionId']][0]
            print(f"  [challenge {q.get('scope','universal')}] {b['scenario']} || {q['prompt']} || {[c['text'] for c in q['choices']]} correct={q['correctAnswerId']} || {q['explanation']}")
        elif t=='image': print(f"  [image] {b['assetId']}")
        elif t=='check_yourself':
            print(f"  [recall {sc}] {b['blockId']} :: {b['context']} :: {b['ruleMarkdown']}")
        else:
            body=b.get('bodyMarkdown','').replace('\n\n',' | ')
            bl=(' || BULLETS: '+' | '.join(b['bullets'])) if b.get('bullets') else ''
            if sc=='state_specific': print(f"  [card SS {t}] {b['blockId']} :: {b['title']} :: {body}{bl}")
            else: print(f"  [card U {t}] {b['blockId']} :: {b['title']} ({len(body.split())}w)")
    for q in d['questions'][1:]:
        print(f"  [q {q.get('scope','universal')}] {q['questionId'][-3:]} {q['prompt']} -> {[c['text'] for c in q['choices'] if c['id']==q['correctAnswerId']][0]}")
