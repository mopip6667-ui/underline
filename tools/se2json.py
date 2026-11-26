"""Convert a Standard Ebooks source repo into Underline reader JSON. Usage: se2json.py REPO_DIR OUT.json [only-file-substring ...]"""
import sys, json, re, os, xml.etree.ElementTree as ET
repo, out, only = sys.argv[1], sys.argv[2], sys.argv[3:]
NS = {'x':'http://www.w3.org/1999/xhtml','opf':'http://www.idpf.org/2007/opf','dc':'http://purl.org/dc/elements/1.1/'}
EP = '{http://www.idpf.org/2007/ops}type'
opf = ET.parse(os.path.join(repo,'src/epub/content.opf')).getroot()
meta = opf.find('opf:metadata',NS)
title = meta.find('dc:title',NS).text
author = meta.find('dc:creator',NS).text
contribs = [c.text for c in meta.findall('dc:contributor',NS)]
manifest = {i.get('id'): i.get('href') for i in opf.find('opf:manifest',NS)}
spine = [manifest[r.get('idref')] for r in opf.find('opf:spine',NS)]
SKIP = ('titlepage','imprint','colophon','uncopyright','toc','halftitlepage','loi','endnotes','dedication','epigraph')
def text(el):
    parts=[]
    def walk(e):
        if e.get(EP,'') .find('noteref')>=0: 
            if e.tail: parts.append(e.tail)
            return
        if e.tag.endswith('br'): parts.append(' ')
        if e.text: parts.append(e.text)
        for c in e: walk(c)
        if e.tail and e is not el: parts.append(e.tail)
    walk(el)
    return re.sub(r'\s+',' ',''.join(parts)).strip()
chapters=[]
for href in spine:
    name=os.path.basename(href)
    if any(name.startswith(s) for s in SKIP): continue
    if only and not any(o in name for o in only): continue
    root=ET.parse(os.path.join(repo,'src/epub',href)).getroot()
    body=root.find('x:body',NS)
    sections=[s for s in body.iter() if s.tag.endswith('section') or s.tag.endswith('article')]
    parent={c:p for p in body.iter() for c in p}
    def own_heading(s):
        for c in s:
            t=c.tag.split('}')[-1]
            if t in ('h1','h2','h3','h4','h5','h6','hgroup'): return text(c)
        return None
    # leaf sections become chapters; fall back to the whole body
    leaves=[s for s in sections if not any((c.tag.endswith('section') or c.tag.endswith('article')) for c in s)] or [body]
    for sec in leaves:
        h=None; paras=[]
        for el in sec.iter():
            tag=el.tag.split('}')[-1]
            if tag in ('h1','h2','h3','h4','h5','h6','hgroup') and h is None:
                h=text(el)
            elif tag=='p':
                t=text(el)
                if t: paras.append(t)
        if not paras: continue
        if not h:
            t=root.find('x:head/x:title',NS); h=t.text if t is not None else name
        p=parent.get(sec)
        while p is not None and p is not body:
            ph=own_heading(p)
            if ph and ph!=h: h=ph+' · '+h; break
            p=parent.get(p)
        chapters.append({'title':h,'paras':paras})
data={'title':title,'author':author,'translator':', '.join(c for c in contribs if c and 'Standard' not in c)[:120],
      'source':{'name':'Standard Ebooks (public domain)','url':'https://standardebooks.org/ebooks/'+os.path.basename(repo.rstrip('/')).replace('_','/')},
      'chapters':chapters}
json.dump(data,open(out,'w'),ensure_ascii=False,separators=(',',':'))
words=sum(len(p.split()) for c in chapters for p in c['paras'])
print(f"{out}: {len(chapters)} chapters, {words:,} words, {os.path.getsize(out)//1024} KB")
