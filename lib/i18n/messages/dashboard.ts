/** Dashboard tiles and stat labels. Edit the `zh` values to change wording. */

export const dashboard = {
  'dash.mathClass': { en: 'Math Class', zh: '数学课堂' },
  'dash.classroomTitle': { en: "Henry's Math Classroom", zh: 'Henry 数学课堂' },
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
  'dash.qanda': { en: 'Q&A', zh: '问答' },
  'dash.joinRequests': {
    en: 'Students are waiting to join your classes',
    zh: '有学生正在等待加入您的班级',
  },

  // ── The welcome card ─────────────────────────────────────
  // The greeting is one key with the name inside it, not "Welcome back, " + name:
  // Chinese puts the name first and needs no comma, which a join in JSX cannot do.
  'dash.welcomeBack': { en: 'Welcome back, {name}!', zh: '{name}，欢迎回来！' },
  'dash.welcomeStudent': { en: "Let's have fun with math today! 🎉", zh: '今天也一起快乐学数学吧！🎉' },
  'dash.welcomeTeacher': { en: "Let's inspire some students today! 👨‍🏫", zh: '今天也来启发学生吧！👨‍🏫' },
  'dash.today': { en: 'Today', zh: '今天' },
  'dash.done': { en: 'Done', zh: '已完成' },
  'dash.newComment': { en: 'New comment', zh: '新评论' },
  'dash.noChallengeToday': { en: 'No challenge today', zh: '今天没有挑战题' },
  'dash.createOne': { en: 'Create one →', zh: '创建一个 →' },
  'dash.showLess': { en: 'Show less', zh: '收起' },
  'dash.showMore': { en: '+{count} more', zh: '还有 {count} 个' },

  // ── The month calendar ───────────────────────────────────
  'dash.calendar': { en: 'Calendar', zh: '日历' },
  'dash.prevMonth': { en: 'Previous month', zh: '上个月' },
  'dash.nextMonth': { en: 'Next month', zh: '下个月' },
  // The heading reads "August 2026" / "2026年8月" — different order, so the
  // whole thing is one key rather than a month and a year joined in JSX.
  'dash.monthYear': { en: '{month} {year}', zh: '{year}年{month}' },
  'dash.keyProblem': { en: 'problem', zh: '题目' },
  'dash.keySubmitted': { en: 'submitted', zh: '已提交' },
  'dash.keyNextClass': { en: 'next class', zh: '下节课' },
  'dash.calendarStudentHint': {
    en: 'Only what is assigned to you.',
    zh: '仅显示分配给你的内容。',
  },
  'dash.calendarTeacherHint': {
    en: 'Every class running that day.',
    zh: '当天上课的所有班级。',
  },
  'dash.cancelledClass': { en: 'cancelled', zh: '已取消' },
  // Both halves in one key: English reads "Times shown in EDT (New York)" and
  // Chinese puts the place first. A join in JSX would fix one order for both.
  'dash.timesShownIn': {
    en: 'Times shown in {zone} · {place}',
    zh: '时间以 {place}（{zone}）显示',
  },

  // ── The palette picker ───────────────────────────────────
  'dash.paletteLabel': { en: 'Card colour', zh: '卡片配色' },
  'dash.paletteMeadow': { en: 'Meadow', zh: '草原' },
  'dash.paletteSky': { en: 'Sky', zh: '晴空' },
  'dash.paletteDusk': { en: 'Dusk', zh: '黄昏' },
  'dash.paletteSea': { en: 'Sea', zh: '浅海' },
  'dash.paletteRose': { en: 'Ash rose', zh: '灰玫瑰' },
} as const
