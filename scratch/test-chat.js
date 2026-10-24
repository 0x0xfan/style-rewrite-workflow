const draft = `@左 粉丝 avatar=left-fa.png
@右 圣矾 avatar=right-shengfan.jpg
粉丝：圣矾哥，闲鱼搜捏脸，单款标价1到3块钱，真有人买吗？
粉丝：[图片 nielian-item-5200want.png]
粉丝：合集8.8到15.8元，单链接5200人想要，出单几千笔！
粉丝：游戏里不都有默认脸型吗，买家图啥啊？
圣矾：怎么没人买，买的人可太多了 {hold=2}
圣矾：永劫无间、逆水寒里很多年轻玩家都想变美
圣矾：但自己调2个小时参数，还是跟外星人一样
粉丝：[表情 sweat.png]
粉丝：确实，我之前自己捏过，丑得不敢出门
圣矾：对啊，买家掏这2、3块钱，买的是省去2小时折腾
圣矾：买个现成神颜二维码，游戏里一键扫码，1秒直接导入
粉丝：那这种捏脸数据要从哪弄？自己也得会捏脸吗？
圣矾：根本不用你会捏 {hold=2}
圣矾：网上或同行手里都有现成整理好的
圣矾：导出的二维码图片或代码文本，直接存网盘
粉丝：那有人拍下了，怎么发给对方？
圣矾：配置好自动发货软件，买家付款秒发网盘
圣矾：纯虚拟资料零成本，一单净赚2、3块，卖一单纯赚一单
粉丝：[表情 shock.png]
粉丝：这也太省心了，那我今天就把所有热门游戏全挂上去！
圣矾：先打住，这里有几个关键点 {hold=2}
圣矾：不同游戏、不同职业和体型都有对应限制
圣矾：文案里客观分类写清楚，买家才不会找你
圣矾：最关键的红线，绝不能碰外挂、辅助和修改器
圣矾：主图放游戏内实机高清对比图，突出扫码1秒导入
粉丝：明白了，实机对比图吸引人，合规整理不踩坑
粉丝：原来年轻人的爱美经济，在闲鱼也是纯自动化搞钱啊
圣矾：做闲鱼就是这样，搞懂别人为什么省时间，生意就成了 {hold=2}
圣矾：[表情 doge.png]
=====素材清单=====
nielian-item-5200want.png：闲鱼实搜永劫无间捏脸的一条同行详情页截图，展示单款标价「1.99元」、想要人数「5200人想要」、店铺累计成交「16.7万件」，承诺「24小时自动发货，即拍秒发」（截图用实搜原图，本机 D:\\项目仓库\\remotion视频制作\\public\\ips\\xianyu-fanshen\\assets\\nielian-daima\\market\\02-top1-detail.png）
sweat.png：一个流汗尴尬的表情包
shock.png：一个震惊瞪大眼睛的表情包
doge.png：doge 狗头表情包
`;

const lines = draft.split('\n');
const sepIdx = lines.findIndex(l => l.trim() === '=====素材清单=====');
const chat = lines.slice(2, sepIdx).filter(l => l.trim());
console.log('Total messages:', chat.length);

let totalHanzi = 0;
let mediaCount = 0;
chat.forEach((m, i) => {
  const colon = m.indexOf('：');
  const text = m.slice(colon + 1).replace(/\{hold=\d+\}/g, '').trim();
  if (text.startsWith('[')) {
    mediaCount++;
    return;
  }
  const hanzi = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  totalHanzi += hanzi;
  console.log(`${i+1}. [${text.length}字, ${hanzi}汉字] ${text}`);
});
console.log('Media count:', mediaCount);
console.log('Total Hanzi in dialog:', totalHanzi);
