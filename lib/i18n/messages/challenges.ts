/**
 * Challenge list, challenge detail, and the book/room reading experience.
 *
 * NOT here, and never will be: the problem wording itself. Challenge problems
 * carry their own English and Chinese in the .henryproblem snapshot, and tag
 * names have per-language rows in challenge_tag_names.
 */

export const challenges = {
  'challenge.yourSolution': { en: 'Your Solution', zh: '您的解答' },
  'challenge.editSolution': { en: 'Edit Your Solution', zh: '修改您的解答' },
  'challenge.solutionPlaceholder': {
    en: 'Write your solution here... Show your work!',
    zh: '在这里写下您的解答……请写出解题过程！',
  },
  'challenge.attachImage': { en: '📷 Attach Image (Optional)', zh: '📷 添加图片（可选）' },
  'challenge.submitSolution': { en: 'Submit Solution', zh: '提交解答' },
  'challenge.resubmit': { en: 'Resubmit', zh: '重新提交' },
  'challenge.hint': { en: 'Hint', zh: '提示' },
  'challenge.noHint': { en: 'No hint added yet', zh: '暂无提示' },
  'challenge.addHint': { en: 'Add Hint', zh: '添加提示' },
  'challenge.title': { en: 'Title', zh: '标题' },
  'challenge.score': { en: 'Score', zh: '分数' },
  'challenge.tags': { en: 'Tags', zh: '标签' },
  'challenge.points': { en: 'pts', zh: '分' },
  'challenge.submitted': { en: 'Submitted', zh: '已提交' },
  'challenge.notSubmitted': { en: 'Not submitted', zh: '未提交' },
  'challenge.dueDate': { en: 'Due', zh: '截止' },
  'challenge.othersSolutions': { en: "Others' Solutions", zh: '其他同学的解答' },
  'challenge.comments': { en: 'Comments', zh: '评论' },
  'challenge.addComment': { en: 'Add a comment…', zh: '添加评论……' },
  'challenge.enlargeImage': { en: 'Click image to enlarge', zh: '点击图片放大' },
  'challenge.tapToEnlarge': { en: 'Tap the problem to enlarge', zh: '点击题目放大' },
  'challenge.noChallenges': { en: 'No challenges yet', zh: '暂无挑战题' },
  'challenge.loading': { en: 'Loading challenge…', zh: '挑战题加载中…' },

  // ── List page: search, filters, sort ─────────────────────
  'challenge.loadingList': { en: 'Loading challenges...', zh: '挑战题加载中…' },
  'challenge.searchPlaceholder': {
    en: 'Search by title or description...',
    zh: '按标题或描述搜索……',
  },
  'challenge.searchWithTag': {
    en: 'Search by title, description or tag…',
    zh: '按标题、描述或标签搜索……',
  },
  'challenge.allClasses': { en: 'All Classes', zh: '全部班级' },
  'challenge.allDates': { en: 'All Dates', zh: '全部日期' },
  'challenge.today': { en: 'Today', zh: '今天' },
  'challenge.thisWeek': { en: 'This Week', zh: '本周' },
  'challenge.upcoming': { en: 'Upcoming', zh: '即将开始' },
  'challenge.past': { en: 'Past', zh: '已过期' },
  'challenge.tagsLabel': { en: 'Tags:', zh: '标签：' },
  'challenge.mostSubmissions': { en: 'Most Submissions', zh: '提交最多' },
  'challenge.leastSubmissions': { en: 'Least Submissions', zh: '提交最少' },
  'challenge.highestCompletion': { en: 'Highest Completion', zh: '完成率最高' },
  'challenge.lowestCompletion': { en: 'Lowest Completion', zh: '完成率最低' },
  'challenge.noneFound': { en: 'No challenges found', zh: '未找到挑战题' },

  // ── Teacher stats ────────────────────────────────────────
  'challenge.totalPoints': { en: 'Total Points', zh: '总分' },
  'challenge.graded': { en: 'Graded', zh: '已批改' },
  'challenge.pendingGrade': { en: 'Pending Grade', zh: '待批改' },
  'challenge.notSubmittedStat': { en: 'Not Submitted', zh: '未提交' },
  'challenge.scoreRate': { en: 'Score rate', zh: '得分率' },
  'challenge.assignFromBank': { en: 'Assign from Challenge Bank', zh: '从题库分配' },
  'challenge.selectedChallenge': { en: 'Selected challenge', zh: '已选挑战题' },

  // ── Detail page ──────────────────────────────────────────
  'challenge.loadingDetail': { en: 'Loading challenge...', zh: '挑战题加载中…' },
  // The preload screen. "Getting your book ready" rather than "Loading",
  // because the wait is a real one — the book model alone is 2.63 MiB — and
  // naming what is happening beats a spinner that says nothing.
  'challenge.preparingRoom': { en: 'Getting your book ready…', zh: '正在准备您的书本…' },
  'challenge.preparingPct': { en: '{pct}%', zh: '{pct}%' },
  'challenge.loadingBook': { en: 'Loading book…', zh: '书本加载中…' },
  'challenge.label': { en: 'Challenge', zh: '挑战题' },
  'challenge.copy': { en: 'Copy', zh: '复制' },
  'challenge.saveAsTemplate': { en: 'Save as Template', zh: '保存为模板' },
  'challenge.greatJob': { en: 'Great job!', zh: '做得好！' },
  'challenge.canSeeOthers': {
    en: 'You can now see what others wrote',
    zh: '现在您可以看到其他同学的解答了',
  },
  'challenge.hintPlaceholder': {
    en: 'Add a hint for students...',
    zh: '为学生添加提示……',
  },
  'challenge.studentStatus': { en: 'Student Status', zh: '学生完成情况' },
  'challenge.gap': { en: 'Gap: ', zh: '差距：' },

  // TA grading review — teacher-facing
  'challenge.taWasCorrect': { en: 'TA was correct actually', zh: '助教其实是对的' },
  'challenge.wrongRule': { en: 'Wrong grading rule applied', zh: '套用了错误的评分规则' },
  'challenge.taMisunderstood': { en: 'TA misunderstood the math', zh: '助教理解错了数学内容' },
  'challenge.wrongCommentStyle': { en: 'Wrong comment style', zh: '评语风格不合适' },

  // Book / room reading experience
  'book.openTheBook': { en: 'Open the book', zh: '打开书本' },
  'book.clickToRead': { en: 'Click to read and answer', zh: '点击阅读并作答' },
  'book.backToRoom': { en: 'Back to the room', zh: '返回房间' },
  'book.loadingBook': { en: 'Loading book…', zh: '书本加载中…' },
  'book.modelFailed': {
    en: 'The book model could not be loaded. Check the model URL.',
    zh: '无法加载书本模型，请检查模型链接。',
  },
} as const
