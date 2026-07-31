/**
 * UI string catalog: English and Simplified Chinese.
 *
 * Covers the app's OWN words. Author-written content is deliberately absent and
 * cannot live here — class names, challenge titles, hints, comments and shop
 * item names are free text in the database. Challenge problems already carry
 * both languages in their .henryproblem snapshot, and tag names have their own
 * per-language rows in challenge_tag_names.
 *
 * Keys are dotted and grouped by area. English doubles as the fallback: a
 * missing zh entry renders the English rather than a key, so a half-translated
 * catalog degrades to readable rather than broken.
 */

export type Language = 'en' | 'zh'

export const LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'zh', label: '简体中文', short: 'CN' },
]

/**
 * The catalog is keyed by English first so a translator can see both strings
 * side by side, and so an untranslated key is obvious in review.
 */
export const catalog = {
  // ── Generic actions ──────────────────────────────────────
  'action.save': { en: 'Save', zh: '保存' },
  'action.cancel': { en: 'Cancel', zh: '取消' },
  'action.delete': { en: 'Delete', zh: '删除' },
  'action.edit': { en: 'Edit', zh: '编辑' },
  'action.close': { en: 'Close', zh: '关闭' },
  'action.back': { en: 'Back', zh: '返回' },
  'action.submit': { en: 'Submit', zh: '提交' },
  'action.confirm': { en: 'Confirm', zh: '确认' },
  'action.retry': { en: 'Try again', zh: '重试' },
  'action.upload': { en: 'Upload', zh: '上传' },
  'action.generate': { en: 'Generate', zh: '生成' },
  'action.select': { en: 'Select', zh: '选择' },

  // ── Status ───────────────────────────────────────────────
  'status.loading': { en: 'Loading…', zh: '加载中…' },
  'status.saving': { en: 'Saving…', zh: '保存中…' },
  'status.saved': { en: 'Saved', zh: '已保存' },
  'status.empty': { en: 'Nothing here yet', zh: '暂无内容' },
  'status.error': { en: 'Something went wrong', zh: '出现错误' },

  // ── Navigation / shell ───────────────────────────────────
  'nav.dashboard': { en: 'Dashboard', zh: '主页' },
  'nav.challenges': { en: 'Challenges', zh: '挑战题' },
  'nav.classes': { en: 'Classes', zh: '班级' },
  'nav.shop': { en: 'Shop', zh: '商店' },
  'nav.decorations': { en: 'Decorations', zh: '装饰' },
  'nav.bubbleRoom': { en: 'Bubble Room', zh: '泡泡问答室' },
  'nav.settings': { en: 'Settings', zh: '设置' },
  'nav.signOut': { en: 'Sign out', zh: '退出登录' },
  'nav.language': { en: 'Language', zh: '语言' },

  // ── Challenge page ───────────────────────────────────────
  'challenge.yourSolution': { en: 'Your Solution', zh: '你的解答' },
  'challenge.editSolution': { en: 'Edit Your Solution', zh: '修改你的解答' },
  'challenge.solutionPlaceholder': {
    en: 'Write your solution here... Show your work!',
    zh: '在这里写下你的解答……请写出解题过程！',
  },
  'challenge.attachImage': { en: '📷 Attach Image (Optional)', zh: '📷 添加图片（可选）' },
  'challenge.submitSolution': { en: 'Submit Solution', zh: '提交解答' },
  'challenge.hint': { en: 'Hint', zh: '提示' },
  'challenge.noHint': { en: 'No hint added yet', zh: '暂无提示' },
  'challenge.addHint': { en: 'Add Hint', zh: '添加提示' },
  'challenge.title': { en: 'Title', zh: '标题' },
  'challenge.score': { en: 'Score', zh: '分数' },
  'challenge.tags': { en: 'Tags', zh: '标签' },
  'challenge.points': { en: 'pts', zh: '分' },

  // ── Book / decorations ───────────────────────────────────
  'book.openTheBook': { en: 'Open the book', zh: '打开书本' },
  'book.clickToRead': { en: 'Click to read and answer', zh: '点击阅读并作答' },
  'book.backToRoom': { en: 'Back to the room', zh: '返回房间' },
  'decor.bookCoverPage': { en: 'Book Cover & Page', zh: '书封面与内页' },
  'decor.challengeRoom': { en: 'Challenge Room', zh: '挑战房间' },
  'decor.petRoom': { en: 'Pet Room', zh: '宠物房间' },
  'decor.adminTools': { en: 'Admin Tools', zh: '管理工具' },
  'decor.noChallengeRoom': { en: 'NoChallengeRoom', zh: '不使用挑战房间' },
  'decor.setDefault': { en: 'Set default', zh: '设为默认' },
  'decor.isDefault': { en: 'Is Default', zh: '当前默认' },
  'decor.makePublic': { en: 'Make public', zh: '设为公开' },
  'decor.makePrivate': { en: 'Make private', zh: '设为私有' },
  'decor.activate': { en: 'Activate', zh: '启用' },
  'decor.deactivate': { en: 'Deactivate', zh: '停用' },
  'decor.sellInShop': { en: 'Sell in shop', zh: '上架商店' },
  'decor.inShop': { en: 'In shop', zh: '已上架' },
  'decor.public': { en: 'Public', zh: '公开' },
  'decor.adminOnly': { en: 'Admin only', zh: '仅管理员' },
  'decor.inactive': { en: 'Inactive', zh: '已停用' },
  'decor.active': { en: 'Active', zh: '使用中' },
  'decor.priceInPoints': { en: 'Price in points', zh: '价格（积分）' },

  // ── Dashboard ────────────────────────────────────────────
  'dash.mathClass': { en: 'Math Class', zh: '数学课堂' },
  'dash.totalScore': { en: 'Total Score', zh: '总积分' },
  'dash.shopBalance': { en: 'Shop Balance', zh: '商店余额' },
  'dash.explore': { en: 'Explore', zh: '浏览' },
  'dash.manage': { en: 'Manage', zh: '管理' },
  'dash.userRoles': { en: 'User Roles', zh: '用户角色' },
  'dash.tags': { en: 'Tags', zh: '标签' },
  'dash.scheduler': { en: 'Scheduler', zh: '排课' },
  'dash.challengeBank': { en: 'Challenge Bank', zh: '题库' },
  'dash.students': { en: 'Students', zh: '学生' },
  'dash.history': { en: 'History', zh: '记录' },
  'dash.grade': { en: 'Grade', zh: '批改' },
  'dash.homework': { en: 'Homework', zh: '作业' },
  'dash.joinRequests': {
    en: 'Students are waiting to join your classes',
    zh: '有学生正在等待加入你的班级',
  },

  // ── Bubble room ──────────────────────────────────────────
  'bubble.askQuestion': { en: 'Ask a Question', zh: '提问' },
  'bubble.ask': { en: 'Ask', zh: '提问' },
  'bubble.search': { en: 'Search questions', zh: '搜索问题' },
  'bubble.noQuestions': { en: 'No questions yet!', zh: '还没有问题！' },
  'bubble.reply': { en: 'Reply', zh: '回复' },
  'bubble.responses': { en: 'responses', zh: '条回复' },
  'bubble.writeResponse': { en: 'Write a response…', zh: '写下你的回复……' },
} as const

export type TranslationKey = keyof typeof catalog

/** Resolve a key, falling back to English, then to the key itself. */
export function translate(key: TranslationKey, language: Language): string {
  const entry = catalog[key] as { en: string; zh: string } | undefined
  if (!entry) {
    // A missing key is a bug, but shouting the key at a student is worse than
    // showing nothing useful — surface it in dev only.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[i18n] missing catalog key: ${key}`)
    }
    return key
  }
  return entry[language] || entry.en
}
