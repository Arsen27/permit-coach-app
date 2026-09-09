import sys,json,glob,re,subprocess
out=subprocess.run(['node','scripts/build-texas-conversation-course.mjs'],capture_output=True,text=True,env={**__import__('os').environ,'TX_PARTIAL':'1'})
txt=out.stdout
err=[l for l in out.stderr.splitlines() if 'needs a Texas overlay' not in l and 'no Texas overlay entry' not in l and 'Validation failed' not in l and 'incomplete' not in l]
print('\n'.join(err[:20]))
j=json.loads(txt[txt.index('{'):txt.rindex('}')+1])
c=j['counts']; print({k:c[k] for k in ['lessons','totalQuestions','minimumTeachingCardWords','maximumTeachingCardWords','maximumSentenceWords','averageSentenceWords','maximumSentencesPerParagraph','minimumLessonTheoryWords','maximumLessonTheoryWords','competitorTenWordOverlaps','unresolvedLearnerNumberCount','californiaLeaks']})
print(json.dumps({k:v for k,v in j['details'].items() if v and k not in ('unresolvedRefs','unknownLessons')},indent=1))
print({k:v for k,v in j['checks'].items() if v is not True})
wc=lambda t: len(re.findall(r"[A-Za-z0-9½]+(?:['’][A-Za-z]+)?", t))
for f in sorted(glob.glob('server/content/tx-class-c/2.0.0/lessons/*.json')):
    d=json.load(open(f)); parts=[]
    for b in d['lesson']['blocks']:
        if b.get('bodyMarkdown') is not None:
            w=wc(b['bodyMarkdown']+' '+' '.join(b.get('bullets',[]))); parts.append(f"{b['blockId'].split('-')[-1]}:{w}{'S' if b.get('scope')=='state_specific' else 'U'}")
    tot=sum(int(x.split(':')[1][:-1]) for x in parts)
    flag='' if 285<=tot<=560 else ' <<<'
    print(f"{d['lesson']['lessonId']:34s} {tot}{flag} {' '.join(parts)}")
