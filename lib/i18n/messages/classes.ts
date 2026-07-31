/**
 * Classes, enrolment, students and grading.
 *
 * Class names, student names and teacher comments are author-written and stay
 * as typed.
 */

export const classes = {
  'class.myClasses': { en: 'My Classes', zh: '我的班级' },
  'class.explore': { en: 'Explore Classes', zh: '浏览班级' },
  'class.create': { en: 'Create Class', zh: '创建班级' },
  'class.join': { en: 'Join', zh: '加入' },
  'class.joined': { en: 'Joined', zh: '已加入' },
  'class.pending': { en: 'Pending approval', zh: '等待审核' },
  'class.leave': { en: 'Leave class', zh: '退出班级' },
  'class.members': { en: 'Members', zh: '成员' },
  'class.teacher': { en: 'Teacher', zh: '老师' },
  'class.student': { en: 'Student', zh: '学生' },
  'class.className': { en: 'Class name', zh: '班级名称' },
  'class.description': { en: 'Description', zh: '班级简介' },
  'class.noClasses': { en: 'No classes yet', zh: '暂无班级' },
  'class.joinRequests': { en: 'Join Requests', zh: '加入申请' },
  'class.approve': { en: 'Approve', zh: '通过' },
  'class.reject': { en: 'Reject', zh: '拒绝' },
  'class.enrolled': { en: 'enrolled', zh: '人已加入' },
  'class.createNew': { en: 'Create New Class', zh: '创建新班级' },
  'class.new': { en: '+ New', zh: '+ 新建' },
  'class.notEnrolled': {
    en: 'You are not enrolled in any classes yet',
    zh: '您还没有加入任何班级',
  },
  'class.createFirst': { en: 'Create Your First Class', zh: '创建您的第一个班级' },
  'class.noDescription': { en: 'No description', zh: '暂无简介' },
  'class.schedule': { en: 'Schedule:', zh: '上课时间：' },
  'class.starts': { en: 'Starts:', zh: '开课日期：' },
  'class.viewClass': { en: 'View Class', zh: '查看班级' },
  'class.loadFailed': { en: 'Failed to load classes', zh: '加载班级失败' },

  // ── Class detail ─────────────────────────────────────────
  'class.unknownTeacher': { en: 'Unknown Teacher', zh: '未知老师' },
  'class.loadOneFailed': { en: 'Failed to load class', zh: '加载班级失败' },
  'class.notFound': { en: 'Class not found', zh: '找不到这个班级' },
  'class.backToClasses': { en: 'Back to Classes', zh: '返回班级列表' },
  'class.information': { en: 'Class Information', zh: '班级信息' },
  'class.meetingTimes': { en: 'Meeting Times', zh: '上课时间' },
  'class.startDate': { en: 'Start Date', zh: '开课日期' },
  'class.endDate': { en: 'End Date', zh: '结课日期' },
  'class.noMembers': { en: 'No members yet', zh: '还没有成员' },
  'class.noChallenges': {
    en: 'No challenges published to this class yet.',
    zh: '这个班级还没有发布挑战题。',
  },
  'class.requestToJoin': { en: 'Request to Join', zh: '申请加入' },
  'class.sending': { en: 'Sending…', zh: '正在发送…' },
  'class.submitNewRequest': { en: 'Submit New Request', zh: '重新提交申请' },
  'class.showLess': { en: 'Show less', zh: '收起' },
  'class.loginToJoin': {
    en: 'Please log in to request to join this class',
    zh: '请先登录再申请加入这个班级',
  },
  'class.joinRequestFailed': {
    en: 'Failed to send join request. Please try again.',
    zh: '申请发送失败，请重试。',
  },
  'class.deleteFailed': { en: 'Failed to delete class', zh: '删除班级失败' },

  // ── Explore ──────────────────────────────────────────────
  'class.exploreIntro': {
    en: 'Find the perfect class for your learning journey',
    zh: '找到最适合您的班级',
  },
  'class.searchPlaceholder': {
    en: 'Search by class name, teacher, or topic…',
    zh: '按班级名称、老师或主题搜索……',
  },
  'class.allGrades': { en: 'All Grades', zh: '全部年级' },
  'class.kindergarten': { en: 'Kindergarten', zh: '幼儿园' },
  'class.grade': { en: 'Grade {n}', zh: '{n} 年级' },
  'class.noneFound': { en: 'No classes found', zh: '没有找到班级' },
  'class.adjustFilters': {
    en: 'Try adjusting your search or filters',
    zh: '试试调整搜索条件或筛选',
  },
  'class.clearFilters': { en: 'Clear Filters', zh: '清除筛选' },
  'class.full': { en: 'Class full', zh: '班级已满' },
  'class.viewDetails': { en: 'View Details →', zh: '查看详情 →' },
  'class.scheduleTba': { en: 'Schedule TBA', zh: '时间待定' },

  'grade.title': { en: 'Grade Homework', zh: '批改作业' },
  'grade.ungraded': { en: 'Ungraded', zh: '待批改' },
  'grade.graded': { en: 'Graded', zh: '已批改' },
  'grade.points': { en: 'Points', zh: '得分' },
  'grade.comment': { en: 'Comment', zh: '评语' },
  'grade.save': { en: 'Save grade', zh: '保存评分' },
  'grade.noSubmissions': { en: 'No submissions to grade', zh: '暂无待批改的作业' },
} as const
