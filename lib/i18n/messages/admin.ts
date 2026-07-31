/**
 * Teacher and admin tooling: challenge authoring, tags, roles, scheduling,
 * book skins, room and bundle designers.
 */

export const admin = {
  'admin.title': { en: 'Admin', zh: '管理' },
  'admin.teachersOnly': {
    en: 'This page is for teachers and administrators.',
    zh: '此页面仅供老师与管理员使用。',
  },

  // ── Challenge authoring ──────────────────────────────────
  'admin.newChallenge': { en: 'New Challenge', zh: '新建挑战题' },
  'admin.editChallenge': { en: 'Edit Challenge', zh: '编辑挑战题' },
  'admin.batchImport': { en: 'Batch Import', zh: '批量导入' },
  'admin.challengeTitle': { en: 'Challenge title', zh: '挑战题标题' },
  'admin.description': { en: 'Description', zh: '题目描述' },
  'admin.maxPoints': { en: 'Max points', zh: '满分' },
  'admin.challengeDate': { en: 'Challenge date', zh: '挑战日期' },
  'admin.assignToClasses': { en: 'Assign to classes', zh: '分配给班级' },
  'admin.publish': { en: 'Publish', zh: '发布' },
  'admin.saveTemplate': { en: 'Save as template', zh: '保存为模板' },
  'admin.templates': { en: 'Templates', zh: '模板' },

  // ── Tags ─────────────────────────────────────────────────
  'admin.tags': { en: 'Tags', zh: '标签' },
  'admin.newTag': { en: 'New tag', zh: '新建标签' },
  'admin.tagNameEn': { en: 'English name', zh: '英文名称' },
  'admin.tagNameZh': { en: 'Chinese name', zh: '中文名称' },
  'admin.tagGroup': { en: 'Group', zh: '分组' },

  // ── Roles / students ─────────────────────────────────────
  'admin.userRoles': { en: 'User Roles', zh: '用户角色' },
  'admin.role': { en: 'Role', zh: '角色' },
  'admin.administrator': { en: 'Administrator', zh: '管理员' },
  'admin.searchUsers': { en: 'Search users', zh: '搜索用户' },

  // ── Scheduler ────────────────────────────────────────────
  'admin.scheduler': { en: 'Scheduler', zh: '排课' },
  'admin.schedule': { en: 'Schedule', zh: '安排' },

  // ── Book skins / rooms / bundles ─────────────────────────
  'admin.uploadBookSkins': { en: 'Upload Book Skins', zh: '上传书本皮肤' },
  'admin.skinType': { en: 'Skin Type', zh: '皮肤类型' },
  'admin.cover': { en: 'Cover', zh: '封面' },
  'admin.visibility': { en: 'Visibility', zh: '可见性' },
  'admin.name': { en: 'Name', zh: '名称' },

  'admin.roomDesigner': { en: 'ChallengeRoom', zh: '挑战房间' },
  'admin.roomDesignerSub': { en: 'Admin: 3D room designer', zh: '管理：3D 房间设计器' },
  'admin.roomDesignerDesc': {
    en: 'Generate a challenge room background with AI, then position the animated book on the table and save it.',
    zh: '用 AI 生成挑战房间背景，再把动画书本摆放到桌面上并保存。',
  },
  'admin.roomRecipe': { en: 'Room recipe', zh: '房间配方' },
  'admin.bookPlacement': { en: 'Book placement', zh: '书本摆放' },
  'admin.randomise': { en: 'Randomise', zh: '随机生成' },
  'admin.generatePlate': { en: 'Generate room plate', zh: '生成房间背景' },
  'admin.generateNewPlate': { en: 'Generate a new plate', zh: '重新生成背景' },
  'admin.refine': { en: 'Refine', zh: '微调' },
  'admin.saveRoom': { en: 'Save challenge room', zh: '保存挑战房间' },
  'admin.savedRooms': { en: 'Saved rooms', zh: '已保存的房间' },
  'admin.retune': { en: 'Retune', zh: '重新调整' },
  'admin.dragHint': {
    en: 'Drag the book to move it · scroll to scale',
    zh: '拖动书本可移动，滚动可缩放',
  },

  'admin.bundleDesigner': { en: 'Upload BookSkinBundle', zh: '上传书本组合' },
  'admin.bundleDesignerSub': {
    en: 'Admin: ChallengeRoom textures',
    zh: '管理：挑战房间贴图',
  },
  'admin.bundleDesignerDesc': {
    en: 'Design a matched cover + inner-page pair that wraps the 3D book. Only used by the ChallengeRoom — for the flat book, use Upload Book Skins.',
    zh: '设计一组配套的封面与内页，用于包裹 3D 书本。仅供挑战房间使用；平面书本请使用“上传书本皮肤”。',
  },
  'admin.bundleRecipe': { en: 'Bundle recipe', zh: '组合配方' },
  'admin.coverAndInner': { en: 'Cover & inner page', zh: '封面与内页' },
  'admin.innerPage': { en: 'Inner page', zh: '内页' },
  'admin.cornerClusters': {
    en: 'Corner clusters — cover only; the inner page stays clear of them',
    zh: '四角图案——仅用于封面，内页不包含这些图案',
  },
  'admin.topLeft': { en: 'Top left', zh: '左上' },
  'admin.topRight': { en: 'Top right', zh: '右上' },
  'admin.bottomLeft': { en: 'Bottom left', zh: '左下' },
  'admin.bottomRight': { en: 'Bottom right', zh: '右下' },
  'admin.saveBundle': { en: 'Save bundle', zh: '保存组合' },
  'admin.savedBundles': { en: 'Saved bundles', zh: '已保存的组合' },
  'admin.reopen': { en: 'Reopen', zh: '重新打开' },
  'admin.regenerate': { en: 'Regenerate', zh: '重新生成' },
} as const
