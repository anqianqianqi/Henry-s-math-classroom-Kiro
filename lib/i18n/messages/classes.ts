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

  // ── User history: the roster, and managing who is what ──────
  // Absorbed from the old role-management page, which is now a redirect.
  'students.pageTitle': { en: 'User History', zh: '用户记录' },
  'students.addUser': { en: 'Add user', zh: '添加用户' },
  'students.newUser': { en: 'New user', zh: '新建用户' },
  'students.firstName': { en: 'First name', zh: '名' },
  'students.lastName': { en: 'Last name', zh: '姓' },
  'students.email': { en: 'Email', zh: '邮箱' },
  'students.password': { en: 'Password', zh: '密码' },
  'students.passwordHint': { en: 'At least 6 characters', zh: '至少 6 个字符' },
  'students.role': { en: 'Role', zh: '角色' },
  'students.roleStudent': { en: 'Student', zh: '学生' },
  'students.classOptional': { en: 'Class (optional)', zh: '班级（可选）' },
  'students.noClass': { en: 'No class', zh: '不加入班级' },
  'students.create': { en: 'Create user', zh: '创建用户' },
  'students.creating': { en: 'Creating…', zh: '创建中…' },
  'students.created': { en: '{name} created', zh: '已创建 {name}' },
  'students.createFailed': { en: 'Could not create the user', zh: '创建用户失败' },
  'students.networkError': { en: 'Network error — please try again', zh: '网络错误，请重试' },

  // Changing what someone is. Administrator is offered because the page it
  // replaced could grant it, and dropping that would quietly remove the only
  // way to make another administrator.
  'students.changeRole': { en: 'Change role', zh: '更改角色' },
  'students.roleChangeFailed': { en: 'Could not change the role', zh: '更改角色失败' },
  'students.confirmRole': {
    en: 'Make {name} a {role}? This replaces their current role.',
    zh: '将 {name} 设为{role}？这会替换其现有角色。',
  },
  'students.submissionsLabel': { en: 'submissions', zh: '提交' },
  'students.countShown': { en: '{shown} of {total} shown', zh: '显示 {shown} / {total}' },
  'students.countTotalUsers': { en: '{count} users total', zh: '共 {count} 位用户' },
  'students.countTotalStudents': { en: '{count} students total', zh: '共 {count} 位学生' },
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
  'grade.justNow': { en: 'just now', zh: '刚刚' },

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

  // ── Problem set: a printable run of one class’s problems ──
  'pset.button': { en: 'Problem set', zh: '题目集' },
  'pset.title': { en: 'Generate problem set', zh: '生成题目集' },
  'pset.intro': {
    en: 'Pick a class and a range of dates. Every problem assigned in that range is laid out one to a page, ready to print.',
    zh: '选择班级与日期范围。该范围内布置的每道题都会单独占一页，可直接打印。',
  },
  'pset.class': { en: 'Class', zh: '班级' },
  'pset.pickClass': { en: 'Pick a class', zh: '选择班级' },
  'pset.from': { en: 'From', zh: '开始' },
  'pset.to': { en: 'To', zh: '结束' },
  'pset.generate': { en: 'Generate', zh: '生成' },
  'pset.loadingDates': { en: 'Looking for problems…', zh: '正在查找题目…' },
  'pset.noProblems': { en: 'This class has no problems assigned.', zh: '该班级还没有布置题目。' },
  'pset.countInRange': { en: '{count} problems in this range', zh: '此范围内有 {count} 道题' },
  'pset.rangeBackwards': { en: 'The end date is before the start date.', zh: '结束日期早于开始日期。' },

  // A student prints their own classes, up to today unless they read ahead.
  'pset.noClasses': {
    en: 'You are not enrolled in a class yet.',
    zh: '你还没有加入任何班级。',
  },
  'pset.includeFuture': {
    en: 'Include problems set for later',
    zh: '包含以后布置的题目',
  },
  'pset.includeFutureHint': {
    en: 'Off by default, so the set ends with today’s problem. Turn it on to work ahead.',
    zh: '默认关闭，题目集到今天为止。打开后可以提前做后面的题。',
  },
  'pset.notYourClass': {
    en: 'You can only print problems for a class you are in.',
    zh: '你只能打印自己所在班级的题目。',
  },
  // ── Handing in a whole set from one scan ──────────────────
  'sol.button': { en: 'Hand in', zh: '交作业' },
  'sol.title': { en: 'Hand in a problem set', zh: '提交题目集' },
  'sol.intro': {
    en: 'Upload a scan or photos of the set you worked on. Each answer is found and cut out, and you check them before anything is handed in.',
    zh: '上传你做过的整套题目的扫描件或照片。系统会找出并裁切每道题的作答，提交前先由你确认。',
  },
  'sol.file': { en: 'Your pages', zh: '你的答题页' },
  'sol.fileHint': {
    en: 'One PDF, or several photos (JPEG, PNG). Keep the printed question on the page — it is how each answer is recognised.',
    zh: '一个 PDF，或多张照片（JPEG、PNG）。请保留页面上打印的题目，系统依靠它来识别每道作答。',
  },
  'sol.unreadableImage': {
    en: 'Could not open "{file}". iPhone photos saved as HEIC often cannot be read on a computer — sharing them as JPEG, or handing in the PDF, works.',
    zh: '无法打开“{file}”。iPhone 的 HEIC 照片在电脑上通常无法读取，改用 JPEG 分享或提交 PDF 即可。',
  },
  'sol.read': { en: 'Read my pages', zh: '识别答题页' },
  'sol.readingPages': { en: 'Opening your pages…', zh: '正在打开答题页…' },
  'sol.matching': { en: 'Looking through {pages} pages for {problems} problems…', zh: '正在从 {pages} 页中查找 {problems} 道题的作答…' },
  'sol.noPages': { en: 'Nothing could be read from that file.', zh: '无法从该文件中读取内容。' },
  'sol.noProblems': { en: 'That range has no problems in it.', zh: '该范围内没有题目。' },
  'sol.matchFailed': { en: 'The pages could not be read. Try again, or hand the problems in one at a time.', zh: '无法识别这些页面。请重试，或逐题提交。' },
  'sol.notConfigured': { en: 'Reading uploads is not switched on for this site yet.', zh: '本站尚未开启上传识别功能。' },
  'sol.reviewIntro': { en: 'Found working for {found} of {total} problems.', zh: '在 {total} 道题中找到 {found} 道的作答。' },
  'sol.reviewMissing': { en: '{count} still need a page choosing.', zh: '还有 {count} 道需要你指定页面。' },
  'sol.notFound': { en: 'No working found for this one.', zh: '没有找到这道题的作答。' },
  'sol.usePage': { en: 'Use page {page}', zh: '用第 {page} 页' },
  'sol.include': { en: 'Hand in', zh: '提交' },
  'sol.adjustCrop': { en: 'Change the crop', zh: '调整裁切' },
  'sol.cropHint': {
    en: 'Drag a box around your working for this problem.',
    zh: '拖动框选这道题的作答部分。',
  },
  'sol.cropSave': { en: 'Use this crop', zh: '使用此裁切' },
  'sol.cropReset': { en: 'Back to what was found', zh: '恢复自动识别' },
  'sol.cropWholePage': { en: 'Whole page', zh: '整页' },
  'sol.viewProblem': { en: 'See the question', zh: '查看题目' },
  'sol.closePreview': { en: 'Close', zh: '关闭' },
  'sol.reviewHint': {
    en: 'Tap a title, or “See the question”, to read the problem beside the answer found for it.',
    zh: '点击题目名称或“查看题目”，即可对照查看题目与找到的作答。',
  },
  'sol.alreadyHandedIn': { en: 'You have answered this one already', zh: '这道题你已经作答过' },
  'sol.alreadyLocked': { en: 'Answered and locked after grading', zh: '已作答，批改后已锁定' },

  // Choosing between an answer already handed in and the one just found.
  'sol.previous': { en: 'Handed in before', zh: '之前提交的' },
  'sol.current': { en: 'Found in this upload', zh: '本次上传找到的' },
  'sol.previousEmpty': { en: 'Nothing was attached to it.', zh: '当时没有附上内容。' },
  'sol.gradedAt': { en: 'Graded {points}', zh: '得分 {points}' },
  'sol.keepPrevious': { en: 'Keep the one I handed in', zh: '保留之前提交的' },
  'sol.useNew': { en: 'Replace it with this one', zh: '用这份替换' },
  'sol.replacingGraded': {
    en: 'This one is already graded — the mark will still be there, against the new answer.',
    zh: '这道题已批改，分数会保留，但对应的将是新的作答。',
  },
  'sol.lockedKeep': {
    en: 'Locked after grading, so it cannot be replaced from here. Ask your teacher to unlock it first.',
    zh: '批改后已锁定，无法在此替换。请先让老师解锁。',
  },
  'sol.postFailedLocked': { en: '{count} were locked and left alone.', zh: '有 {count} 道已锁定，未做更改。' },
  'sol.postCount': { en: 'Hand in {count} answers', zh: '提交 {count} 道作答' },
  'sol.posting': { en: 'Handing in…', zh: '正在提交…' },
  'sol.posted': { en: '{count} answers handed in.', zh: '已提交 {count} 道作答。' },
  'sol.postFailed': { en: '{count} could not be handed in.', zh: '有 {count} 道提交失败。' },
  'sol.leaveWarning': {
    en: 'Leave without handing in? The pages you uploaded and the answers found in them will be lost.',
    zh: '确定要离开吗？已上传的页面和识别出的作答都会丢失。',
  },
  'sol.backToDashboard': { en: 'Back to the dashboard', zh: '返回主页' },
  'pset.signedOut': {
    en: 'Sign in to print a problem set.',
    zh: '请先登录再打印题目集。',
  },

  // Which wording to print. Only a .henryproblem snapshot keeps the two
  // languages apart; anything else is one block of text and prints as it is.
  'pset.wording': { en: 'Wording', zh: '题面语言' },
  'pset.langBoth': { en: 'English and Chinese', zh: '中英双语' },
  'pset.langEn': { en: 'English only', zh: '仅英文' },
  'pset.langZh': { en: 'Chinese only', zh: '仅中文' },
  'pset.langNoSnapshot': {
    en: '{count} of these were not imported as an editable problem, so their wording prints unchanged.',
    zh: '其中 {count} 道不是以可编辑题目导入的，题面将原样打印。',
  },
  'pset.langAllNoSnapshot': {
    en: 'None of these were imported as an editable problem, so this setting will not change what prints.',
    zh: '这些题目都不是以可编辑题目导入的，此设置不会改变打印内容。',
  },

  // The printable page itself.
  'pset.printTitle': { en: 'Problem set', zh: '题目集' },
  'pset.print': { en: 'Print', zh: '打印' },
  'pset.fitToPage': { en: 'Fit each problem to one page', zh: '每题缩放到一页' },
  'pset.shrunk': { en: '{count} shrunk to fit', zh: '{count} 道已缩放' },
  'pset.overflowing': {
    en: '{count} still run past one page',
    zh: '{count} 道仍超过一页',
  },
  'pset.thisOverflows': {
    en: 'Too long for one page even at the smallest readable size — this one prints on two.',
    zh: '即使缩到可读的最小尺寸仍超过一页，这道题会打印成两页。',
  },

  // The paper. A4 and A5 are written the same way in both languages.
  'pset.paper': { en: 'Paper', zh: '纸张' },
  'pset.paperA4': { en: 'A4', zh: 'A4' },
  'pset.paperA5': { en: 'A5', zh: 'A5' },
  'pset.paperLetter': { en: 'Letter', zh: 'Letter 信纸' },
  'pset.paperLegal': { en: 'Legal', zh: 'Legal 法律纸' },
  'pset.paperHint': {
    en: 'Choose the same paper in the print dialog and leave scaling at 100%, or it will be resized again.',
    zh: '请在打印对话框中选择相同纸张并将缩放保持为 100%，否则会被再次缩放。',
  },
  'pset.printing': { en: 'Preparing…', zh: '准备中…' },
  'pset.pageOf': { en: '{index} of {total}', zh: '第 {index} / {total} 页' },
  'pset.forClass': { en: '{name} · {from} to {to}', zh: '{name} · {from} 至 {to}' },
  'pset.nothingHere': { en: 'No problems in that range.', zh: '该范围内没有题目。' },
  'pset.noSheet': { en: 'This problem has no printable worksheet.', zh: '这道题没有可打印的题面。' },
  'pset.backgroundHint': {
    en: 'In the print dialog, turn off “Headers and footers” to drop the date and URL.',
    zh: '在打印对话框中关闭“页眉和页脚”，即可去掉日期与网址。',
  },
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
