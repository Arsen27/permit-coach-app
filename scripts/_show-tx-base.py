import json, sys
root='/root/work/dmv-learning/server/content/tx-class-c/1.0.0/lessons/'
for lid in sys.argv[1:]:
    d=json.load(open(root+lid+'.json')); L=d['lesson']
    print(f"=== {lid} — {L['title']}")
    for a in d['assets']:
        print(f"  [asset] {a['assetId']} :: {a.get('altText') or a.get('caption') or ''}"[:200])
    for i,q in enumerate(d['questions']):
        print(f"  [q{i} {q.get('scope','?')} {q['kind']}] {q['prompt']} || {[c['text'] for c in q['choices']]} correct={q['correctAnswerId']} || {q['explanation'][:160]}")
