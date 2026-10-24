# -*- coding: utf-8 -*-
# edits: {file_stem: [(line_no(1-based, in ORIGINAL), action, text)]}  action: 'r' replace, 'd' delete, 'a' insert after
import os, difflib, re, json
D = os.path.dirname(os.path.abspath(__file__))
O = os.path.join(D, 'orig')

E = {
'20260929-AI代部署-ledger-desk-v': [
 (20,'r','下回有人拍下一单，你连上他的电脑，照着自己装过的那一遍走，装完就断开。')],
'20261001-AI代部署-blueprint-v': [
 (21,'r','想要的人再多，每一单也得你本人坐在电脑前，这一点挂链接之前就得想好。')],
'20261001-C盘清理-signature-wall-v': [
 (15,'d',''),(16,'d',''),(17,'d',''),(18,'d',''),
 (21,'r','再看人家说明是怎么写的，软件写了哪些、远程写了哪些，照着列一份你自己的。'),
 (22,'r','这样挂出去，买家看一眼说明，就知道花这五块钱买到的是什么。')],
'20260929-剪映工程培训-signature-wall-v': [
 (9,'r','所以这个品卖的，是一套能让人拆开来学的剪法。'),
 (11,'r','货很简单，工程从同行那里买来，再挂出去卖。'),
 (12,'r','闲鱼上卖这个的同行不少，挑一家整理得清楚的，拍下他的链接，整套工程就到你手里了。'),
 (18,'r','你要是想做，第一步先挑两三家想要人多的，各买一套回来。'),
 (19,'r','打开对比一下，哪套整理得清楚、别人照着改就能用，就先挂哪一套。'),
 (20,'r','文件卖出去以后，回头来问你这一层是怎么做的人，就是以后会找你学剪辑的人。')],
'20261001-剪映工程培训-pixel-arcade-v': [
 (17,'r','货也不用你自己剪，同行那里就有现成的。'),
 (19,'r','再挑其中整理得最清楚的那家，买一套回来先挂上。'),
 (20,'r','别人标几毛，你不用跟，一块钱左右挂着就行。')],
'20261001-玄学寻物-lime-capsule-v': [
 (22,'r','排第一的那家也就几行字，你的这几行别写得比它长，写清楚就够。')],
'20261001-老照片修复-black-yellow-v2-v': [
 (21,'r','这样挂出去，来问的人先发图，你看完再报价，一张一个价。')],
'20260929-韩剧老片转卖-lime-capsule-v': [
 (8,'r','片源自己就能找，打开搜索引擎，搜片名再加上网盘两个字。'),
 (20,'r','挂之前再拿片名搜一遍，能搜到你自己，这一条才算挂对。')],
'20261001-韩剧老片转卖-ledger-desk-v': [
 (9,'r','最省事的是直接在闲鱼找卖这部片的同行，拍下他的链接，他就把片子发给你了。'),
 (19,'r','以后有人问完豆包、拿着片名来闲鱼一搜，排出来的那几家里就有你。')],
'20261001-买家压价怎么回-selfie-03': [
 (19,'r','那条九毛的小刀价是平台给的，你自己报出去的价，就别再一让再让了。')],
'20261001-先做跑通的品-selfie-01': [
 (21,'r','不知道卖什么的时候，就从这种一百多人想要的品里挑一个开始。')],
'20260929-引流款和利润款-selfie-02': [
 (20,'r','等有人拍了一块钱那条，回头又来问升级版，这两条链接就算分对了。')],
'20261001-有没有被限流-selfie-02': [
 (21,'r','搜不到自己也别慌，先停手，好好上新回消息，过一阵再搜一遍看看。')],
'20260929-淘客截流-selfie-01': [
 (12,'a','返利链接去各个电商平台的官方返利网，开个号就有。'),
 (20,'r','你要是想试，第一步先去官方返利网开个号，再到闲鱼搜几个你熟悉的牌子。'),
 (21,'r','比价的人从你给的链接下了单，佣金就落到你手里。')],
'20260929-要退就退-selfie-03': [
 (10,'r','而且你吵赢了，留下的也就是这几块钱。'),
 (11,'r','为了这几块钱去跟人吵，不值当。'),
 (20,'r','下回再碰到几块钱的单子要退，点同意，然后去忙别的。')],
}

def apply(lines, edits):
    out = []
    m = {}
    for n,a,t in edits: m.setdefault(n,[]).append((a,t))
    for i,l in enumerate(lines,1):
        acts = m.get(i,[])
        if any(a=='d' for a,_ in acts): pass
        else:
            r = [t for a,t in acts if a=='r']
            out.append(r[0] if r else l)
        for a,t in acts:
            if a=='a': out.append(t)
    return out

for stem, edits in E.items():
    src = open(os.path.join(O, stem+'.txt'), encoding='utf-8').read().rstrip('\n').split('\n')
    new = apply(src, edits)
    open(os.path.join(D, stem+'.txt'),'w',encoding='utf-8',newline='\n').write('\n'.join(new)+'\n')
    sm = os.path.join(O, stem+'.素材.md')
    if os.path.exists(sm):
        md = open(sm, encoding='utf-8', newline='').read().split('\n')
        rows = [(k,l) for k,l in enumerate(md) if re.match(r'^\| \d+ \|', l)]
        cells = [l.split(' | ') for _,l in rows]
        assert len(rows)==len(src), (stem, len(rows), len(src))
        # build new rows following edit mapping
        newrows = []
        m = {}
        for n,a,t in edits: m.setdefault(n,[]).append((a,t))
        for i,l in enumerate(src,1):
            c = rows[i-1][1].split(' | ')
            acts = m.get(i,[])
            if not any(a=='d' for a,_ in acts):
                r=[t for a,t in acts if a=='r']
                assert c[1].rstrip(chr(13))==l, (stem,i,c[1],l)
                if r:
                    c[1]=r[0]+(chr(13) if c[1].endswith(chr(13)) else '')
                newrows.append(c)
            for a,t in acts:
                if a=='a': newrows.append(['|', t, '（无，口播）', ' |'])
        out=[]
        for j,c in enumerate(newrows,1):
            c=list(c); c[0]=f'| {j}'; out.append(' | '.join(c))
        first=rows[0][0]; last=rows[-1][0]
        md2 = md[:first]+out+md[last+1:]
        txt='\n'.join(md2)
        # renumber references like 第 16 句 only if deletions changed numbering
        open(os.path.join(D, stem+'.素材.md'),'w',encoding='utf-8',newline='\n').write(txt)
    print(stem, len(src), '->', len(new), 'chars', sum(len(x) for x in new))
