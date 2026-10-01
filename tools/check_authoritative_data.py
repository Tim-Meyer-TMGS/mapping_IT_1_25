#!/usr/bin/env python3
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
j=json.load(open(root/'data/mapping-hub-authoritative.json',encoding='utf-8'))
rules=j['rules']; meta=j['meta']; errors=[]

def expect(cond,msg):
    if not cond: errors.append(msg)

def find(kind=None,system=None,ds=None,dim=None,value=None):
    out=[]
    for r in rules:
        s=r['source']
        if kind and r['ruleKind']!=kind: continue
        if system and s.get('system')!=system: continue
        if ds is not None and s.get('datasetType')!=ds: continue
        if dim and s.get('dimension')!=dim: continue
        if value is not None and s.get('value')!=value: continue
        out.append(r)
    return out

expect(meta['activeLogicalMappingRules']==855,'Expected 855 mapping rules')
expect(meta['activeRoutingRules']==55,'Expected 55 routing rules')
expect(meta['activeFallbackRules']==6,'Expected 6 fallback rules')
expect(meta['totalActiveLogicalRules']==916,'Expected 916 total active logical rules')
expect(meta['oneToManyMappingRules']==113,'Expected 113 one-to-many mappings')
expect(len([r for r in rules if r['behavior']=='noImport'])==2,'Expected 2 noImport rules')
expect(len([r for r in rules if r['behavior']=='noTarget'])==1,'Expected 1 noTarget rule')

ev=find('mapping','outdooractive','event','category','Ausstellung')
po=find('mapping','outdooractive','poi','category','Ausstellung')
expect(len(ev)==1 and ev[0]['target']['values']==['Ausstellung'],'Outdooractive Event Ausstellung context wrong')
expect(len(po)==1 and po[0]['target']['values']==['Museum/Sammlung'],'Outdooractive POI Ausstellung context wrong')
fu=find('mapping','outdooractive','event','category','Führung')
expect(len(fu)==1 and set(fu[0]['target']['values'])=={'Vortrag/Lesung/Diskussion','Führung/Besichtigung'},'Outdooractive Event Führung 1:n wrong')
reg=find('mapping','regiondo','package','category','Sehenswürdigkeiten')
expect(len(reg)==1 and reg[0]['behavior']=='noTarget','Regiondo Sehenswürdigkeiten must be noTarget')
fam=find('mapping','outdooractive','poi','feature','familienfreundlich')
expect(len(fam)==1 and fam[0]['behavior']=='noImport','familienfreundlich must be noImport')
expect(find('routing','outdooractive',None,'dataset-routing','Hotel')[0]['target']['datasetType']=='accommodation','Hotel routing wrong')
expect(find('routing','outdooractive',None,'dataset-routing','Restaurant')[0]['target']['datasetType']=='gastro','Restaurant routing wrong')

if errors:
    print('FAILED')
    for e in errors: print('-',e)
    raise SystemExit(1)
print('OK - authoritative data passed all checks')
