/**
 * The "New Feature" announcement button and its panel.
 *
 * The announcement TEXT is written by Henry and is not in this file — it is
 * database content, translated on demand like a bubble room post. Only the
 * chrome around it lives here.
 */

export const announcement = {
  'announce.button': { en: 'New Feature', zh: '新功能' },
  'announce.title': { en: "What's New", zh: '新功能介绍' },
  'announce.open': { en: 'See what is new', zh: '查看新功能' },
  'announce.none': { en: 'Nothing new right now.', zh: '暂时没有新功能。' },

  // ── Admin editing ────────────────────────────────────────
  'announce.editPlaceholder': {
    en: 'Describe what is new. Students see this the next time they open a page.',
    zh: '描述新增了什么。学生下次打开页面时就会看到。',
  },
  'announce.saving': { en: 'Saving…', zh: '正在保存…' },
  'announce.deleting': { en: 'Deleting…', zh: '正在删除…' },
  'announce.confirmDelete': {
    en: 'Delete this announcement?',
    zh: '要删除这条公告吗？',
  },
  'announce.errEmpty': {
    en: 'Write something first, or press Delete to remove the announcement.',
    zh: '请先写点内容，或点击删除来移除公告。',
  },
  'announce.errSave': { en: 'Could not save. Please try again.', zh: '保存失败，请重试。' },
  'announce.errPermission': {
    en: 'Only teachers and administrators can change this.',
    zh: '只有老师和管理员可以修改。',
  },

  /**
   * Shown when Save was pressed with the text unchanged. Not an error — the
   * announcement genuinely did not change, and saying so is better than a
   * "Saved!" that did nothing, which would leave you unsure whether students
   * had just been notified again.
   */
  'announce.unchanged': { en: 'No changes to save.', zh: '没有需要保存的修改。' },
} as const
