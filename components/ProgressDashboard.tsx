'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'

interface ProgressDashboardProps {
  classId: string
  userId?: string
  userRole: 'teacher' | 'student'
}

interface StudentProgress {
  student_id: string
  student_name: string
  student_email: string
  sessions_attended: number
  total_sessions: number
  homework_submitted: number
  total_homework: number
  average_grade: number | null
  completion_rate: number
}

interface ClassStats {
  total_students: number
  total_sessions: number
  completed_sessions: number
  total_assignments: number
  average_submission_rate: number
  average_class_grade: number | null
}

export default function ProgressDashboard({ classId, userId, userRole }: ProgressDashboardProps) {
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null)
  const [classStats, setClassStats] = useState<ClassStats | null>(null)
  const [allStudents, setAllStudents] = useState<StudentProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (userRole === 'student' && userId) {
      loadStudentProgress(userId)
    } else if (userRole === 'teacher') {
      loadClassStats()
      loadAllStudentsProgress()
    }
  }, [classId, userId, userRole])

  async function loadStudentProgress(studentId: string) {
    try {
      setLoading(true)
      setError(null)

      // Get student info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', studentId)
        .single()

      // Get total sessions
      const { count: totalSessions } = await supabase
        .from('class_occurrences')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId)

      // Get completed sessions
      const { count: completedSessions } = await supabase
        .from('class_occurrences')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('status', 'completed')

      // Get homework assignments
      const { data: assignments } = await supabase
        .from('homework_assignments')
        .select('id')
        .eq('occurrence_id', supabase.rpc('get_class_occurrences', { p_class_id: classId }))

      const totalHomework = assignments?.length || 0

      // Get submissions
      const { data: submissions } = await supabase
        .from('homework_submissions')
        .select('id, assignment_id')
        .eq('student_id', studentId)
        .in('assignment_id', assignments?.map(a => a.id) || [])

      const homeworkSubmitted = submissions?.length || 0

      // Get grades
      const { data: grades } = await supabase
        .from('homework_grades')
        .select('points_earned, homework_submissions!inner(assignment_id)')
        .eq('homework_submissions.student_id', studentId)
        .eq('status', 'published')

      const averageGrade = grades && grades.length > 0
        ? grades.reduce((sum, g) => sum + g.points_earned, 0) / grades.length
        : null

      const completionRate = totalHomework > 0
        ? (homeworkSubmitted / totalHomework) * 100
        : 0

      setStudentProgress({
        student_id: studentId,
        student_name: profile?.full_name || 'Unknown',
        student_email: profile?.email || '',
        sessions_attended: completedSessions || 0,
        total_sessions: totalSessions || 0,
        homework_submitted: homeworkSubmitted,
        total_homework: totalHomework,
        average_grade: averageGrade,
        completion_rate: completionRate
      })
    } catch (err) {
      console.error('Failed to load student progress:', err)
      setError(err instanceof Error ? err.message : 'Failed to load progress')
    } finally {
      setLoading(false)
    }
  }

  async function loadClassStats() {
    try {
      // Get total students
      const { count: totalStudents } = await supabase
        .from('class_members')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId)

      // Get sessions
      const { data: sessions, count: totalSessions } = await supabase
        .from('class_occurrences')
        .select('*', { count: 'exact' })
        .eq('class_id', classId)

      const completedSessions = sessions?.filter(s => s.status === 'completed').length || 0

      // Get assignments count
      const { count: totalAssignments } = await supabase
        .from('homework_assignments')
        .select('*', { count: 'exact', head: true })
        .in('occurrence_id', sessions?.map(s => s.id) || [])

      setClassStats({
        total_students: totalStudents || 0,
        total_sessions: totalSessions || 0,
        completed_sessions: completedSessions,
        total_assignments: totalAssignments || 0,
        average_submission_rate: 0, // Will be calculated from all students
        average_class_grade: null // Will be calculated from all students
      })
    } catch (err) {
      console.error('Failed to load class stats:', err)
    }
  }

  async function loadAllStudentsProgress() {
    try {
      const { data: members } = await supabase
        .from('class_members')
        .select('user_id, profiles:user_id(full_name, email)')
        .eq('class_id', classId)

      // For simplicity, just show basic info
      // In production, you'd calculate full stats for each student
      const studentsData: StudentProgress[] = members?.map(m => ({
        student_id: m.user_id,
        student_name: (m.profiles as any)?.full_name || 'Unknown',
        student_email: (m.profiles as any)?.email || '',
        sessions_attended: 0,
        total_sessions: 0,
        homework_submitted: 0,
        total_homework: 0,
        average_grade: null,
        completion_rate: 0
      })) || []

      setAllStudents(studentsData)
    } catch (err) {
      console.error('Failed to load students:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <Card.Body>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </Card.Body>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <Card.Body>
          <div className="text-center py-8">
            <p className="text-red-600">⚠️ {error}</p>
          </div>
        </Card.Body>
      </Card>
    )
  }

  // Student View
  if (userRole === 'student' && studentProgress) {
    return (
      <Card>
        <Card.Header>
          <Card.Title>My Progress</Card.Title>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Attendance */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600 font-medium mb-1">
                Class Attendance
              </div>
              <div className="text-3xl font-bold text-blue-900">
                {studentProgress.sessions_attended}/{studentProgress.total_sessions}
              </div>
              <div className="text-sm text-blue-700 mt-1">
                {studentProgress.total_sessions > 0
                  ? Math.round((studentProgress.sessions_attended / studentProgress.total_sessions) * 100)
                  : 0}% attended
              </div>
            </div>

            {/* Homework Completion */}
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600 font-medium mb-1">
                Homework Completion
              </div>
              <div className="text-3xl font-bold text-green-900">
                {studentProgress.homework_submitted}/{studentProgress.total_homework}
              </div>
              <div className="text-sm text-green-700 mt-1">
                {Math.round(studentProgress.completion_rate)}% complete
              </div>
            </div>

            {/* Average Grade */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-600 font-medium mb-1">
                Average Grade
              </div>
              <div className="text-3xl font-bold text-purple-900">
                {studentProgress.average_grade !== null
                  ? `${Math.round(studentProgress.average_grade)}%`
                  : 'N/A'}
              </div>
              <div className="text-sm text-purple-700 mt-1">
                {studentProgress.average_grade !== null
                  ? studentProgress.average_grade >= 90 ? 'Excellent!' :
                    studentProgress.average_grade >= 80 ? 'Good work!' :
                    studentProgress.average_grade >= 70 ? 'Keep it up!' :
                    'Need improvement'
                  : 'No grades yet'}
              </div>
            </div>

            {/* Overall Progress */}
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="text-sm text-yellow-600 font-medium mb-1">
                Overall Progress
              </div>
              <div className="text-3xl font-bold text-yellow-900">
                {Math.round((studentProgress.completion_rate + 
                  (studentProgress.total_sessions > 0 
                    ? (studentProgress.sessions_attended / studentProgress.total_sessions) * 100 
                    : 0)) / 2)}%
              </div>
              <div className="text-sm text-yellow-700 mt-1">
                Combined score
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>
    )
  }

  // Teacher View
  if (userRole === 'teacher' && classStats) {
    return (
      <div className="space-y-6">
        {/* Class Overview */}
        <Card>
          <Card.Header>
            <Card.Title>Class Overview</Card.Title>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {classStats.total_students}
                </div>
                <div className="text-sm text-gray-600 mt-1">Students</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {classStats.completed_sessions}/{classStats.total_sessions}
                </div>
                <div className="text-sm text-gray-600 mt-1">Sessions</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {classStats.total_assignments}
                </div>
                <div className="text-sm text-gray-600 mt-1">Assignments</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {classStats.average_class_grade !== null
                    ? `${Math.round(classStats.average_class_grade)}%`
                    : 'N/A'}
                </div>
                <div className="text-sm text-gray-600 mt-1">Avg Grade</div>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Student List */}
        <Card>
          <Card.Header>
            <Card.Title>Student Progress</Card.Title>
          </Card.Header>
          <Card.Body>
            {allStudents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No students enrolled yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                        Student
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">
                        Attendance
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">
                        Homework
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">
                        Avg Grade
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStudents.map((student) => (
                      <tr key={student.student_id} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {student.student_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {student.student_email}
                            </div>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-gray-700">
                          {student.sessions_attended}/{student.total_sessions}
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-gray-700">
                          {student.homework_submitted}/{student.total_homework}
                        </td>
                        <td className="text-center py-3 px-4 text-sm text-gray-700">
                          {student.average_grade !== null
                            ? `${Math.round(student.average_grade)}%`
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    )
  }

  return null
}
