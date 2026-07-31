/**
 * Shared vocabulary — actions, status, navigation.
 *
 * TO EDIT A TRANSLATION: change the `zh` value. Nothing else needs touching;
 * pages reference these by key, so wording changes take effect everywhere the
 * key is used.
 *
 * `en` is also the fallback: if a `zh` value is empty the English shows rather
 * than a raw key, so a partly-translated catalog degrades to readable.
 */

export const common = {
  // ── Actions ──────────────────────────────────────────────
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
  'action.search': { en: 'Search', zh: '搜索' },
  'action.add': { en: 'Add', zh: '添加' },
  'action.remove': { en: 'Remove', zh: '移除' },
  'action.view': { en: 'View', zh: '查看' },
  'action.done': { en: 'Done', zh: '完成' },

  // ── Status ───────────────────────────────────────────────
  'status.loading': { en: 'Loading…', zh: '加载中…' },
  'status.saving': { en: 'Saving…', zh: '保存中…' },
  'status.saved': { en: 'Saved', zh: '已保存' },
  'status.empty': { en: 'Nothing here yet', zh: '暂无内容' },
  'status.error': { en: 'Something went wrong', zh: '出现错误' },
  'status.required': { en: 'Required', zh: '必填' },
  'status.optional': { en: 'Optional', zh: '可选' },

  // ── Navigation ───────────────────────────────────────────
  'nav.dashboard': { en: 'Dashboard', zh: '主页' },
  'nav.challenges': { en: 'Challenges', zh: '挑战题' },
  'nav.classes': { en: 'Classes', zh: '班级' },
  'nav.shop': { en: 'Shop', zh: '商店' },
  'nav.decorations': { en: 'Decorations', zh: '装饰' },
  'nav.bubbleRoom': { en: 'Bubble Room', zh: '泡泡问答室' },
  'nav.settings': { en: 'Settings', zh: '设置' },
  'nav.signOut': { en: 'Sign out', zh: '退出登录' },
  'nav.language': { en: 'Language', zh: '语言' },
  'nav.students': { en: 'Students', zh: '学生' },
  'nav.grading': { en: 'Grading', zh: '批改' },
} as const
