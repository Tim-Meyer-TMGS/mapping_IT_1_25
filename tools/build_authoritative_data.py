#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, hashlib, json, os, re, shutil, tempfile, unicodedata, zipfile
from collections import Counter, defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

SYSTEM_IDS = {
    'Bookingkit': 'bookingkit', 'DAMAS': 'damas', 'Feratel': 'feratel', 'Outdooractive': 'outdooractive',
    'Regiondo': 'regiondo', 'TIS POI': 'tis-poi', 'TIS Event': 'tis-event',
    'TIS Gastro': 'tis-gastro', 'TIS Unterkünfte': 'tis-unterkuenfte',
}
SYSTEM_LABELS = {v:k for k,v in SYSTEM_IDS.items()}
DATASET_LABELS = {
    'poi':'POI','event':'Veranstaltungen','gastro':'Gastronomie','accommodation':'Unterkünfte',
    'tour':'Touren','package':'Angebote / Erlebnisse','article':'Artikel','address':'Adressen'
}
TARGET_FIELD_OBSERVED = {'poi':'Kategorie','event':'Kategorie','accommodation':'Kategorie','gastro':'Betriebsart'}


def slug(s:str)->str:
    s = unicodedata.normalize('NFKD', str(s))
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r'[^a-z0-9]+','-',s).strip('-')
    return s[:70] or 'x'

def digest(s:str)->str:
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:10]

def canonical_context(row):
    sys = row['system']; c = row.get('context') or ''; line = int(row.get('line') or 0)
    if sys == 'Bookingkit': return ('package','Package','inferred')
    if sys == 'DAMAS':
        return ({'Hotel':'accommodation','Gastro':'gastro','Poi':'poi','tour':'tour','event':'event'}[c], c, 'confirmed')
    if sys == 'Feratel':
        return ({'Hotel':'accommodation','Package':'package','_feratel_Erlebnisse':'package'}[c], c, 'confirmed')
    if sys == 'Outdooractive':
        # The extraction retained POI as context through the Event blocks. The document comments explicitly switch to Events.
        if 589 <= line <= 728:
            return ('event','Event','corrected-from-document-section')
        return ({'Tour':'tour','Gastro':'gastro','Hotel':'accommodation','POI':'poi'}[c], c, 'confirmed')
    if sys == 'Regiondo': return ('package','Package','confirmed')
    if sys == 'TIS POI': return ('poi','POI','confirmed-by-section-heading')
    if sys == 'TIS Event': return ('event','Event','confirmed-by-section-heading')
    if sys == 'TIS Gastro': return ('gastro','Gastro','confirmed-by-section-heading')
    if sys == 'TIS Unterkünfte': return ('accommodation','Hotel','confirmed-by-section-heading')
    raise KeyError((sys,c,line))

def dimension(row):
    return 'feature' if row.get('record_kind') == 'feature' or row.get('group_kind') == 'FeatureMapping' else 'category'

def row_to_provenance(row):
    return {
        'sourceFile':'Mappingübersicht Fremdsysteme.docx', 'sourceLine':row.get('line'), 'raw':row.get('raw'),
        'note':row.get('note') or None, 'extractionContext':row.get('context') or None,
        'groupKind':row.get('group_kind') or None, 'market':row.get('market') or None,
        'qualityFlag':row.get('quality_flag') or None,
    }

