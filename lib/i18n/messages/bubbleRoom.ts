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
    zh: '来提出第一个问题吧，您的泡泡会飘起来让大家看到。',
  },
  'bubble.askFirst': { en: 'Ask the First Question', zh: '提出第一个问题' },
  'bubble.reply': { en: 'Reply', zh: '回复' },
  'bubble.responses': { en: 'responses', zh: '条回复' },
  'bubble.response': { en: 'response', zh: '条回复' },
  'bubble.writeResponse': { en: 'Write a response…', zh: '写下您的回复……' },
  'bubble.noResponses': {
    en: 'No responses yet. Be the first to reply!',
    zh: '还没有回复，来做第一个回复的人吧！',
  },
  'bubble.titleLabel': { en: 'Title', zh: '标题' },
  'bubble.titlePlaceholder': {
    en: 'Give your question a short title…',
    zh: '给您的问题起一个简短的标题……',
  },
  'bubble.details': { en: 'Details', zh: '详细说明' },
  'bubble.detailsPlaceholder': {
    en: 'Describe your question in detail…',
    zh: '详细描述您的问题……',
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
  'bubble.posting': { en: 'Posting your question…', zh: '正在发布您的问题…' },
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
  'bubble.assignedTitle': { en: 'Assigned to You', zh: '指派给您的问题' },
  'bubble.assignedCounts': {
    en: '{pending} pending · {responded} responded',
    zh: '{pending} 个待回复 · {responded} 个已回复',
  },
  'bubble.refresh': { en: 'Refresh', zh: '刷新' },
  'bubble.noneAssigned': {
    en: 'No questions assigned to you yet',
    zh: '还没有指派给您的问题',
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

  // ── Room top bar and TA badge ────────────────────────────
  'bubble.applyTaTitle': { en: 'Apply to be a Bubble Room TA', zh: '申请成为泡泡问答室助教' },
  'bubble.applyTa': { en: 'Apply TA', zh: '申请助教' },
  'bubble.taStatusTitle': { en: 'View your TA application status', zh: '查看您的助教申请状态' },
  'bubble.taPending': { en: 'Pending…', zh: '审核中…' },
  'bubble.reviewTaTitle': { en: 'Review TA Applications', zh: '审核助教申请' },
  'bubble.taApps': { en: 'TA Apps', zh: '助教申请' },
  'bubble.assignedTitleAttr': { en: 'Questions assigned to you', zh: '指派给您的问题' },
  'bubble.assigned': { en: 'Assigned', zh: '指派' },
  'bubble.loadingAuthor': { en: 'Loading…', zh: '加载中…' },

  // ── Search results ───────────────────────────────────────
  'bubble.noResultsFor': {
    en: 'No questions found for “{query}”',
    zh: '没有找到与“{query}”相关的问题',
  },
  'bubble.askAbout': { en: 'Ask about “{query}”', zh: '提问“{query}”' },

  // ── Composition form ─────────────────────────────────────
  'bubble.postAQuestion': { en: 'Post a question', zh: '发布问题' },
  'bubble.attachImage': { en: 'Attach image', zh: '添加图片' },
  'bubble.removeImage': { en: 'Remove image', zh: '移除图片' },
  'bubble.errImageType': {
    en: 'Only JPEG, PNG, GIF, or WebP images are allowed.',
    zh: '只支持 JPEG、PNG、GIF 或 WebP 格式的图片。',
  },
  'bubble.errImageSize': { en: 'Image must be 10 MB or smaller.', zh: '图片不能超过 10 MB。' },
  'bubble.errNoTitle': {
    en: 'Please enter a title for your question.',
    zh: '请为您的问题填写标题。',
  },
  'bubble.errNoText': {
    en: 'Please enter your question before submitting.',
    zh: '请先写下您的问题再提交。',
  },
  'bubble.errTextTooLong': {
    en: 'Question must be {max} characters or fewer.',
    zh: '问题不能超过 {max} 个字符。',
  },
  'bubble.errTitleTooLong': {
    en: 'Title must be 120 characters or fewer.',
    zh: '标题不能超过 120 个字符。',
  },

  // ── Search bar ───────────────────────────────────────────
  'bubble.searchPlaceholder': { en: 'Search questions…', zh: '搜索问题……' },
  'bubble.clearSearch': { en: 'Clear search', zh: '清除搜索' },
  'bubble.suggestions': { en: 'Question suggestions', zh: '问题建议' },
  'bubble.showMore': { en: 'Show more', zh: '显示更多' },

  // ── Question detail ──────────────────────────────────────
  'bubble.openChallenge': { en: 'Open full challenge in new tab', zh: '在新标签页打开完整挑战题' },
  'bubble.viewQuestionImage': { en: 'View full question image', zh: '查看问题原图' },
  'bubble.viewResponseImage': { en: 'View full response image', zh: '查看回复原图' },
  'bubble.loadingResponses': { en: 'Loading responses', zh: '正在加载回复' },
  'bubble.postAResponse': { en: 'Post a response', zh: '发布回复' },
  'bubble.attachResponseImage': { en: 'Attach image to response', zh: '为回复添加图片' },

  // Shown in place of the reply box to a student without the TA badge.
  'bubble.answersAreForTAs': {
    en: 'Only TAs and teachers can answer here.',
    zh: '只有助教和老师才能在这里回答。',
  },
  'bubble.answersAreForTAsHint': {
    en: 'Want to help? Apply for the TA badge.',
    zh: '想帮助大家？欢迎申请成为助教。',
  },
  'bubble.deleteThisQuestion': { en: 'Delete this question', zh: '删除这个问题' },
  'bubble.deleting': { en: 'Deleting…', zh: '正在删除…' },
  'bubble.errResponseEmpty': { en: 'Response cannot be empty.', zh: '回复内容不能为空。' },
  'bubble.errPostResponse': {
    en: 'Failed to post your response. Please try again.',
    zh: '回复发布失败，请重试。',
  },
  'bubble.errDelete': { en: 'Failed to delete. Please try again.', zh: '删除失败，请重试。' },

  // ── TA application ───────────────────────────────────────
  'bubble.taBlurb': {
    en: 'Bubble Room TAs help other students by answering questions. Your application will be reviewed by a teacher.',
    zh: '泡泡问答室助教通过回答问题来帮助其他同学。您的申请将由老师审核。',
  },
  'bubble.taPitchPlaceholder': {
    en: "Tell the teacher a bit about yourself and why you'd make a good TA…",
    zh: '简单介绍一下您自己，以及您为什么适合当助教……',
  },
  'bubble.taSubmitApplication': { en: 'Submit Application', zh: '提交申请' },

  // What the role actually asks of you, shown before the pitch box so an
  // applicant knows what they are volunteering for.
  'bubble.taGoodMeans': {
    en: 'Being a good TA means…',
    zh: '成为一名优秀的助教意味着……',
  },
  'bubble.taGood1': {
    en: "Understand what the person's question is",
    zh: '理解对方的问题是什么',
  },
  'bubble.taGood2': {
    en: 'Think about what is the best way to guide the person to the answer',
    zh: '思考引导对方找到答案的最佳方式',
  },
  'bubble.taGood3': {
    en: 'Explain in a clear and helpful way',
    zh: '以清晰且有帮助的方式进行讲解',
  },
  'bubble.taWhyLabel': {
    en: 'Why do you want to be a TA?',
    zh: '您为什么想成为助教？',
  },
  'bubble.taWaiting': {
    en: 'Waiting for a teacher to review your application.',
    zh: '正在等待老师审核您的申请。',
  },
  'bubble.taYourPitch': { en: 'Your pitch', zh: '您的自荐' },
  'bubble.taNoPitch': { en: 'No pitch submitted.', zh: '没有提交自荐内容。' },
  'bubble.animationArea': { en: 'Bubble animation area', zh: '泡泡动画区域' },

  // ── My Bubbles panel ─────────────────────────────────────
  'myBubbles.mine': { en: 'My Bubbles', zh: '我的泡泡' },
  'myBubbles.tabActive': { en: 'Active ({count})', zh: '进行中（{count}）' },
  'myBubbles.tabExpired': { en: 'Expired ({count})', zh: '已过期（{count}）' },
  'myBubbles.noneActive': { en: 'No active bubbles.', zh: '没有进行中的泡泡。' },
  'myBubbles.noneExpired': { en: 'No expired bubbles.', zh: '没有已过期的泡泡。' },
  'myBubbles.expiresIn': { en: 'Expires in {days}d', zh: '{days} 天后过期' },
  'myBubbles.expire': { en: 'Expire', zh: '结束' },
  'myBubbles.revive': { en: 'Revive', zh: '重新开启' },
  'myBubbles.deletePermanently': { en: 'Delete permanently', zh: '永久删除' },
  'myBubbles.tabCompleted': { en: 'Completed ({count})', zh: '已解决（{count}）' },
  'myBubbles.noneCompleted': { en: 'No completed bubbles.', zh: '还没有已解决的泡泡。' },

  // ── Resolving a question ─────────────────────────────────
  //
  // One key, not a label plus a dropdown glued together: Chinese puts the
  // thanks before the name with no space, English needs 'to ' and a gap.
  'thanks.button': {
    en: 'I understand now! I want to give thanks to ….',
    zh: '我懂了! 我想感谢 ….',
  },
  'thanks.pickSomeone': { en: 'Choose someone', zh: '选择一位' },
  'thanks.staffNote': { en: '(teacher — no TA point)', zh: '（老师——不计助教积分）' },
  'thanks.resolved': { en: 'Resolved', zh: '已解决' },
  'thanks.thanking': { en: 'Thanking…', zh: '正在感谢…' },
  'thanks.errFailed': { en: 'Could not do that. Please try again.', zh: '操作失败，请重试。' },
  'thanks.errAlready': { en: 'This question is already resolved.', zh: '这个问题已经解决了。' },
} as const
