/**
 * Challenge list, challenge detail, and the book/room reading experience.
 *
 * NOT here, and never will be: the problem wording itself. Challenge problems
 * carry their own English and Chinese in the .henryproblem snapshot, and tag
 * names have per-language rows in challenge_tag_names.
 */

export const challenges = {
  'challenge.yourSolution': { en: 'Your Solution', zh: '你的解答' },
  'challenge.editSolution': { en: 'Edit Your Solution', zh: '修改你的解答' },
  'challenge.solutionPlaceholder': {
    en: 'Write your solution here... Show your work!',
    zh: '在这里写下你的解答……请写出解题过程！',
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
