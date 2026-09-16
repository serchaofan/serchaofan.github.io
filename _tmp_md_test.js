const { marked } = require('marked');
const cases = {
  A_current:
    '# 第1章 助词与格关系\n>\n> 助词是句子的骨架。掌握は・が・を・に・で・へ等的核心区别，是读懂排序题和填空题的基础。\n---\n\n## 1.1 は（主题助词）\n\n文字\n',
  B_fixed:
    '# 第1章 助词与格关系\n\n> 助词是句子的骨架。掌握は・が・を・に・で・へ等的核心区别，是读懂排序题和填空题的基础。\n\n---\n\n## 1.1 は（主题助词）\n\n文字\n'
};
for (const k of Object.keys(cases)) {
  console.log('==== ' + k + ' ====');
  console.log(marked(cases[k]));
  console.log();
}
