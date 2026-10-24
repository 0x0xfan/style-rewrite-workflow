import fs from 'node:fs';
import path from 'node:path';

const NAS_BASE = 'Z:\\素材生成库\\ai文案\\待审文案';
const LOCAL_BASE = 'research-runs/每日';

const coversData = {
  '拼多多砍价': {
    skin: 'black-yellow-v2',
    options: [
      {
        id: 1,
        style: '收益爆点型',
        title: '闲鱼多多砍一刀',
        highlight: '一单利润率七成',
        sub: '放单渠道全流程拆解'
      },
      {
        id: 2,
        style: '零本实操型',
        title: '闲鱼多多助力代砍',
        highlight: '零成本无货源',
        sub: '一部手机秒出单'
      },
      {
        id: 3,
        style: '极简承诺型',
        title: '闲鱼多多砍价项目',
        highlight: '七天之内必出单',
        sub: '一部手机就能操作'
      },
      {
        id: 4,
        style: '薄利多销型',
        title: '一单只收一块钱',
        highlight: '秒出单靠走量',
        sub: '月销几千单的秘密'
      },
      {
        id: 5,
        style: '一手渠道型',
        title: '闲鱼多多助力',
        highlight: '一手放单渠道',
        sub: '差价逻辑全盘交代'
      },
      {
        id: 6,
        style: '冷门暴利型',
        title: '闷声发财小生意',
        highlight: '闲鱼多多代砍',
        sub: '很多人不知道的搞钱路子'
      },
      {
        id: 7,
        style: '全自动交付',
        title: '搭建自动化系统',
        highlight: '对接社群任务',
        sub: '不占用日常上班时间'
      },
      {
        id: 8,
        style: '低门槛人群',
        title: '适合新人的副业',
        highlight: '闲鱼多多砍价',
        sub: '零基础小白直接照做'
      },
      {
        id: 9,
        style: '一期讲透型',
        title: '一期全流程通关',
        highlight: '闲鱼多多砍价',
        sub: '渠道定价避坑一次讲透'
      },
      {
        id: 10,
        style: '老玩家交底',
        title: '闲鱼虚拟项目拆解',
        highlight: '多多砍价代点',
        sub: '学闲鱼找圣矾'
      }
    ]
  },
  '减脂计划': {
    skin: 'lime-capsule',
    options: [
      {
        id: 1,
        style: '收益爆点型',
        title: '在闲鱼卖减脂计划',
        highlight: '一单最高卖99元',
        sub: '零成本交付全流程'
      },
      {
        id: 2,
        style: '零本实操型',
        title: '闲鱼定制减脂食谱',
        highlight: '零成本无货源',
        sub: '问卷模板直接套用'
      },
      {
        id: 3,
        style: '极简承诺型',
        title: '闲鱼减脂计划项目',
        highlight: '七天之内必出单',
        sub: '一部手机就能操作'
      },
      {
        id: 4,
        style: '薄利多销型',
        title: '一份食谱几十块',
        highlight: '高复购高客单',
        sub: '标准化交付月入稳定'
      },
      {
        id: 5,
        style: '一手渠道型',
        title: '闲鱼减脂食谱定制',
        highlight: '成熟问卷与AI流',
        sub: '交付逻辑全盘交代'
      },
      {
        id: 6,
        style: '冷门暴利型',
        title: '闷声发财小生意',
        highlight: '闲鱼卖减脂计划',
        sub: '很多人不知道的搞钱路子'
      },
      {
        id: 7,
        style: '全自动交付',
        title: '结构化问卷交付',
        highlight: '网盘自动发货',
        sub: '不占用日常上班时间'
      },
      {
        id: 8,
        style: '低门槛人群',
        title: '适合新人的副业',
        highlight: '闲鱼减脂计划',
        sub: '零基础小白直接照做'
      },
      {
        id: 9,
        style: '一期讲透型',
        title: '一期全流程通关',
        highlight: '闲鱼减脂计划',
        sub: '定位问卷交付一次讲透'
      },
      {
        id: 10,
        style: '老玩家交底',
        title: '闲鱼虚拟项目拆解',
        highlight: '卖定制减脂计划',
        sub: '学闲鱼找圣矾'
      }
    ]
  },
  '老照片修复': {
    skin: 'signature-wall',
    options: [
      {
        id: 1,
        style: '收益爆点型',
        title: '闲鱼老照片修复',
        highlight: '单张收费20元',
        sub: 'AI工具一键高清'
      },
      {
        id: 2,
        style: '零本实操型',
        title: '闲鱼老照片翻新',
        highlight: '零门槛纯利润',
        sub: '实操接单全流程'
      },
      {
        id: 3,
        style: '极简承诺型',
        title: '闲鱼老照片项目',
        highlight: '七天之内必出单',
        sub: '一部手机就能操作'
      },
      {
        id: 4,
        style: '薄利多销型',
        title: '一张收费五到二十',
        highlight: '单链接出千单',
        sub: '留存回忆刚需长尾'
      },
      {
        id: 5,
        style: '一手渠道型',
        title: '闲鱼老照片修复',
        highlight: '一手AI修复工具',
        sub: '接单流程全盘交代'
      },
      {
        id: 6,
        style: '冷门暴利型',
        title: '闷声发财小生意',
        highlight: '闲鱼老照片修复',
        sub: '很多人不知道的搞钱路子'
      },
      {
        id: 7,
        style: '全自动交付',
        title: '半自动工具流',
        highlight: '十分钟交付买家',
        sub: '不占用日常上班时间'
      },
      {
        id: 8,
        style: '低门槛人群',
        title: '适合新人的副业',
        highlight: '闲鱼老照片修复',
        sub: '零基础小白直接照做'
      },
      {
        id: 9,
        style: '一期讲透型',
        title: '一期全流程通关',
        highlight: '闲鱼老照片修复',
        sub: '工具定价交付一次讲透'
      },
      {
        id: 10,
        style: '老玩家交底',
        title: '闲鱼老照片实操拆解',
        highlight: '老照片修复翻新',
        sub: '学闲鱼找圣矾'
      }
    ]
  },
  '电影票代买': {
    skin: 'ledger-desk',
    options: [
      {
        id: 1,
        style: '收益爆点型',
        title: '闲鱼电影票代买',
        highlight: '3000单利近3万',
        sub: '一单差价5到15元'
      },
      {
        id: 2,
        style: '零本实操型',
        title: '闲鱼低价电影票',
        highlight: '无需垫资囤票',
        sub: '一手出票渠道全公开'
      },
      {
        id: 3,
        style: '极简承诺型',
        title: '闲鱼电影票项目',
        highlight: '七天之内必出单',
        sub: '一部手机就能操作'
      },
      {
        id: 4,
        style: '薄利多销型',
        title: '一张只赚十来块',
        highlight: '周末场场爆满',
        sub: '影迷刚需稳定复购'
      },
      {
        id: 5,
        style: '一手渠道型',
        title: '闲鱼电影票代买',
        highlight: '一手分销出票渠道',
        sub: '差价逻辑全盘交代'
      },
      {
        id: 6,
        style: '冷门暴利型',
        title: '闷声发财小生意',
        highlight: '闲鱼电影票代买',
        sub: '很多人不知道的搞钱路子'
      },
      {
        id: 7,
        style: '全自动交付',
        title: '快速出票系统',
        highlight: '代下单秒出码',
        sub: '不占用日常上班时间'
      },
      {
        id: 8,
        style: '低门槛人群',
        title: '适合新人的副业',
        highlight: '闲鱼电影票代买',
        sub: '零基础小白直接照做'
      },
      {
        id: 9,
        style: '一期讲透型',
        title: '一期全流程通关',
        highlight: '闲鱼电影票代买',
        sub: '渠道比价避坑一次讲透'
      },
      {
        id: 10,
        style: '老玩家交底',
        title: '闲鱼虚拟项目拆解',
        highlight: '电影票代买服务',
        sub: '学闲鱼找圣矾'
      }
    ]
  },
  'codex安装': {
    skin: 'blueprint',
    options: [
      {
        id: 1,
        style: '收益爆点型',
        title: '闲鱼Codex环境安装',
        highlight: '800单赚7000元',
        sub: '一单收费9.9元'
      },
      {
        id: 2,
        style: '零本实操型',
        title: '闲鱼远程部署Codex',
        highlight: '零成本技术变现',
        sub: '标准化脚本远程搞定'
      },
      {
        id: 3,
        style: '极简承诺型',
        title: '闲鱼Codex安装项目',
        highlight: '七天之内必出单',
        sub: '一部电脑就能操作'
      },
      {
        id: 4,
        style: '薄利多销型',
        title: '一次远程赚十块',
        highlight: '四千想要两万浏览',
        sub: '极客刚需持续出单'
      },
      {
        id: 5,
        style: '一手渠道型',
        title: '闲鱼Codex安装',
        highlight: '一键部署安装包',
        sub: '极客变现全盘交代'
      },
      {
        id: 6,
        style: '冷门暴利型',
        title: '闷声发财小生意',
        highlight: '闲鱼Codex安装',
        sub: '很多人不知道的搞钱路子'
      },
      {
        id: 7,
        style: '全自动交付',
        title: '教程加安装包',
        highlight: '网盘自动发货',
        sub: '不占用日常上班时间'
      },
      {
        id: 8,
        style: '低门槛人群',
        title: '适合新人的副业',
        highlight: '闲鱼Codex安装',
        sub: '零基础小白直接照做'
      },
      {
        id: 9,
        style: '一期讲透型',
        title: '一期全流程通关',
        highlight: '闲鱼Codex安装',
        sub: '远程部署与定价一次讲透'
      },
      {
        id: 10,
        style: '老玩家交底',
        title: '闲鱼极客项目拆解',
        highlight: 'Codex远程安装',
        sub: '学闲鱼找圣矾'
      }
    ]
  },
  '网盘拉新': {
    skin: 'pixel-arcade',
    options: [
      {
        id: 1,
        style: '收益爆点型',
        title: '闲鱼网盘拉新项目',
        highlight: '一单返利9块钱',
        sub: '正规平台返利拆解'
      },
      {
        id: 2,
        style: '零本实操型',
        title: '闲鱼资源转存拉新',
        highlight: '零成本自动出单',
        sub: '一手服务商渠道交底'
      },
      {
        id: 3,
        style: '极简承诺型',
        title: '闲鱼网盘拉新项目',
        highlight: '七天之内必出单',
        sub: '一部手机就能操作'
      },
      {
        id: 4,
        style: '薄利多销型',
        title: '一个转存赚九块',
        highlight: '秒出单靠走量',
        sub: '官方结算月入稳定'
      },
      {
        id: 5,
        style: '一手渠道型',
        title: '闲鱼网盘拉新',
        highlight: '一手服务商授权渠道',
        sub: '返利逻辑全盘交代'
      },
      {
        id: 6,
        style: '冷门暴利型',
        title: '闷声发财小生意',
        highlight: '闲鱼网盘拉新',
        sub: '很多人不知道的搞钱路子'
      },
      {
        id: 7,
        style: '全自动交付',
        title: '搭建自动化系统',
        highlight: '资源转存自动发货',
        sub: '不占用日常上班时间'
      },
      {
        id: 8,
        style: '低门槛人群',
        title: '适合新人的副业',
        highlight: '闲鱼网盘拉新',
        sub: '零基础小白直接照做'
      },
      {
        id: 9,
        style: '一期讲透型',
        title: '一期全流程通关',
        highlight: '闲鱼网盘拉新',
        sub: '合规渠道与引流一次讲透'
      },
      {
        id: 10,
        style: '老玩家交底',
        title: '闲鱼虚拟项目拆解',
        highlight: '网盘转存拉新',
        sub: '学闲鱼找圣矾'
      }
    ]
  }
};

for (const [topic, item] of Object.entries(coversData)) {
  const fileName = `20261012-${topic}-${item.skin}-h.meta.json`;
  const nasPath = path.join(NAS_BASE, topic, fileName);
  const localPath = path.join(LOCAL_BASE, `20261012-${topic}`, fileName);

  const formattedOptions = item.options.map((opt) => ({
    ...opt,
    preview: `${opt.title} | ${opt.highlight} | ${opt.sub}`
  }));

  const confirmed = {
    confirmed: false,
    updatedAt: new Date().toISOString(),
    style: formattedOptions[0].style,
    title: formattedOptions[0].title,
    highlight: formattedOptions[0].highlight,
    sub: formattedOptions[0].sub
  };

  for (const targetPath of [nasPath, localPath]) {
    if (fs.existsSync(targetPath)) {
      const meta = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      meta.coverOptions = formattedOptions;
      meta.coverConfirmed = confirmed;
      fs.writeFileSync(targetPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      console.log(`Updated coverOptions in: ${targetPath}`);
    } else {
      console.warn(`File not found: ${targetPath}`);
    }
  }
}
console.log('Finished updating 20261012 horizontal meta files.');