def build_mapping_rules(extraction):
    groups = defaultdict(list)
    excluded=[]
    for row in extraction['records']:
        if row.get('status') != 'active':
            excluded.append(row); continue
        ds, raw_type, confidence = canonical_context(row)
        dim = dimension(row)
        market = row.get('market') or None
        key=(SYSTEM_IDS[row['system']], ds, raw_type, confidence, dim, market, row['source_value'])
        groups[key].append(row)
    rules=[]
    for (system, ds, raw_type, confidence, dim, market, source_value), rows in groups.items():
        target_values=[]; markers=[]
        for row in rows:
            tv=row.get('target_value') or ''
            if row.get('quality_flag')=='no_import' or 'no-import' in tv:
                if tv and tv not in markers: markers.append(tv)
                continue
            if tv and tv not in target_values: target_values.append(tv)
        if any(r.get('quality_flag')=='no_import' or 'no-import' in (r.get('target_value') or '') for r in rows):
            behavior='noImport'; targets=[]
        elif not target_values:
            behavior='noTarget'; targets=[]
        else:
            behavior='map'; targets=target_values
        sys_label=SYSTEM_LABELS[system]
        rid_base='|'.join([system,ds,raw_type,dim,market or '',source_value])
        notes=[]
        for r in rows:
            n=(r.get('note') or '').strip()
            if n and n not in notes: notes.append(n)
        rule={
            'id':f"map-{system}-{ds}-{dim}-{slug(source_value)}-{digest(rid_base)}",
            'ruleKind':'mapping','status':'active','behavior':behavior,
            'source':{
                'system':system,'systemLabel':sys_label,'datasetType':ds,'datasetTypeRaw':raw_type,
                'datasetTypeConfidence':confidence,'dimension':dim,'value':source_value,'language':market,
            },
            'target':{
                'system':'satourn','datasetType':ds,'dimension':dim,
                'field': TARGET_FIELD_OBSERVED.get(ds) if dim=='category' else None,
                'fieldEvidence': ('observed-in-AH67-samples' if dim=='category' and ds in TARGET_FIELD_OBSERVED else 'not-confirmed-by-samples'),
                'values':targets,
            },
            'oneToMany':len(targets)>1,
            'technicalMarkers':markers,
            'notes':notes,
            'provenance':[row_to_provenance(r) for r in rows],
        }
        rules.append(rule)
    rules.sort(key=lambda r:(r['source']['datasetType'],r['source']['system'],r['source']['dimension'],r['source']['language'] or '',r['source']['value'].casefold()))
    return rules,excluded

def build_routing_rules(extraction):
    rules=[]
    for row in extraction.get('source_categories',[]):
        family=row['category_family']
        target_ds='accommodation' if family=='VermieterCategory' else 'gastro' if family=='GastroCategory' else None
        base=f"outdooractive|routing|{family}|{row['source_value']}"
        rules.append({
            'id':f"route-outdooractive-{slug(family)}-{slug(row['source_value'])}-{digest(base)}",
            'ruleKind':'routing','status':'active','behavior':'route',
            'source':{
                'system':'outdooractive','systemLabel':'Outdooractive','datasetType':None,'datasetTypeRaw':None,
                'datasetTypeConfidence':'not-applicable','dimension':'dataset-routing','family':family,'value':row['source_value'],'language':None,
            },
            'target':{'system':'satourn','datasetType':target_ds,'dimension':'datasetType','field':None,'fieldEvidence':'document-structure','values':[target_ds]},
            'oneToMany':False,'technicalMarkers':[],
            'notes':[x for x in [row.get('context'),row.get('note')] if x],
            'reviewFlag':'alte Cats' in (row.get('note') or ''),
            'provenance':[{'sourceFile':'Mappingübersicht Fremdsysteme.docx','sourceLine':row.get('line'),'raw':None,'note':row.get('note') or None}],
        })
    return sorted(rules,key=lambda r:(r['target']['datasetType'] or '',r['source']['value'].casefold()))

