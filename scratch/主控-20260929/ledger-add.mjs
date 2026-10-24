// 用法：node ledger-add.mjs "<节标题里的关键字，如 signature-wall · 竖版>" "<整行 markdown>"
import fs from 'fs';
const [key,row]=process.argv.slice(2); const p='docs/每日/账号选题台账.md';
const L=fs.readFileSync(p,'utf8').split('\n');
const h=L.findIndex(l=>/^#{2,3} /.test(l)&&l.includes(key)); if(h<0) throw new Error('no section '+key);
let end=h+1; while(end<L.length && !/^#{2,3} /.test(L[end])) end++;
let last=-1; for(let i=h+1;i<end;i++) if(L[i].startsWith('|')) last=i;
if(last<0) throw new Error('no table in '+key);
if(L.slice(h,end).includes(row)) { console.log('exists'); process.exit(0); }
L.splice(last+1,0,row); fs.writeFileSync(p,L.join('\n')); console.log('added to',L[h]);
