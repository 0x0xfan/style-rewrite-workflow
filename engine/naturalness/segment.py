#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""共用分词后端：词表构建与用词检查复用同一口径。

口径与 ips/<IP>/corpus/lexicon.json 的 tokenizer 字段一致：
  jieba-0.42.1 posseg，只保留 n/v/a 词性、去单字、去纯数字、去停用词。

用法：
  正文从 stdin 读入（UTF-8），逐行输出「词<TAB>词性」到 stdout（UTF-8）。
  jieba 的构建日志走 stderr，不污染 stdout；故上层只需读 stdout。
  退出码：正常 0；jieba 不可用等异常 1（上层据此回退 MFM）。

刻意用 sys.stdin.buffer / sys.stdout.buffer 走裸 UTF-8，绕开 Windows 控制台
默认 cp936 编码，保证中文往返不乱码。
"""
import sys


# 常见虚词/填充词：jieba 会把其中一部分误标成 n/v/a（如"是/有/会"标 v），
# 词表构建时按同一口径滤除，检查侧必须同口径滤除，否则它们会当"陌生词"刷屏。
# 只收功能性/极高频词，不收任何承载业务或风格含义的实词。
STOPWORDS = set("""
的 了 着 过 吗 呢 吧 啊 呀 呗 嘛 哈 哦 噢 咯 啦 么 呐 嗯 唉
是 有 会 要 能 得 该 没 不 也 就 都 还 又 才 再 越 更 最 太 真 挺 蛮 特
这 那 哪 这个 那个 哪个 这样 那样 怎样 这些 那些 这里 那里 这么 那么 怎么 什么 为什么
我 你 他 她 它 我们 你们 他们 她们 它们 咱 咱们 大家 自己 别人 人家 谁
和 跟 与 及 或 或者 而 而且 但 但是 可 可是 不过 然后 于是 因为 所以 因此 如果 要是 虽然 尽管
在 从 把 被 让 叫 用 对 向 往 给 为 于 到 由 按 照 除了 关于 至于
的话 一样 一直 一定 一下 一点 一些 一般 一起 已经 曾经 正在 马上 立刻 刚刚 刚 快
非常 十分 相当 比较 稍微 有点 有些 几乎 差不多 多少 大概 也许 可能 应该 必须 肯定 当然
其实 反正 毕竟 究竟 到底 简直 甚至 尤其 比如 例如 譬如 总之 反之 另外 此外 而已 罢了
不是 不能 不会 不用 不要 不过 没有 没法 无法 不行 不管 不论 无论 只要 只有 除非
不了 不想 不到 不下 不成 不出 不敢 不肯 不必 不再 不太 别的 这种 那种
起来 出来 下去 上去 进去 过来 过去 起 来 去 上 下 前 后 里 外 中 内 间
可以 应当 需要 想 想要 打算 准备 觉得 认为 感觉 知道 明白 记得 发现 看到 听到
个 些 点 种 样 类 般 等 之 者 所 把 将 把 咋 咋样
""".split())


def keep(word, flag):
    """判定一个 (词, 词性) 是否进入词表 / 可疑词候选。"""
    if not word or len(word) < 2:            # 去单字（词表已去单字）
        return False
    if flag[0] not in ('n', 'v', 'a'):       # 只留名/动/形（含 nr/ns/vn/an 等子类）
        return False
    stripped = word.strip()
    if not stripped or stripped.isdigit():   # 去纯数字
        return False
    if word in STOPWORDS:                     # 去停用词
        return False
    return True


def main():
    try:
        import jieba.posseg as pseg
    except Exception as exc:  # jieba 缺失/损坏 → 非 0 退出，上层回退 MFM
        sys.stderr.write("segment.py: jieba 不可用: {}\n".format(exc))
        return 1

    data = sys.stdin.buffer.read()
    text = data.decode("utf-8", "ignore")
    out = []
    for word, flag in pseg.cut(text):
        if keep(word, flag):
            out.append(word + "\t" + flag)
    sys.stdout.buffer.write(("\n".join(out)).encode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