def build_fallback_rules(extraction):
    rules=[]
    for f in extraction.get('fallbacks',[]):
        fake={'system':f['system'],'context':f.get('context') or '', 'line':f.get('line') or 0}
        ds,raw_type,confidence=canonical_context(fake)
        dim='feature' if f.get('group_kind')=='FeatureMapping' else 'category'
        value=f.get('value') or ''
        mode='passSourceValue' if value=='FOREIGNVALUE' else 'empty' if not value else 'literal'
        base=f"{SYSTEM_IDS[f['system']]}|{ds}|{dim}|{f.get('group_attrs',{}).get('Mkt','')}|{value}|{f.get('line')}"
        rules.append({
            'id':f"fallback-{SYSTEM_IDS[f['system']]}-{ds}-{dim}-{digest(base)}",'ruleKind':'fallback','status':'active','behavior':'fallback',
            'source':{'system':SYSTEM_IDS[f['system']],'systemLabel':f['system'],'datasetType':ds,'datasetTypeRaw':raw_type,'datasetTypeConfidence':confidence,'dimension':dim,'value':'*','language':f.get('group_attrs',{}).get('Mkt') or None},
            'target':{'system':'satourn','datasetType':ds,'dimension':dim,'field':TARGET_FIELD_OBSERVED.get(ds) if dim=='category' else None,'fieldEvidence':'observed-in-AH67-samples' if ds in TARGET_FIELD_OBSERVED and dim=='category' else 'not-confirmed-by-samples','values':[]},
            'fallback':{'mode':mode,'value':value or None},'oneToMany':False,'technicalMarkers':[],'notes':[],
            'provenance':[{'sourceFile':'Mappingübersicht Fremdsysteme.docx','sourceLine':f.get('line'),'raw':f.get('raw'),'note':None}],
        })
    return rules

def local(tag): return tag.split('}',1)[-1]

def scan_samples(zip_path:Path):
    with tempfile.TemporaryDirectory() as td:
        with zipfile.ZipFile(zip_path) as z: z.extractall(td)
        root=Path(td)
        # Some archives can have a wrapper folder; AH67 has dataset dirs at root.
        dataset_dirs=[p for p in root.iterdir() if p.is_dir()]
        if len(dataset_dirs)==1 and not list(dataset_dirs[0].glob('*.xml')) and any(x.is_dir() for x in dataset_dirs[0].iterdir()):
            root=dataset_dirs[0]
        profile={}; field_rows=[]; vocab_rows=[]
        for d in sorted([p for p in root.iterdir() if p.is_dir()]):
            files=sorted(d.glob('*.xml'))
            fields=defaultdict(lambda:{'occ':0,'files':set(),'nonempty':0,'nonempty_files':set(),'true':0,'langs':Counter(),'examples':[],'namespaces':Counter()})
            roots=Counter(); objects=Counter(); categories=Counter(); operating=Counter(); lang_files=Counter(); id_attrs=Counter(); sources=Counter(); sourcekeys=Counter(); sysids=Counter()
            for fp in files:
                tree=ET.parse(fp); r=tree.getroot(); roots[local(r.tag)]+=1
                children=list(r)
                if children:
                    obj=children[0]; objects[local(obj.tag)]+=1
                    for k,v in obj.attrib.items():
                        if re.search(r'(ID|Id)$',local(k)) or local(k) in {'Betriebsnummer'}: id_attrs[local(k)]+=1
                file_langs=set()
                for e in r.iter():
                    n=local(e.tag); ns=e.tag[1:].split('}',1)[0] if e.tag.startswith('{') else ''
                    info=fields[n]; info['occ']+=1; info['files'].add(fp.name); info['namespaces'][ns]+=1
                    txt=(e.text or '').strip()
                    if txt:
                        info['nonempty']+=1; info['nonempty_files'].add(fp.name)
                        if txt.lower()=='true': info['true']+=1
                        if len(txt)<=120 and txt not in info['examples'] and len(info['examples'])<3: info['examples'].append(txt)
                    lang=e.attrib.get('{http://www.w3.org/XML/1998/namespace}lang')
                    if lang: info['langs'][lang]+=1; file_langs.add(lang)
                    if n=='Kategorie' and txt: categories[txt]+=1
                    if n=='Betriebsart' and txt: operating[txt]+=1
                    if n=='Quelle' and txt: sources[txt]+=1
                    if n=='Quellekey' and txt: sourcekeys[txt]+=1
                    if n.startswith('SYSTEMID_') and txt: sysids[n]+=1
                for lang in file_langs: lang_files[lang]+=1
            canon={'Poi':'poi','Event':'event','Gastro':'gastro','Hotel':'accommodation','Article':'article','Address':'address'}.get(d.name,d.name.lower())
            vocab=categories if categories else operating
            vocab_field='Kategorie' if categories else 'Betriebsart' if operating else None
            profile[canon]={
                'sourceDirectory':d.name,'files':len(files),'rootElements':dict(roots),'objectElements':dict(objects),'recordIdAttributes':dict(id_attrs),
                'uniqueFieldNames':len(fields),'languageFiles':dict(lang_files),'sourceValues':dict(sources),'sourceKeyValues':dict(sourcekeys),
                'nonEmptyExternalSystemIdFields':dict(sysids),'observedVocabularyField':vocab_field,'observedVocabularyUniqueValues':len(vocab),
            }
            for n,info in sorted(fields.items()):
                field_rows.append({
                    'datasetType':canon,'sourceDirectory':d.name,'field':n,'occurrences':info['occ'],'filesPresent':len(info['files']),
                    'nonemptyOccurrences':info['nonempty'],'filesNonempty':len(info['nonempty_files']),'trueOccurrences':info['true'],
                    'languages':'|'.join(sorted(info['langs'])),'namespaces':'|'.join(sorted(k for k in info['namespaces'] if k)),
                    'examples':' || '.join(info['examples'])
                })
            if vocab_field:
                for val,count in sorted(vocab.items(),key=lambda x:x[0].casefold()):
                    vocab_rows.append({'datasetType':canon,'field':vocab_field,'value':val,'occurrences':count})
        return profile,field_rows,vocab_rows

