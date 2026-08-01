/**
 * Account settings and the student's own score summary.
 *
 * Challenge titles in the recent-grades list are author-written and show as
 * typed.
 */

export const settings = {
  'settings.profile': { en: 'Profile', zh: '个人资料' },
  'settings.firstName': { en: 'First Name', zh: '名' },
  'settings.firstNamePlaceholder': { en: 'First name', zh: '名' },
  'settings.lastName': { en: 'Last Name', zh: '姓' },
  'settings.lastNamePlaceholder': { en: 'Last name', zh: '姓' },
  'settings.email': { en: 'Email', zh: '邮箱' },
  'settings.nickname': { en: 'Nickname (shown to classmates)', zh: '昵称（同学看到的名字）' },
  'settings.nicknameHint': {
    en: 'Optional — displayed instead of your full name to other students',
    zh: '可选——其他同学会看到昵称而不是您的全名',
  },
  'settings.saveProfile': { en: 'Save Profile', zh: '保存资料' },
  'settings.saved': { en: 'Saved!', zh: '已保存！' },
  'settings.saveFailed': { en: 'Failed to save', zh: '保存失败' },

  'settings.taScore': { en: 'TA Score', zh: '助教积分' },
  'settings.myScore': { en: 'My Score', zh: '我的成绩' },
  'settings.totalPoints': { en: 'Total Points', zh: '总分' },
  'settings.graded': { en: 'Graded', zh: '已批改' },
  'settings.submitted': { en: 'Submitted', zh: '已提交' },
  'settings.recentGrades': { en: 'Recent Grades', zh: '最近成绩' },
  'settings.noGradedYet': { en: 'No graded challenges yet', zh: '还没有已批改的挑战题' },
} as const
