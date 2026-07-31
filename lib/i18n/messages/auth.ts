/**
 * Sign in, sign up, and password recovery.
 *
 * TO EDIT A TRANSLATION: change the `zh` value. Pages reference these by key,
 * so a wording change takes effect everywhere the key is used.
 *
 * These matter more than most: they are the first — and for a stuck student,
 * possibly the only — screens they see, and the language switcher is right
 * there on them.
 *
 * `en` doubles as the fallback, so an empty `zh` renders English rather than a
 * raw key.
 */

export const auth = {
  // ── Shared ───────────────────────────────────────────────
  'auth.appName': { en: "Henry's Math Classroom", zh: 'Henry 数学教室' },
  'auth.email': { en: 'Email', zh: '邮箱' },
  'auth.password': { en: 'Password', zh: '密码' },
  'auth.passwordHint': { en: 'At least 6 characters', zh: '至少 6 个字符' },
  'auth.checkEmail': { en: 'Check your email', zh: '请查收邮件' },
  'auth.unexpectedError': { en: 'An unexpected error occurred', zh: '发生了意外错误' },
  'auth.passwordsDoNotMatch': { en: 'Passwords do not match', zh: '两次输入的密码不一致' },
  'auth.passwordTooShort': {
    en: 'Password must be at least 6 characters',
    zh: '密码至少需要 6 个字符',
  },

  // ── Sign in ──────────────────────────────────────────────
  'auth.signInSubtitle': { en: 'Sign in to your account', zh: '登录您的账号' },
  'auth.signIn': { en: 'Sign In', zh: '登录' },
  'auth.forgotPassword': { en: 'Forgot password?', zh: '忘记密码？' },
  'auth.noAccount': { en: "Don't have an account?", zh: '还没有账号？' },
  'auth.signUpLink': { en: 'Sign up', zh: '注册' },

  // ── Sign up ──────────────────────────────────────────────
  'auth.signUpSubtitle': { en: 'Create your account', zh: '创建您的账号' },
  'auth.firstName': { en: 'First Name', zh: '名' },
  'auth.lastName': { en: 'Last Name', zh: '姓' },
  'auth.nickname': { en: 'Nickname (shown to classmates)', zh: '昵称（同学看到的名字）' },
  'auth.nicknameHint': {
    en: 'Optional — displayed instead of your full name to other students',
    zh: '可选——其他同学会看到昵称而不是您的全名',
  },
  'auth.confirmPassword': { en: 'Confirm Password', zh: '确认密码' },
  'auth.createAccount': { en: 'Create Account', zh: '创建账号' },
  'auth.haveAccount': { en: 'Already have an account?', zh: '已经有账号了？' },
  'auth.confirmationSent': {
    en: 'We sent a confirmation link to {email}. Click the link in the email to activate your account.',
    zh: '我们已将确认链接发送至 {email}。点击邮件中的链接即可激活账号。',
  },
  'auth.didNotReceive': {
    en: "Didn't receive it? Check your spam folder.",
    zh: '没收到？请查看垃圾邮件文件夹。',
  },
  'auth.goToSignIn': { en: 'Go to Sign In', zh: '前往登录' },

  // ── Forgot password ──────────────────────────────────────
  'auth.resetSubtitle': { en: 'Reset your password', zh: '重置您的密码' },
  'auth.resetIntro': {
    en: "Enter your email and we'll send you a link to reset your password.",
    zh: '输入您的邮箱，我们会发送重置密码的链接。',
  },
  'auth.sendResetLink': { en: 'Send Reset Link', zh: '发送重置链接' },
  'auth.resetSent': {
    en: 'We sent a password reset link to {email}. Check your inbox and click the link to set a new password.',
    zh: '我们已将重置密码的链接发送至 {email}。请查收邮件并点击链接设置新密码。',
  },
  'auth.didNotGetIt': {
    en: "Didn't get it? Check your spam folder.",
    zh: '没收到？请查看垃圾邮件文件夹。',
  },
  'auth.rememberPassword': { en: 'Remember your password?', zh: '想起密码了？' },

  // ── Reset password ───────────────────────────────────────
  'auth.setNewPassword': { en: 'Set a new password', zh: '设置新密码' },
  'auth.verifyingLink': { en: 'Verifying reset link…', zh: '正在验证重置链接…' },
  'auth.newPassword': { en: 'New Password', zh: '新密码' },
  'auth.confirmNewPassword': { en: 'Confirm New Password', zh: '确认新密码' },
  'auth.updatePassword': { en: 'Update Password', zh: '更新密码' },
} as const