def fold(s):
    s=unicodedata.normalize('NFKD',s); s=''.join(c for c in s if not unicodedata.combining(c)).casefold()
    return re.sub(r'\s+',' ',s).strip().replace(' / ','/').replace(' & ','&')

def sample_validation(mapping_rules,vocab_rows):
    mapped=defaultdict(set)
    for r in mapping_rules:
        if r['behavior']=='map' and r['source']['dimension']=='category': mapped[r['target']['datasetType']].update(r['target']['values'])
    observed=defaultdict(set)
    for r in vocab_rows: observed[r['datasetType']].add(r['value'])
    out={}
    for ds in sorted(set(mapped)|set(observed)):
        exact=sorted(mapped[ds]&observed[ds],key=str.casefold)
        norm_index=defaultdict(list)
        for v in mapped[ds]: norm_index[fold(v)].append(v)
        normalized=[]
        for v in observed[ds]-set(exact):
            if fold(v) in norm_index:
                normalized.append({'sampleValue':v,'mappingValues':sorted(norm_index[fold(v)],key=str.casefold)})
        out[ds]={
            'mappingTargetValues':len(mapped[ds]),'sampleObservedValues':len(observed[ds]),'exactMatches':len(exact),
            'exactMatchValues':exact,'normalizedOnlyMatches':normalized,
            'sampleOnlyValues':sorted(observed[ds]-set(exact),key=str.casefold),
            'warning':'AH67-T309 is a sample, not a complete SaTourN taxonomy. Sample-only or mapping-only values are not errors by themselves.'
        }
    return out

