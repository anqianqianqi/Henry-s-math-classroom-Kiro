/**
 * Decorations hub, book skins, challenge rooms and bundles.
 * Edit the `zh` values to change wording.
 */

export const decorations = {
  // ── Hub ──────────────────────────────────────────────────
  'decor.intro': {
    en: 'Personalise your classroom experience.',
    zh: '个性化你的课堂体验。',
  },
  'decor.adminTools': { en: 'Admin Tools', zh: '管理工具' },

  'decor.bookCoverPage': { en: 'Book Cover & Page', zh: '书封面与内页' },
  'decor.bookCoverPageSub': { en: 'Customise your challenge book', zh: '自定义你的挑战书' },
  'decor.bookCoverPageDesc': {
    en: 'Choose cover skins and page styles for the book that appears on every challenge.',
    zh: '为每道挑战题中出现的书本选择封面与内页样式。',
  },

  'decor.challengeRoom': { en: 'Challenge Room', zh: '挑战房间' },
  'decor.challengeRoomSub': { en: 'Your 3D reading room', zh: '你的 3D 阅读房间' },
  'decor.challengeRoomDesc': {
    en: 'Swap the flat book for a 3D room with an animated book, and pick the cover / inner-page bundle that wraps it.',
    zh: '把平面书本换成带动画书本的 3D 房间，并选择包裹它的封面与内页组合。',
  },

  'decor.petRoom': { en: 'Pet Room', zh: '宠物房间' },
  'decor.petRoomSub': { en: "Your pet's home background", zh: '宠物的家园背景' },
  'decor.petRoomDesc': {
    en: 'Browse and select room backgrounds for your pet area on the dashboard.',
    zh: '浏览并选择主页宠物区域的房间背景。',
  },

  // ── Collection management ────────────────────────────────
  'decor.noChallengeRoom': { en: 'NoChallengeRoom', zh: '不使用挑战房间' },
  'decor.setDefault': { en: 'Set default', zh: '设为默认' },
  'decor.isDefault': { en: 'Is Default', zh: '当前默认' },
  'decor.default': { en: 'Default', zh: '默认' },
  'decor.makePublic': { en: 'Make public', zh: '设为公开' },
  'decor.makePrivate': { en: 'Make private', zh: '设为私有' },
  'decor.activate': { en: 'Activate', zh: '启用' },
  'decor.deactivate': { en: 'Deactivate', zh: '停用' },
  'decor.sellInShop': { en: 'Sell in shop', zh: '上架商店' },
  'decor.inShop': { en: 'In shop', zh: '已上架' },
  'decor.public': { en: 'Public', zh: '公开' },
  'decor.adminOnly': { en: 'Admin only', zh: '仅管理员' },
  'decor.inactive': { en: 'Inactive', zh: '已停用' },
  'decor.active': { en: 'Active', zh: '使用中' },
  'decor.priceInPoints': { en: 'Price in points', zh: '价格（积分）' },
  'decor.list': { en: 'List', zh: '上架' },

  'decor.roomHeading': { en: 'Challenge Room', zh: '挑战房间' },
  'decor.roomDesc': {
    en: 'Replaces the flat book with a 3D room and an animated book. Desktop only, and only on challenges imported from a .henryproblem file.',
    zh: '用带动画书本的 3D 房间替代平面书本。仅在电脑端、且仅对由 .henryproblem 文件导入的挑战题生效。',
  },
  'decor.roomsEmpty': { en: 'No rooms yet.', zh: '暂无房间。' },
  'decor.roomsLoading': { en: 'Loading rooms…', zh: '房间加载中…' },
  'decor.optOutNotice': {
    en: 'Challenge rooms are off for you — challenges show the flat book. Turn NoChallengeRoom off, or pick a room below, to switch back.',
    zh: '你已关闭挑战房间，挑战题将显示平面书本。关闭“不使用挑战房间”或在下方选择一个房间即可恢复。',
  },
  'decor.defaultWarning': {
    en: 'Setting this as default turns the 3D room on for every student who has not chosen one — a launch switch, not just a label.',
    zh: '设为默认会为所有尚未自行选择的学生开启 3D 房间——这是正式启用的开关，而不只是一个标记。',
  },

  'decor.bundleHeading': { en: 'Book Cover / Inner Page Bundle', zh: '书封面与内页组合' },
  'decor.bundleDesc': {
    en: 'Wraps the 3D book in the Challenge Room. The cover shows when the book is closed, the inner page backs both open pages.',
    zh: '用于包裹挑战房间中的 3D 书本。合上时显示封面，翻开时两页均使用内页。',
  },
  'decor.bundlesEmpty': { en: 'No bundles yet.', zh: '暂无组合。' },
  'decor.bundlesLoading': { en: 'Loading bundles…', zh: '组合加载中…' },
  'decor.bundleNeedsRoom': {
    en: 'A bundle only applies inside a Challenge Room. Choose a room first and these become selectable.',
    zh: '组合仅在挑战房间中生效。请先选择一个房间，之后即可选择组合。',
  },
  'decor.useFlatBook': { en: 'Use the flat book instead', zh: '改用平面书本' },

  // ── Challenge room page ──────────────────────────────────
  'decor.roomPageIntro': {
    en: 'The Challenge Room replaces the flat book with a 3D room and an animated book. It appears on desktop, on challenges imported from a .henryproblem file.',
    zh: '挑战房间会用带动画书本的 3D 房间替代平面书本，仅在电脑端、且仅对由 .henryproblem 文件导入的挑战题显示。',
  },
  'decor.openRoomCollection': {
    en: 'Open Challenge Room collection →',
    zh: '打开挑战房间收藏 →',
  },
  'decor.loadingCollection': { en: 'Loading your collection…', zh: '收藏加载中…' },
} as const
