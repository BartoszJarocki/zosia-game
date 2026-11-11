# pace.py [md|all] : from the fast runs, how long the game makes her wait (verification tooling).
# Run it in the folder that holds fast/<mission>-L<n>-fast/summary.json.
#   wait    seconds from her right answer to the next question she can answer (the game's time, not hers)
#   intro   seconds from the mission opening to the first question
#   ending  seconds from her last answer to the badge
# SEEN=1 reads each wait as the player saw it (waitSeenMs, after its own pauses: how the November review measured)
import json, glob, os, statistics, sys
WAIT = 'waitSeenMs' if os.environ.get('SEEN') else 'waitNextMs'
ORDER = ['letters','balloons','name','cones','stones','counting','lookout','delivery','picnic','garage','mercury','venus','moon','mars','jupiter','saturn','pluto','blackhole','comet','stars','telescope','lighthouse','shallows','reef','port']
NAMES = {'letters':'Kitty Park','balloons':'Balloon Hill','name':'Name Train','cones':'Cone Road','stones':'The River','counting':'Treat House','lookout':'The Lookout','delivery':'Pup Delivery','picnic':'Pup Picnic','garage':'The Garage','mercury':'Mercury','venus':'Venus','moon':'Moon','mars':'Mars','jupiter':'Jupiter','saturn':'Saturn','pluto':'Pluto','blackhole':'Black Hole','comet':'Comet','stars':'Star Pictures','telescope':'Telescope','lighthouse':'Lighthouse','shallows':'Floats or sinks','reef':'Reef','port':'Port'}
def load():
    by = {}
    for f in sorted(glob.glob('fast/*-fast/summary.json')):
        d = json.load(open(f))
        r = [x for x in d['rounds'] if x.get('answerMs') is not None and x.get(WAIT) is not None]
        if not d.get('missionSeconds') or not r: continue
        end = r[-1]['tSolved'] + r[-1]['waitNextMs']  # (the badge, by either measure)
        start = end - d['missionSeconds'] * 1000
        by.setdefault(d['kind'], []).append({
            'level': d['level'], 'secs': d['missionSeconds'], 'q': len(r),
            'waits': [x[WAIT] / 1000 for x in r[:-1]], 'ending': r[-1][WAIT] / 1000,
            'intro': (r[0]['tOpen'] - start) / 1000, 'hers': sum(x['answerMs'] for x in r) / 1000,
            'ignored': sum(x.get('ignored', 0) for x in r), 'ok': d['celebrated'] and not d['errors'] and not any(x.get('stuck') for x in d['rounds'])})
    return by
def rows(by):
    out = []
    for k in ORDER:
        if k not in by: continue
        rs = by[k]
        waits = [w for r in rs for w in r['waits']]
        out.append({'kind': k, 'name': NAMES[k], 'levels': len(rs), 'qmin': min(r['q'] for r in rs), 'qmax': max(r['q'] for r in rs),
            'smin': round(min(r['secs'] for r in rs)), 'smax': round(max(r['secs'] for r in rs)),
            'wait': statistics.median(waits) if waits else 0, 'waitmax': max(waits) if waits else 0,
            'intro': statistics.median(r['intro'] for r in rs), 'ending': statistics.median(r['ending'] for r in rs),
            'share': round(100 * sum(r['hers'] for r in rs) / sum(r['secs'] for r in rs)), 'ignored': sum(r['ignored'] for r in rs), 'bad': [r['level'] for r in rs if not r['ok']]})
    return out
if __name__ == '__main__':
    by = load(); rs = rows(by)
    rng = lambda a, b: f'{a}' if a == b else f'{a} to {b}'
    if len(sys.argv) > 1 and sys.argv[1] == 'md':
        print('| Mission | Questions per visit | A visit takes (s) | Wait after a right answer (s), middle and longest | Before the first question (s) | After the last answer (s) |')
        print('|---|---|---|---|---|---|')
        for r in rs: print(f"| {r['name']} | {rng(r['qmin'], r['qmax'])} | {rng(r['smin'], r['smax'])} | {r['wait']:.1f} and {r['waitmax']:.1f} | {r['intro']:.1f} | {r['ending']:.1f} |")
    else:
        print(f"{'mission':16} lv  questions  visit s   wait med/max   intro  ending  hers  ignored")
        for r in rs: print(f"{r['name']:16} {r['levels']:>2}  {rng(r['qmin'], r['qmax']):>9}  {rng(r['smin'], r['smax']):>8}  {r['wait']:5.1f} /{r['waitmax']:5.1f}  {r['intro']:5.1f}  {r['ending']:5.1f}  {r['share']:3}%  {r['ignored']:>4}  {'NOT OK ' + str(r['bad']) if r['bad'] else ''}")
        allw = [w for k in by for r in by[k] for w in r['waits']]
        print(f"all missions: {sum(r['levels'] for r in rs)} levels, middle wait {statistics.median(allw):.1f} s, share of waits over 4 s: {100 * sum(w > 4 for w in allw) / len(allw):.0f}%, over 8 s: {100 * sum(w > 8 for w in allw) / len(allw):.0f}%")