def write_csv(path, rows, fieldnames=None):
    rows=list(rows)
    if fieldnames is None:
        fieldnames=[]
        for row in rows:
            for k in row:
                if k not in fieldnames: fieldnames.append(k)
    with open(path,'w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fieldnames); w.writeheader(); w.writerows(rows)

def flatten_rules(rules):
    rows=[]
    for r in rules:
        rows.append({
            'id':r['id'],'ruleKind':r['ruleKind'],'behavior':r['behavior'],'system':r['source']['systemLabel'],
            'sourceDatasetType':r['source'].get('datasetType'),'sourceDatasetTypeRaw':r['source'].get('datasetTypeRaw'),
            'datasetTypeConfidence':r['source'].get('datasetTypeConfidence'),'dimension':r['source'].get('dimension'),
            'language':r['source'].get('language'),'sourceValue':r['source'].get('value'),'targetDatasetType':r['target'].get('datasetType'),
            'targetField':r['target'].get('field'),'targetValues':' | '.join(r['target'].get('values') or []),
            'oneToMany':r.get('oneToMany',False),'fallbackMode':(r.get('fallback') or {}).get('mode'),
            'fallbackValue':(r.get('fallback') or {}).get('value'),'technicalMarkers':' | '.join(r.get('technicalMarkers') or []),
            'notes':' | '.join(r.get('notes') or []),'sourceLines':' | '.join(str(p.get('sourceLine')) for p in r.get('provenance',[]) if p.get('sourceLine')),
        })
    return rows

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',default=str(Path(__file__).resolve().parents[1])); args=ap.parse_args()
    root=Path(args.root); inp=root/'input'; data=root/'data'
    if not (inp/'Mappingbestand_Extraktion_Arbeitsstand_2026-09-24.json').exists():
        inp=root/'source'/'authoritative-2026-10-01'
    extraction=json.load(open(inp/'Mappingbestand_Extraktion_Arbeitsstand_2026-09-24.json',encoding='utf-8'))
    mapping_rules,excluded=build_mapping_rules(extraction); routing=build_routing_rules(extraction); fallbacks=build_fallback_rules(extraction)
    profile,fields,vocab=scan_samples(inp/'AH67-T309.zip')
    all_rules=mapping_rules+routing+fallbacks
    behavior_counts=Counter(r['behavior'] for r in all_rules); kind_counts=Counter(r['ruleKind'] for r in all_rules)
    ds_counts=Counter(r['source'].get('datasetType') for r in mapping_rules); system_counts=Counter(r['source']['system'] for r in mapping_rules)
    meta={
        'generatedAt':'2026-10-01','sourcePriority':['Mappingübersicht Fremdsysteme.docx / extracted rows','AH67-T309 observed SaTourN samples','GitHub repository only as implementation reference'],
        'activePhysicalMappingRows':sum(1 for x in extraction['records'] if x['status']=='active'),
        'activeLogicalMappingRules':len(mapping_rules),'activeRoutingRules':len(routing),'activeFallbackRules':len(fallbacks),'totalActiveLogicalRules':len(all_rules),
        'commentedRowsExcluded':len(excluded),'oneToManyMappingRules':sum(r['oneToMany'] for r in mapping_rules),
        'behaviorCounts':dict(behavior_counts),'ruleKindCounts':dict(kind_counts),'mappingRulesByDatasetType':dict(ds_counts),'mappingRulesBySystem':dict(system_counts),
        'criticalCorrection':'Outdooractive Event blocks at extraction lines 589-728 are classified as Event, not POI. The prior extraction context remained POI across those comments.',
        'odtaStatus':'No verified SaTourN-to-ODTA mapping rules were supplied. An ODTA vocabulary/specification must not be presented as a confirmed mapping.'
    }
    systems=[]
    for label,sid in SYSTEM_IDS.items(): systems.append({'id':sid,'label':label,'role':'source'})
    systems += [{'id':'satourn','label':'SaTourN / eT4','role':'target'},{'id':'odta','label':'ODTA','role':'reference-target-without-verified-rules'}]
    dataset_types=[{'id':k,'label':v,'mappingSourceAvailable':k in ds_counts,'sampleDataAvailable':k in profile} for k,v in DATASET_LABELS.items()]
    authoritative={'meta':meta,'systems':systems,'datasetTypes':dataset_types,'rules':all_rules}
    json.dump(authoritative,open(data/'mapping-hub-authoritative.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
    json.dump(profile,open(data/'satourn-sample-profile.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
    json.dump(sample_validation(mapping_rules,vocab),open(data/'sample-validation.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
    write_csv(data/'mapping-rules.csv',flatten_rules(all_rules))
    write_csv(data/'excluded-commented-rows.csv',excluded)
    write_csv(data/'satourn-observed-fields.csv',fields)
    write_csv(data/'satourn-observed-vocabularies.csv',vocab)
    # Compact machine-readable QA report
    errors=[]
    ids=[r['id'] for r in all_rules]
    if len(ids)!=len(set(ids)): errors.append('Duplicate rule IDs')
    for r in mapping_rules:
        if r['behavior']=='map' and not r['target']['values']: errors.append(f"map without target: {r['id']}")
        if r['behavior'] in ('noImport','noTarget') and r['target']['values']: errors.append(f"special behavior with target: {r['id']}")
    report={'ok':not errors,'errors':errors,'counts':meta}
    json.dump(report,open(data/'validation-report.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)

if __name__=='__main__': main()
