/**
 * Bubble Room Q&A.
 *
 * Question and answer text is written by students and stays as typed — only
 * the surrounding chrome is translated.
 */

export const bubbleRoom = {
  'bubble.title': { en: 'Bubble Room', zh: '泡泡问答室' },
  'bubble.askQuestion': { en: 'Ask a Question', zh: '提问' },
  'bubble.ask': { en: 'Ask', zh: '提问' },
  'bubble.search': { en: 'Search questions', zh: '搜索问题' },
  'bubble.noQuestions': { en: 'No questions yet!', zh: '还没有问题！' },
  'bubble.beFirst': {
    en: 'Be the first to ask a question. Your bubble will float up for everyone to see.',
    zh: '来提出第一个问题吧，你的泡泡会飘起来让大家看到。',
  },
  'bubble.askFirst': { en: 'Ask the First Question', zh: '提出第一个问题' },
  'bubble.reply': { en: 'Reply', zh: '回复' },
  'bubble.responses': { en: 'responses', zh: '条回复' },
  'bubble.response': { en: 'response', zh: '条回复' },
  'bubble.writeResponse': { en: 'Write a response…', zh: '写下你的回复……' },
  'bubble.noResponses': {
    en: 'No responses yet. Be the first to reply!',
    zh: '还没有回复，来做第一个回复的人吧！',
  },
  'bubble.titleLabel': { en: 'Title', zh: '标题' },
  'bubble.titlePlaceholder': {
    en: 'Give your question a short title…',
    zh: '给你的问题起一个简短的标题……',
  },
  'bubble.details': { en: 'Details', zh: '详细说明' },
  'bubble.detailsPlaceholder': {
    en: 'Describe your question in detail…',
    zh: '详细描述你的问题……',
  },
  'bubble.postQuestion': { en: 'Post Question', zh: '发布问题' },
  'bubble.deleteQuestion': { en: 'Delete Question', zh: '删除问题' },
  'bubble.confirmDeleteQuestion': {
    en: 'Delete this question and all its responses?',
    zh: '确定删除这个问题及其全部回复吗？',
  },
  'bubble.yesDelete': { en: 'Yes, delete', zh: '确定删除' },
  'bubble.duplicateTitle': {
    en: 'Similar question already exists',
    zh: '已有相似的问题',
  },
  'bubble.postAnyway': { en: 'Yes, post anyway', zh: '仍然发布' },
  'bubble.goBack': { en: 'No, go back', zh: '返回修改' },
  'bubble.posting': { en: 'Posting your question…', zh: '正在发布你的问题…' },
  'bubble.similar': { en: 'similar', zh: '相似' },
  'bubble.noResults': { en: 'No questions found for', zh: '没有找到相关问题：' },
  'bubble.challenge': { en: 'Challenge', zh: '挑战题' },
  'bubble.linkedToChallenge': { en: 'Linked to current challenge', zh: '已关联当前挑战题' },

  // ── Duplicate warning ────────────────────────────────────
  'bubble.duplicateIntroOne': {
    en: 'Before posting, take a look at this similar question. It might already have the answer you need!',
    zh: '发布前先看看这个相似的问题吧，答案可能已经在里面了！',
  },
  'bubble.duplicateIntroMany': {
    en: 'Before posting, take a look at these similar questions. They might already have the answer you need!',
    zh: '发布前先看看这些相似的问题吧，答案可能已经在里面了！',
  },
  'bubble.byAuthor': { en: 'by {name}', zh: '由 {name} 提问' },
  'bubble.percentSimilar': { en: '{percent}% similar', zh: '相似度 {percent}%' },

  // ── Assigned tray ────────────────────────────────────────
  'bubble.assignedTitle': { en: 'Assigned to You', zh: '指派给你的问题' },
  'bubble.assignedCounts': {
    en: '{pending} pending · {responded} responded',
    zh: '{pending} 个待回复 · {responded} 个已回复',
  },
  'bubble.refresh': { en: 'Refresh', zh: '刷新' },
  'bubble.noneAssigned': {
    en: 'No questions assigned to you yet',
    zh: '还没有指派给你的问题',
  },
  'bubble.allCaughtUp': {
    en: 'All caught up — no pending questions',
    zh: '全部完成——没有待回复的问题',
  },
  'bubble.respondedCount': { en: 'Responded ({count})', zh: '已回复（{count}）' },
  'bubble.hide': { en: 'hide', zh: '收起' },
  'bubble.show': { en: 'show', zh: '展开' },
  'bubble.pendingBadge': { en: 'Pending', zh: '待回复' },
  'bubble.doneBadge': { en: 'Done', zh: '已完成' },
  'bubble.byAuthorOn': { en: 'by {name} · {date}', zh: '{name} · {date}' },
} as const
