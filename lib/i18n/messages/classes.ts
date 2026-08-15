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

  // The grading page, and the spread it opens when a card is clicked.
  // Values inside a sentence go in as placeholders rather than being joined
  // in JSX — Chinese spaces and orders them differently.
  'grade.history': { en: 'Grade History ({count})', zh: '批改记录（{count}）' },
  'grade.dateTo': { en: 'to', zh: '至' },
  'grade.allCaughtUp': { en: 'No ungraded submissions — all caught up!', zh: '没有待批改的提交——全部完成！' },
  'grade.noneGradedYet': { en: 'No graded submissions yet.', zh: '暂无已批改的提交。' },
  'grade.challengeDate': { en: 'Challenge date: {date}', zh: '挑战日期：{date}' },
  'grade.submittedOn': { en: 'Submitted: {date}', zh: '提交时间：{date}' },
  'grade.maxPts': { en: 'Max: {points} pts', zh: '满分：{points} 分' },
  'grade.markReviewed': { en: 'Mark reviewed (0 pts)', zh: '标记为已阅（0 分）' },
  'grade.markReviewedHint': { en: 'Mark as reviewed without assigning points', zh: '标记为已阅，不给分' },
  'grade.update': { en: 'Update', zh: '更新' },
  'grade.scoreOf': { en: '{points}/{max} pts', zh: '{points}/{max} 分' },

  // Errors
  'grade.errLoad': { en: 'Failed to load submissions', zh: '加载提交失败' },
  'grade.errReview': { en: 'Failed to mark as reviewed', zh: '标记为已阅失败' },
  'grade.errSave': { en: 'Failed to save grade', zh: '保存评分失败' },
  'grade.errInvalidPoints': { en: 'Enter a valid point value', zh: '请输入有效的分数' },
  'grade.errMaxPoints': { en: 'Max points is {max}', zh: '满分为 {max}' },

  // The zoomed spread: problem on the left, the whole class on the right.
  'grade.openSpread': { en: 'Open this problem and every answer to it', zh: '打开这道题与全班的解答' },
  'grade.theProblem': { en: 'The problem', zh: '题目' },
  'grade.classAnswers': { en: 'Answers ({count})', zh: '解答（{count}）' },
  'grade.noProblemText': { en: 'This challenge has no problem text saved.', zh: '这道挑战题没有保存题目内容。' },
  'grade.loadingProblem': { en: 'Loading the problem…', zh: '正在加载题目…' },
  'grade.noAnswer': { en: 'No answer submitted.', zh: '未提交解答。' },
  'grade.closeSpread': { en: 'Close', zh: '关闭' },

  // ── Class create / edit form ─────────────────────────────
  //
  // Weekdays and levels are generated from these keys rather than written out
  // as <option> literals, so each exists once instead of twice per page.
  'day.monday': { en: 'Monday', zh: '星期一' },
  'day.tuesday': { en: 'Tuesday', zh: '星期二' },
  'day.wednesday': { en: 'Wednesday', zh: '星期三' },
  'day.thursday': { en: 'Thursday', zh: '星期四' },
  'day.friday': { en: 'Friday', zh: '星期五' },
  'day.saturday': { en: 'Saturday', zh: '星期六' },
  'day.sunday': { en: 'Sunday', zh: '星期日' },

  // Timezone-aware schedules. The day markers matter: when a class in New York
  // falls on the next morning in Shanghai, saying so is the difference between
  // arriving and missing it.
  'class.yourTime': { en: 'your time', zh: '您所在时区' },
  // Shown beside the converted time so the reader can check it against what
  // the teacher actually scheduled, rather than trusting a bare number.
  'class.classTime': { en: 'class time', zh: '班级时区' },
  'class.nextDay': { en: '(next day)', zh: '（次日）' },
  'class.prevDay': { en: '(previous day)', zh: '（前一日）' },
  'class.timezone': { en: 'Class timezone', zh: '班级时区' },
  'class.timezoneHelp': {
    en: 'The timezone this class actually runs in. Students see the time converted to theirs.',
    zh: '本班级实际所在的时区。学生将看到转换为自己时区的时间。',
  },
  'classForm.selectDay': { en: 'Select day…', zh: '选择星期…' },
  'classForm.selectLevel': { en: 'Select level…', zh: '选择难度…' },
  'classForm.select': { en: 'Select…', zh: '请选择…' },
  'classForm.beginner': { en: 'Beginner', zh: '入门' },
  'classForm.intermediate': { en: 'Intermediate', zh: '进阶' },
  'classForm.advanced': { en: 'Advanced', zh: '高级' },
  'classForm.online': { en: 'Online', zh: '线上' },
  'classForm.inPerson': { en: 'In-person', zh: '线下' },

  'classForm.newClass': { en: 'New Class', zh: '新建班级' },
  'classForm.editClass': { en: 'Edit Class', zh: '编辑班级' },
  'classForm.redirecting': { en: 'Redirecting to your new class…', zh: '正在跳转到新班级…' },
  'classForm.oops': { en: 'Oops!', zh: '出错了！' },
  'classForm.className': { en: 'Class Name', zh: '班级名称' },
  'classForm.classNamePlaceholder': {
    en: 'e.g., Algebra 1 - Spring 2026',
    zh: '例如：代数 1 — 2026 春季班',
  },
  'classForm.classNameRequired': {
    en: 'Class name is required (at least 3 characters)',
    zh: '班级名称为必填，至少 3 个字符',
  },
  'classForm.descriptionPlaceholder': {
    en: 'Brief description of what students will learn…',
    zh: '简要说明学生会学到什么……',
  },
  'classForm.schedule': { en: 'Class Schedule', zh: '上课时间' },
  'classForm.addMeeting': { en: 'Add Another Meeting Time', zh: '再加一个上课时段' },
  'classForm.needMeeting': { en: 'Add at least one meeting time', zh: '至少添加一个上课时段' },
  'classForm.classDates': { en: 'Class Dates', zh: '开课与结课' },
  'classForm.startRequired': { en: 'Start date is required', zh: '开课日期为必填' },
  'classForm.coverImage': { en: 'Cover Image', zh: '封面图片' },
  'classForm.uploadHint': { en: 'Click to upload (max 5MB)', zh: '点击上传（最大 5MB）' },
  'classForm.whoFor': { en: 'Who is this class for?', zh: '这个班级适合谁？' },
  'classForm.whoForPlaceholder': {
    en: 'Describe the ideal student for this class…',
    zh: '描述最适合这个班级的学生……',
  },
  'classForm.ageRange': { en: 'Age/Grade Range', zh: '年龄／年级范围' },
  'classForm.ageRangePlaceholder': { en: 'e.g., Grades 3-5 or Ages 8-10', zh: '例如：3–5 年级或 8–10 岁' },
  'classForm.prerequisites': { en: 'Prerequisites', zh: '先修要求' },
  'classForm.prerequisitesPlaceholder': {
    en: 'Any required knowledge or skills…',
    zh: '需要具备的知识或技能……',
  },
  'classForm.syllabus': { en: "Syllabus / What's Included", zh: '课程大纲／包含内容' },
  'classForm.syllabusPlaceholder': {
    en: 'Course topics, modules, and what students will learn…',
    zh: '课程主题、模块，以及学生会学到什么……',
  },
  'classForm.objectives': { en: 'Learning Objectives', zh: '学习目标' },
  'classForm.addObjective': { en: 'Add Objective', zh: '添加目标' },
  'classForm.materialsPlaceholder': { en: 'Worksheets, textbooks, etc.', zh: '练习册、教材等' },
  'classForm.commitmentPlaceholder': { en: 'Time commitment, frequency…', zh: '时间投入、上课频率……' },
  'classForm.aboutTeacher': { en: 'About the Teacher', zh: '关于老师' },
  'classForm.aboutTeacherPlaceholder': {
    en: 'Your qualifications, experience, and teaching approach…',
    zh: '您的资历、经验和教学方式……',
  },
  'classForm.teachingStyle': { en: 'Teaching Style (optional)', zh: '教学风格（可选）' },
  'classForm.teachingStylePlaceholder': {
    en: 'e.g., Interactive, Project-based, Lecture-style',
    zh: '例如：互动式、项目制、讲授式',
  },
  'classForm.maxStudents': { en: 'Max Students', zh: '人数上限' },
  'classForm.price': { en: 'Price ($)', zh: '价格（美元）' },
  'classForm.location': { en: 'Location', zh: '上课地点' },
  'classForm.makePublic': { en: 'Make this class public', zh: '公开这个班级' },
  'classForm.makePublicHint': {
    en: 'Allow parents to discover and request trial classes',
    zh: '让家长可以看到并申请试听',
  },

  'grade.title': { en: 'Grade Homework', zh: '批改作业' },
  'grade.ungraded': { en: 'Ungraded', zh: '待批改' },
  'grade.graded': { en: 'Graded', zh: '已批改' },
  'grade.points': { en: 'Points', zh: '得分' },
  'grade.comment': { en: 'Comment', zh: '评语' },
  'grade.save': { en: 'Save grade', zh: '保存评分' },
  'grade.noSubmissions': { en: 'No submissions to grade', zh: '暂无待批改的作业' },

  // ── Authoring a timetable from the dashboard calendar ────
  // A class no longer carries a weekly time; its sessions are written here.
  'sched.assignClasses': { en: 'Class assignment', zh: '排课' },
  'sched.title': { en: 'Class schedule', zh: '上课安排' },
  'sched.forwardOnly': {
    en: 'Sessions are only ever created from today onward. Past classes are never changed.',
    zh: '只会从今天起创建课程，已上过的课不会被改动。',
  },
  'sched.existing': { en: 'Repeating schedules', zh: '重复安排' },
  'sched.none': { en: 'No repeating schedules yet.', zh: '还没有重复安排。' },
  'sched.addNew': { en: 'Add a repeating schedule', zh: '添加重复安排' },
  'sched.class': { en: 'Class', zh: '班级' },
  // Which clock the times on the panel mean — both the ones shown and the ones
  // typed. One key, because Chinese puts the place before the abbreviation.
  'sched.timesMean': {
    en: 'Times are {zone} · {place} — your own setting',
    zh: '时间为 {place}（{zone}）— 你自己的设置',
  },
  'sched.selectClass': { en: 'Choose a class', zh: '选择班级' },
  'sched.weekday': { en: 'Day of the week', zh: '星期' },
  'sched.from': { en: 'Starts', zh: '开始' },
  'sched.to': { en: 'Ends', zh: '结束' },
  'sched.until': { en: 'until', zh: '截至' },
  'sched.untilOpen': { en: 'no end date', zh: '无截止日期' },
  'sched.untilHint': {
    en: 'Leave the end date empty to keep it running for a year.',
    zh: '留空截止日期则会持续排课一年。',
  },
  'sched.generated': { en: '{count} sessions added', zh: '已添加 {count} 节课' },
  'sched.deleteSeriesConfirm': {
    en: 'Delete this repeating schedule and its upcoming sessions? Classes that already happened are kept.',
    zh: '删除这个重复安排及其未来的课程？已经上过的课会保留。',
  },

  // ── One day ──────────────────────────────────────────────
  'sched.sessionsOn': { en: 'Classes this day', zh: '当天的课' },
  'sched.noSessions': { en: 'No classes this day.', zh: '当天没有课。' },
  'sched.addClass': { en: 'Add a class', zh: '添加一节课' },
  'sched.partOfSeries': { en: 'Part of a repeating schedule', zh: '属于某个重复安排' },
  'sched.modify': { en: 'Change time', zh: '修改时间' },
  'sched.modifyDetaches': {
    en: 'Changing this one takes it out of the repeating schedule, so a later edit to that schedule will leave it alone.',
    zh: '修改这一节会把它从重复安排中移出，之后再修改该安排也不会影响它。',
  },
  'sched.removeThis': { en: 'Just this one', zh: '仅这一节' },
  'sched.removeSeries': { en: 'This and all future', zh: '这节及以后全部' },
  'sched.deleteOccurrenceConfirm': {
    en: 'Remove this class? Homework and materials for it are kept.',
    zh: '删除这节课？相关的作业和资料会保留。',
  },
  'sched.deleteFromHereConfirm': {
    en: 'Stop this repeating schedule from here on? This class and every later one in the series is removed; earlier ones are kept.',
    zh: '从这一天起停止这个重复安排？这节课及之后的课会被删除，之前的会保留。',
  },
  'sched.pastDay': {
    en: 'This day has passed, so no class can be added to it.',
    zh: '这一天已经过去，不能再添加课程。',
  },
} as const
