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
    zh: '你还没有加入任何班级',
  },
  'class.createFirst': { en: 'Create Your First Class', zh: '创建你的第一个班级' },
  'class.noDescription': { en: 'No description', zh: '暂无简介' },
  'class.schedule': { en: 'Schedule:', zh: '上课时间：' },
  'class.starts': { en: 'Starts:', zh: '开课日期：' },
  'class.viewClass': { en: 'View Class', zh: '查看班级' },
  'class.loadFailed': { en: 'Failed to load classes', zh: '加载班级失败' },

  'grade.title': { en: 'Grade Homework', zh: '批改作业' },
  'grade.ungraded': { en: 'Ungraded', zh: '待批改' },
  'grade.graded': { en: 'Graded', zh: '已批改' },
  'grade.points': { en: 'Points', zh: '得分' },
  'grade.comment': { en: 'Comment', zh: '评语' },
  'grade.save': { en: 'Save grade', zh: '保存评分' },
  'grade.noSubmissions': { en: 'No submissions to grade', zh: '暂无待批改的作业' },
} as const
