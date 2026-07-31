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

  // ── Students roster ──────────────────────────────────────
  'students.roleTeacher': { en: 'Teacher', zh: '老师' },
  'students.roleAdmin': { en: 'Admin', zh: '管理员' },
  'students.roleNone': { en: 'No role', zh: '无角色' },
  'students.searchPlaceholder': { en: 'Search by name or email…', zh: '按姓名或邮箱搜索……' },
  'students.allUsers': { en: 'All users', zh: '全部用户' },
  'students.studentsOnly': { en: 'Students only', zh: '仅学生' },
  'students.noneFound': { en: 'No users found', zh: '没有找到用户' },
  'students.noUsers': { en: 'No users yet', zh: '暂无用户' },
  'students.noStudents': { en: 'No students yet', zh: '暂无学生' },

  // ── Student history ──────────────────────────────────────
  'students.loadingHistory': { en: 'Loading history…', zh: '正在加载记录…' },
  'students.submitted': { en: 'Challenges Submitted', zh: '已提交挑战题' },
  'students.graded': { en: 'Graded', zh: '已批改' },
  'students.avgScore': { en: 'Avg Score', zh: '平均分' },
  'students.byTopic': {
    en: 'Score & completion breakdown by topic',
    zh: '按知识点划分的得分与完成情况',
  },
  'students.noSubmissions': { en: 'No submissions yet', zh: '还没有提交记录' },
  'students.noSubmissionsBody': {
    en: "This student hasn't submitted any challenges.",
    zh: '这位学生还没有提交过挑战题。',
  },
  'students.notGraded': { en: 'Not graded', zh: '未批改' },
  'students.view': { en: 'View →', zh: '查看 →' },

  // ── Join requests ────────────────────────────────────────
  'joinReq.title': { en: 'Join Requests', zh: '加入申请' },
  'joinReq.pending': { en: 'Pending Requests', zh: '待处理申请' },
  'joinReq.none': { en: 'No pending requests 🎉', zh: '没有待处理的申请 🎉' },
  'joinReq.history': { en: 'History', zh: '历史记录' },
  'joinReq.approve': { en: 'Approve', zh: '通过' },
  'joinReq.deny': { en: 'Deny', zh: '拒绝' },
  'joinReq.updateFailed': { en: 'Failed to update request', zh: '更新申请失败' },

  // ── Grading ──────────────────────────────────────────────
  'grade.loadingSubmissions': { en: 'Loading submissions…', zh: '正在加载提交…' },
  'grade.pageTitle': { en: 'Grade Submissions', zh: '批改提交' },
  'grade.filterByDate': { en: 'Filter by date:', zh: '按日期筛选：' },
  'grade.clear': { en: 'Clear', zh: '清除' },
  'grade.needsGrading': { en: 'Needs Grading', zh: '待批改' },
  'grade.answer': { en: 'Answer', zh: '解答' },
  'grade.pts': { en: 'pts', zh: '分' },
  'grade.grade': { en: 'Grade', zh: '批改' },
  'grade.editGrade': { en: 'Edit Grade', zh: '修改评分' },

  'grade.title': { en: 'Grade Homework', zh: '批改作业' },
  'grade.ungraded': { en: 'Ungraded', zh: '待批改' },
  'grade.graded': { en: 'Graded', zh: '已批改' },
  'grade.points': { en: 'Points', zh: '得分' },
  'grade.comment': { en: 'Comment', zh: '评语' },
  'grade.save': { en: 'Save grade', zh: '保存评分' },
  'grade.noSubmissions': { en: 'No submissions to grade', zh: '暂无待批改的作业' },
} as const
